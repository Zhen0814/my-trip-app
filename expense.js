/**
 * ==============================================================================
 * [檔案名稱] expense.js
 * [功能描述] 記帳與開支管理系統：包含多幣別換算、公費/私人分帳、照片收據管理與加密解鎖
 * [工程師] Senior Front-end Engineer (10+ Years Exp)
 * [更新內容] 全面導入 fetchData / saveData 雲端同步邏輯與跨裝置身分解鎖
 * ==============================================================================
 */

/* --- 1. 狀態管理與匯率定義 --- */
let currentExpView = 'entry';        // 'entry' (記帳) 或 'details' (明細)
let currentDetailOwner = 'public';   // 當前明細查看對象 ('public' 或 成員名稱)
let isExpUnlocked = false;           // 私人帳目是否已解鎖
let selectedCurrency = 'KRW';        // 預設幣別
let selectedPayer = '';              // 預設支付者
let selectedExpOwner = 'public';      // 預設歸屬對象 (公費/私人)
let collapsedDays = {};              // 明細摺疊狀態紀錄

// 匯率定義：KRW、USD 對 TWD 的匯率 (保留 LocalStorage 作為快取)
const rates = JSON.parse(localStorage.getItem('tripRates') || '{"KRW":0.024, "USD":32.5, "TWD":1.0}');

/* --- 2. 視圖切換路由 --- */
async function switchExpView(view) {
    currentExpView = view;
    
    const entryZone = document.getElementById('exp-entry-zone');
    const detailsZone = document.getElementById('exp-details-zone');
    const navEntry = document.getElementById('nav-exp-entry');
    const navDetails = document.getElementById('nav-exp-details');

    if (navEntry) navEntry.classList.toggle('active', view === 'entry');
    if (navDetails) navDetails.classList.toggle('active', view === 'details');
    if (entryZone) entryZone.classList.toggle('hidden', view !== 'entry');
    if (detailsZone) detailsZone.classList.toggle('hidden', view !== 'details');
    
    if (view === 'details') {
        await renderDetailTabs();
        await renderExpensesV2();
        window.scrollTo({ top: 0, behavior: 'auto' });
    } else {
        await initExpenseFormV2();
        window.scrollTo({ top: 0, behavior: 'auto' });
    }
}

/* --- 3. 影像處理函式 (收據管理) --- */
async function updateExpensePhoto(id, input) {
    if (!input.files || !input.files[0]) return;
    try {
        const compressedBase64 = await utils.compressImage(input.files[0], 1200, 0.8);
        
        let data = await fetchData('tripExpenses', '[]');
        const idx = data.findIndex(item => item.id === id);
        
        if (idx !== -1) {
            data[idx].receiptImg = compressedBase64;
            await saveData('tripExpenses', data);
            await renderExpensesV2();
        }
    } catch (err) { 
        console.error("收據上傳失敗:", err);
        alert("圖片處理失敗，請換一張試試"); 
    }
}

/**
 * 刪除指定帳目照片
 * @param {number} id 帳目 ID
 */
async function deleteExpensePhoto(id) {
    let data = await fetchData('tripExpenses', '[]');
    const idx = data.findIndex(item => item.id === id);
    
    if (idx !== -1) {
        data[idx].receiptImg = ""; 
        await saveData('tripExpenses', data);
        
        const lightbox = document.getElementById('trans-lightbox');
        if (lightbox) lightbox.classList.remove('active');
        
        await renderExpensesV2();
    }
}

/* --- 4. 幣別與換算邏輯 --- */
function selectCurrency(el, cur) {
    document.querySelectorAll('#ev2-currencies .exp-option-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    selectedCurrency = cur;
    const krwInput = document.getElementById('ev2-krw');
    if (krwInput) updateTwdConversion(krwInput.value);
}

function updateTwdConversion(val) {
    const twdDisplay = document.getElementById('ev2-twd');
    if (!twdDisplay) return;
    if (!val || val <= 0) {
        twdDisplay.innerText = '0';
        return;
    }
    const rate = rates[selectedCurrency] || 1.0;
    const result = Math.round(val * rate);
    twdDisplay.innerText = result.toLocaleString();
}

/* --- 5. 輸入表單交互 --- */
function selectPayer(el, name) {
    document.querySelectorAll('#ev2-payer-list .exp-member-pill').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
    selectedPayer = name;
}

function selectExpOwner(el, owner) {
    document.querySelectorAll('#ev2-owner-list .exp-member-pill').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
    selectedExpOwner = owner;
}

/**
 * 初始化記帳表單 (修復為全雲端成員名單)
 */
async function initExpenseFormV2() {
    const payerContainer = document.getElementById('ev2-payer-list');
    const ownerContainer = document.getElementById('ev2-owner-list');
    const dateInput = document.getElementById('ev2-date');
    
    // 改從雲端讀取成員名單
    const editors = await fetchData('editorList', '[]');
    const currentUser = (localStorage.getItem('currentUser') || "").trim();

    if (dateInput && typeof days !== 'undefined' && days[currentDay-1]) {
        const storedStartDate = localStorage.getItem('startDate');
        const year = storedStartDate ? storedStartDate.split('-')[0] : new Date().getFullYear();
        const monthDay = days[currentDay-1].replace('.', '-');
        dateInput.value = `${year}-${monthDay}`;
    }

    if (payerContainer) {
        if (!selectedPayer) selectedPayer = currentUser;
        let payerHtml = '';
        editors.forEach(name => {
            payerHtml += `<div class="exp-member-pill ${selectedPayer === name ? 'active' : ''}" onclick="selectPayer(this, '${name}')">👤 ${name}</div>`;
        });
        payerContainer.innerHTML = payerHtml;
    }

    if (ownerContainer) {
        let ownerHtml = `<div class="exp-member-pill ${selectedExpOwner === 'public' ? 'active' : ''}" onclick="selectExpOwner(this, 'public')">🌐 公費</div>`;
        editors.forEach(name => {
            ownerHtml += `<div class="exp-member-pill ${selectedExpOwner === name ? 'active' : ''}" onclick="selectExpOwner(this, '${name}')">👤 ${name}</div>`;
        });
        ownerContainer.innerHTML = ownerHtml;
    }
}

/* --- 6. 數據操作 (新增/刪除) --- */

/**
 * 儲存記帳資料
 */
async function saveExpenseV2() {
    const noteEl = document.getElementById('ev2-note');
    const krwEl = document.getElementById('ev2-krw');
    const dateEl = document.getElementById('ev2-date');
    
    const note = noteEl ? noteEl.value.trim() : "";
    const rawVal = krwEl ? krwEl.value : 0;
    const dateVal = dateEl ? dateEl.value : "";

    if (!note || !rawVal) {
        alert("請輸入項目名稱與金額！");
        return;
    }

    const data = await fetchData('tripExpenses', '[]');
    
    const newEntry = {
        id: Date.now(),
        date: dateVal,
        day: typeof currentDay !== 'undefined' ? currentDay : 1,
        note: note,
        payer: selectedPayer,
        currency: selectedCurrency,
        originalAmount: Number(rawVal),
        amount: Math.round(rawVal * (rates[selectedCurrency] || 1.0)), 
        owner: selectedExpOwner,
        receiptImg: "", 
        timestamp: new Date().getTime()
    };

    data.push(newEntry);

    await saveData('tripExpenses', data);
    
    alert("✅ 費用已入帳");
    resetExpForm();
    await switchExpView('details'); 
}

/**
 * 刪除記帳
 */
async function deleteExpenseV2(id) {
    if (!confirm("確定要刪除這筆記帳嗎？")) return;
    
    let data = await fetchData('tripExpenses', '[]');
    const newData = data.filter(item => item.id !== id);
    
    await saveData('tripExpenses', newData);
    await renderExpensesV2(); 
}

function resetExpForm() {
    const noteEl = document.getElementById('ev2-note');
    const krwEl = document.getElementById('ev2-krw');
    if (noteEl) noteEl.value = "";
    if (krwEl) krwEl.value = "";
}

/* --- 7. 明細渲染與分組統計 --- */

async function switchDetailTab(owner) {
    currentDetailOwner = owner;
    isExpUnlocked = false; 
    collapsedDays = {}; 
    await renderDetailTabs();
    await renderExpensesV2();
}

/**
 * 渲染公費/個人分頁標籤
 */
async function renderDetailTabs() {
    const container = document.getElementById('exp-subtab-list');
    if (!container) return;
    
    const editors = await fetchData('editorList', '[]');
    
    let html = `<div class="exp-subtab ${currentDetailOwner === 'public' ? 'active' : ''}" onclick="switchDetailTab('public')">🌐 公費</div>`;
    
    editors.forEach(name => {
        html += `<div class="exp-subtab ${currentDetailOwner === name ? 'active' : ''}" onclick="switchDetailTab('${name}')">👤 ${name}</div>`;
    });
    container.innerHTML = html;
}

function toggleDayExp(date) {
    collapsedDays[date] = !collapsedDays[date];
    renderExpensesV2();
}

/**
 * 【核心渲染】渲染記帳明細列表
 */
async function renderExpensesV2() {
    const listContainer = document.getElementById('expense-list-v2');
    const statsCard = document.getElementById('exp-stats-card');
    const currentUser = (localStorage.getItem('currentUser') || "").trim();
    
    if (!listContainer) return;

    // 判斷是否被密碼鎖定
    const isLocked = (currentDetailOwner !== 'public' && currentDetailOwner !== currentUser && !isExpUnlocked);

    if (isLocked) {
        if (statsCard) statsCard.style.display = 'none';
        listContainer.innerHTML = `
            <div class="lock-zone flex flex-col items-center justify-center py-10">
                <div class="lock-card">
                    <div class="lock-emoji">🔐</div>
                    <div class="lock-title">這是 ${currentDetailOwner} 的帳目</div>
                    <div class="lock-subtitle">請輸入該旅伴的密碼以解鎖</div>
                    
                    <input type="password" id="exp-lock-pwd" class="lock-input" placeholder="輸入解鎖密碼">
                    
                    <button onclick="unlockPersonalExp()" class="exp-lock-btn">
                        解鎖查看
                    </button>
                </div>
            </div>`;
        return;
    }

    if (statsCard) statsCard.style.display = 'flex';

    let data = await fetchData('tripExpenses', '[]');
    let filtered = data.filter(item => item.owner === currentDetailOwner);
    filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

    // 計算分幣別總額統計
    const curTotals = { KRW: 0, TWD: 0, USD: 0 };
    filtered.forEach(item => {
        if (curTotals.hasOwnProperty(item.currency)) {
            curTotals[item.currency] += Number(item.originalAmount || 0);
        }
    });

    let statsHtml = "";
    if (curTotals.TWD > 0) statsHtml += `<div class="stats-row"><span>NT$</span><span class="stats-num">${curTotals.TWD.toLocaleString()}</span></div>`;
    if (curTotals.KRW > 0) statsHtml += `<div class="stats-row"><span>KRW$</span><span class="stats-num">${curTotals.KRW.toLocaleString()}</span></div>`;
    if (curTotals.USD > 0) statsHtml += `<div class="stats-row"><span>USD$</span><span class="stats-num">${curTotals.USD.toLocaleString()}</span></div>`;
    if (!statsHtml) statsHtml = '<div class="stats-row"><span>NT$</span><span class="stats-num">0</span></div>';  

    const totalEl = document.getElementById('exp-stats-total');
    const countEl = document.getElementById('exp-stats-count');
    if (totalEl) totalEl.innerHTML = statsHtml;
    if (countEl) countEl.innerText = `共 ${filtered.length} 筆`;

    if (filtered.length === 0) {
        listContainer.innerHTML = `<div class="text-center py-20 text-gray-300"><div class="text-5xl mb-4">🍃</div><div class="text-sm">尚無記帳記錄</div></div>`;
        return;
    }

    // 分日期群組化渲染
    const groups = {};
    filtered.forEach(item => {
        if (!groups[item.date]) groups[item.date] = [];
        groups[item.date].push(item);
    });

    let html = '';
    Object.keys(groups).forEach(date => {
        const items = groups[date];
        const daySum = items.reduce((s, i) => s + Number(i.amount || 0), 0);
        const isCollapsed = collapsedDays[date] || false;
        
        html += `
            <div class="exp-day-card">
                <div class="exp-day-header" onclick="toggleDayExp('${date}')">
                    <div class="exp-day-title"><span>${isCollapsed ? '▶' : '▼'}</span>📅 ${date}</div>
                    <div class="exp-day-sum">本日小計 約合 NT$ ${daySum.toLocaleString()}</div>
                </div>
                <div class="exp-day-body ${isCollapsed ? 'collapsed' : ''}">
                    ${items.map(item => {
                        const canDelete = (
                            (item.payer || "").trim() === currentUser || 
                            (item.owner || "").trim() === currentUser || 
                            item.owner === 'public'
                        );

                        const photoContent = item.receiptImg ? 
                            `<img src="${item.receiptImg}" class="ledger-receipt-thumb" onclick="openLightbox(null, null, '${item.receiptImg}', {type:'expense', id:${item.id}})">` : 
                            `<label class="ledger-receipt-btn cursor-pointer">📷<input type="file" class="hidden" accept="image/*" onchange="updateExpensePhoto(${item.id}, this)"></label>`;
                        
                        return `
                            <div class="ledger-row">
                                <div class="ledger-left">
                                    <div class="ledger-note">${item.note}</div>
                                    <div class="ledger-meta">${item.payer} 墊付</div>
                                </div>
                                <div class="ledger-right-group">
                                    <div class="ledger-price">${Number(item.originalAmount || 0).toLocaleString()} <span class="text-[10px] opacity-60 ml-1">${item.currency}</span></div>
                                    ${photoContent}
                                    ${canDelete ? `<button onclick="deleteExpenseV2(${item.id})" class="ledger-delete-btn">✕</button>` : '<div class="w-7"></div>'}
                                </div>
                            </div>`;
                    }).join('')}
                </div>
            </div>`;
    });
    listContainer.innerHTML = html;
}

/**
 * 解鎖個人帳目視圖 (修復為從雲端拿取對方的密碼紀錄)
 */
async function unlockPersonalExp() {
    const pwdInputEl = document.getElementById('exp-lock-pwd');
    const pwdInput = pwdInputEl ? pwdInputEl.value : "";

    if (!pwdInput) return alert("請輸入密碼");
    
    // 從雲端讀取對方的註冊資料進行驗證
    const userData = await fetchData(`user_${currentDetailOwner}`, 'null');
    
    if (userData && btoa(pwdInput) === userData.password) {
        isExpUnlocked = true;
        await renderExpensesV2();
    } else {
        alert("密碼錯誤，無法解鎖私人帳目！");
    }
}

/* --- 8. 事件監聽 --- */
document.addEventListener('DOMContentLoaded', async () => {
    if (document.getElementById('tab-expense')) {
        await initExpenseFormV2();
        await switchExpView('entry');
    }
});