/**
 * ==============================================================================
 * [檔案名稱] expense.js
 * [功能描述] 記帳與開支管理系統：包含多幣別換算、公費/私人分帳、照片收據管理與加密解鎖
 * [工程師] Senior Front-end Engineer (10+ Years Exp)
 * [更新內容] 修正公費項目刪除權限、更新解鎖卡片 UI 結構為目標設計格式
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

// 匯率定義：KRW、USD 對 TWD 的匯率
const rates = JSON.parse(localStorage.getItem('tripRates') || '{"KRW":0.024, "USD":32.5, "TWD":1.0}');

/* --- 2. 視圖切換路由 --- */
function switchExpView(view) {
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
        renderDetailTabs();
        renderExpensesV2();
        window.scrollTo({ top: 0, behavior: 'auto' });
    } else {
        initExpenseFormV2();
        window.scrollTo({ top: 0, behavior: 'auto' });
    }
}

/* --- 3. 影像處理函式 (收據管理) --- */
async function updateExpensePhoto(id, input) {
    if (!input.files || !input.files[0]) return;
    try {
        // 使用 utils 進行圖片壓縮，設定 1200px 寬度平衡清晰度與儲存空間
        const compressedBase64 = await utils.compressImage(input.files[0], 1200, 0.8);
        let data = JSON.parse(localStorage.getItem('tripExpenses') || '[]');
        const idx = data.findIndex(item => item.id === id);
        if (idx !== -1) {
            data[idx].receiptImg = compressedBase64;
            localStorage.setItem('tripExpenses', JSON.stringify(data));
            renderExpensesV2();
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
function deleteExpensePhoto(id) {
    let data = JSON.parse(localStorage.getItem('tripExpenses') || '[]');
    const idx = data.findIndex(item => item.id === id);
    if (idx !== -1) {
        data[idx].receiptImg = ""; 
        localStorage.setItem('tripExpenses', JSON.stringify(data));
        // 若燈箱開啟中，則關閉
        const lightbox = document.getElementById('trans-lightbox');
        if (lightbox) lightbox.classList.remove('active');
        renderExpensesV2();
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
 * 初始化記帳表單 (載入成員清單、預設日期等)
 */
function initExpenseFormV2() {
    const payerContainer = document.getElementById('ev2-payer-list');
    const ownerContainer = document.getElementById('ev2-owner-list');
    const dateInput = document.getElementById('ev2-date');
    const editors = JSON.parse(localStorage.getItem('editorList') || '[]');
    const currentUser = (localStorage.getItem('currentUser') || "").trim();

    // 初始化日期
    if (dateInput && typeof days !== 'undefined' && days[currentDay-1]) {
        const storedStartDate = localStorage.getItem('startDate');
        const year = storedStartDate ? storedStartDate.split('-')[0] : new Date().getFullYear();
        const monthDay = days[currentDay-1].replace('.', '-');
        dateInput.value = `${year}-${monthDay}`;
    }

    // 渲染支付者清單
    if (payerContainer) {
        if (!selectedPayer) selectedPayer = currentUser;
        let payerHtml = '';
        editors.forEach(name => {
            payerHtml += `<div class="exp-member-pill ${selectedPayer === name ? 'active' : ''}" onclick="selectPayer(this, '${name}')">👤 ${name}</div>`;
        });
        payerContainer.innerHTML = payerHtml;
    }

    // 渲染歸屬者清單 (公費 + 所有成員)
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
function saveExpenseV2() {
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

    const data = JSON.parse(localStorage.getItem('tripExpenses') || '[]');
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
    localStorage.setItem('tripExpenses', JSON.stringify(data));
    alert("✅ 費用已入帳");
    resetExpForm();
    switchExpView('details'); 
}

/**
 * 刪除記帳
 */
function deleteExpenseV2(id) {
    if (!confirm("確定要刪除這筆記帳嗎？")) return;
    let data = JSON.parse(localStorage.getItem('tripExpenses') || '[]');
    const newData = data.filter(item => item.id !== id);
    localStorage.setItem('tripExpenses', JSON.stringify(newData));
    renderExpensesV2(); 
}

function resetExpForm() {
    const noteEl = document.getElementById('ev2-note');
    const krwEl = document.getElementById('ev2-krw');
    if (noteEl) noteEl.value = "";
    if (krwEl) krwEl.value = "";
}

/* --- 7. 明細渲染與分組統計 --- */

function switchDetailTab(owner) {
    currentDetailOwner = owner;
    isExpUnlocked = false; 
    collapsedDays = {}; 
    renderDetailTabs();
    renderExpensesV2();
}

/**
 * 渲染公費/個人分頁標籤
 */
function renderDetailTabs() {
    const container = document.getElementById('exp-subtab-list');
    if (!container) return;
    const editors = JSON.parse(localStorage.getItem('editorList') || '[]');
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
function renderExpensesV2() {
    const listContainer = document.getElementById('expense-list-v2');
    const statsCard = document.getElementById('exp-stats-card');
    const currentUser = (localStorage.getItem('currentUser') || "").trim();
    
    if (!listContainer) return;

    // 關鍵：修正重複宣告問題，將判斷邏輯整併
    const isLocked = (currentDetailOwner !== 'public' && currentDetailOwner !== currentUser && !isExpUnlocked);

    if (isLocked) {
        if (statsCard) statsCard.style.display = 'none';
        // 更新為計畫書 B 指定的卡片結構
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

    let data = JSON.parse(localStorage.getItem('tripExpenses') || '[]');
    let filtered = data.filter(item => item.owner === currentDetailOwner);
    filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

    // 4. 計算分幣別總額統計
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

    // 5. 分日期群組化渲染
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
                        // 只要是自己墊付的，或是該項目的歸屬者，或是公費項目的檢視，都應該能看到刪除鍵
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
 * 解鎖個人帳目視圖
 */
function unlockPersonalExp() {
    const userData = JSON.parse(localStorage.getItem(`user_${currentDetailOwner}`));
    const pwdInputEl = document.getElementById('exp-lock-pwd');
    const pwdInput = pwdInputEl ? pwdInputEl.value : "";

    if (!pwdInput) return alert("請輸入密碼");
    
    // 使用 Base64 比對加密後的密碼
    if (userData && btoa(pwdInput) === userData.password) {
        isExpUnlocked = true;
        renderExpensesV2();
    } else {
        alert("密碼錯誤，無法解鎖私人帳目！");
    }
}

/* --- 8. 事件監聽 --- */
document.addEventListener('DOMContentLoaded', () => {
    // 確保在開支分頁時執行初始化
    if (document.getElementById('tab-expense')) {
        initExpenseFormV2();
        // 預設回到記帳輸入視圖
        switchExpView('entry');
    }
});