/* --- prep.js --- */

/* ==========================================
   1. 數據模板 (扁平化結構)
   ========================================== */
const MASTER_PUBLIC_TEMPLATE = [
    { title: "✈️ 機票", isCollapsed: false, items: [{ text: "購買機票", done: false }, { text: "預辦登機", done: false }] },
    { title: "🛡️ 保險", isCollapsed: false, items: [{ text: "旅平險", done: false }, { text: "不便險", done: false }] },
    { title: "🏨 住宿", isCollapsed: false, items: [{ text: "訂房", done: false }, { text: "向飯店確認訂單", done: false }] },
    { title: "🚌 交通", isCollapsed: false, items: [{ text: "交通卡", done: false }, { text: "T-Money", done: false }, { text: "氣候卡", done: false }, { text: "悠遊卡", done: false }, { text: "台灣車票", done: false }] },
    { title: "🎟️ 門票/憑證", isCollapsed: false, items: [] },
    { title: "📱 APP", isCollapsed: false, items: [] }
];

const MASTER_PRIVATE_TEMPLATE = [
    { title: "🛂 重要文件", isCollapsed: false, items: [{ text: "護照", done: false }, { text: "身分證", done: false }, { text: "入境卡", done: false }, { text: "列印飯店的預訂單", done: false }, { text: "列印來回機票", done: false }] },
    { title: "💰 金錢", isCollapsed: false, items: [{ text: "當地貨幣", done: false }, { text: "信用卡", done: false }] },
    { title: "👕 衣物用品", isCollapsed: false, items: [{ text: "外套", done: false }, { text: "衣服", done: false }, { text: "內衣褲", done: false }, { text: "襪子", done: false }, { text: "睡衣", done: false }, { text: "帽子", done: false }] },
    { title: "💄 保養/彩妝", isCollapsed: false, items: [{ text: "防曬", done: false }, { text: "護唇膏", done: false }, { text: "卸妝棉", done: false }, { text: "護手霜/身體乳", done: false }] },
    { title: "🛀 盥洗用品", isCollapsed: false, items: [{ text: "浴巾", done: false }, { text: "護髮乳", done: false }, { text: "洗面乳", done: false }, { text: "牙刷牙膏", done: false }, { text: "梳子", done: false }, { text: "拖鞋", done: false }, { text: "除毛刀", done: false }] },
    { title: "🧻 衛生用品", isCollapsed: false, items: [{ text: "面紙", done: false }, { text: "濕紙巾", done: false }, { text: "衛生棉", done: false }, { text: "口罩", done: false }, { text: "酒精噴瓶", done: false }, { text: "棉花棒", done: false }] },
    { title: "💻 3C 產品", isCollapsed: false, items: [{ text: "充電線", done: false }, { text: "轉接頭", done: false }, { text: "行動電源", done: false }, { text: "藍芽耳機", done: false }, { text: "漫遊/ESIM/網卡", done: false }] },
    { title: "💊 常備藥品", isCollapsed: false, items: [{ text: "胃藥", done: false }, { text: "止痛藥", done: false }, { text: "B群", done: false }, { text: "暈車藥", done: false }] },
    { title: "⛱️ 夏季/防曬", isCollapsed: false, items: [{ text: "抗uv摺疊傘", done: false }, { text: "手持風扇", done: false }, { text: "退熱貼", done: false }, { text: "涼感濕紙巾", done: false }, { text: "涼感噴霧", done: false }, { text: "冰袖", done: false }, { text: "涼感防曬", done: false }] },
    { title: "❄️ 冬季/防寒", isCollapsed: false, items: [{ text: "暖暖包", done: false }, { text: "圍巾", done: false }, { text: "手套", done: false }, { text: "摺疊傘", done: false }] },
    { title: "📦 其他雜物", isCollapsed: false, items: [{ text: "抽取式衛生紙/紙巾", done: false }, { text: "塑膠袋/夾鏈袋", done: false }, { text: "行李秤", done: false }, { text: "水壺/保溫瓶", done: false }, { text: "筆", done: false }] }
];

/* ==========================================
   2. 狀態管理與渲染 (核心優化：鎖定介面結構)
   ========================================== */
let activePrepOwner = 'public'; 
let editingCatIdx = null; 
let isUnlocked = false; 

if (typeof AppRuntime === 'undefined') window.AppRuntime = {};

function renderPrep() {
    renderPrepNav(); // 先渲染旅伴列
    const container = document.getElementById('prep-list-container');
    if (!container) return;

    const currentUser = (localStorage.getItem('currentUser') || "").trim();
    const isLocked = (activePrepOwner !== 'public' && activePrepOwner !== currentUser && !isUnlocked);

    // 修改點 B：更新鎖定 HTML 結構
    if (isLocked) {
        container.innerHTML = `
            <div class="lock-zone flex flex-col items-center justify-center pt-2 pb-12">
                <div class="lock-card">
                    <!-- 使用與計畫書描述一致的鎖頭圖示與自定義 Class -->
                    <div class="lock-emoji">🔐</div>
                    <div class="lock-title">這是 ${activePrepOwner} 的私人清單</div>
                    <div class="lock-subtitle">請輸入該旅伴的密碼以解鎖</div>
                    
                    <input type="password" id="prep-lock-pwd" class="lock-input" placeholder="輸入解鎖密碼">
                    
                    <button onclick="prepEngine.unlock('${activePrepOwner}')" class="prep-lock-btn">
                        解鎖查看
                    </button>
                </div>
            </div>`;
        return;
    }

    // 若解鎖，執行正常渲染
    let data = prepEngine._getData();
    let html = `<div class="space-y-2">`;
    
    data.forEach((cat, cIdx) => {
        const isEditing = (editingCatIdx === cIdx);
        const doneCount = cat.items.filter(i => i.done).length;
        const totalCount = cat.items.length;

        html += `
        <div class="prep-l1-card">
            <div class="prep-l1-header" onclick="${isEditing ? '' : `prepEngine.toggleCat(${cIdx})`}">
                <div class="flex items-center gap-2">
                    <span class="text-[17px] font-bold text-gray-800">${cat.title}</span>
                    <span class="text-[10px] text-gray-400 font-bold bg-gray-100 px-1.5 py-0.5 rounded">${doneCount}/${totalCount}</span>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="event.stopPropagation(); prepEngine.deleteItem(${cIdx})" class="prep-action-btn text-red-400 ${isEditing ? 'flex' : 'hidden'}">🗑️</button>
                    <button onclick="event.stopPropagation(); prepEngine.toggleCardEdit(${cIdx})" class="prep-action-btn prep-edit-icon">${isEditing ? '💾' : '✎'}</button>
                    <svg class="w-4 h-4 text-gray-300 transition-transform ${cat.isCollapsed ? '' : 'rotate-180'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg>
                </div>
            </div>
            <div class="${cat.isCollapsed && !isEditing ? 'hidden' : 'block'} p-4 pt-0">
                <div class="divide-y divide-gray-50">
                    ${cat.items.map((itm, iIdx) => `
                        <div class="prep-l3-item" onclick="${isEditing ? '' : `prepEngine.toggleItem(${cIdx}, ${iIdx})`}">
                            <div class="prep-checkbox ${itm.done ? 'checked' : ''}"></div>
                            <span class="prep-l3-text flex-1 ${itm.done ? 'is-done' : ''}">${itm.text}</span>
                            ${isEditing ? `<button onclick="prepEngine.deleteItem(${cIdx}, ${iIdx})" class="text-gray-300 px-2">✕</button>` : ''}
                        </div>
                    `).join('')}
                </div>
                ${isEditing ? `
                    <div class="mt-2">
                        <input type="text" placeholder="+ 新增項目..." class="prep-inline-input" onkeyup="if(event.key==='Enter') { prepEngine.addItem(${cIdx}, this.value); this.value=''; }">
                    </div>
                ` : ''}
            </div>
        </div>`;
    });

    html += `<button onclick="prepEngine.addCategory()" class="prep-add-global-btn">+ 新增分類卡片</button>`;
    html += `</div>`;
    container.innerHTML = html;
}

/* ==========================================
   3. 互動邏輯 (CRUD)
   ========================================== */
const prepEngine = {
    _getData: function() {
        if (activePrepOwner === 'public') {
            let data = JSON.parse(localStorage.getItem('publicPrep') || '[]');
            if (data.length === 0) { 
                data = JSON.parse(JSON.stringify(MASTER_PUBLIC_TEMPLATE));
                localStorage.setItem('publicPrep', JSON.stringify(data));
            }
            return data;
        }
        const userData = JSON.parse(localStorage.getItem(`user_${activePrepOwner}`));
        return (userData && userData.prep) ? userData.prep : [];
    },
    
    _saveData: function(data) {
        if (activePrepOwner === 'public') {
            localStorage.setItem('publicPrep', JSON.stringify(data));
        } else {
            const userData = JSON.parse(localStorage.getItem(`user_${activePrepOwner}`));
            if (userData) {
                userData.prep = data;
                localStorage.setItem(`user_${activePrepOwner}`, JSON.stringify(userData));
            }
        }
    },

    unlock: function(owner) {
        const userData = JSON.parse(localStorage.getItem(`user_${owner}`));
        const input = document.getElementById('prep-lock-pwd').value;
        if (userData && btoa(input) === userData.password) {
            isUnlocked = true;
            renderPrep();
        } else {
            alert("密碼錯誤！");
        }
    },

    initPrivatePrep: function() {
        const user = localStorage.getItem('currentUser');
        if (!user) return;
        const userData = JSON.parse(localStorage.getItem(`user_${user}`));
        if (!userData) return;
        userData.prep = JSON.parse(JSON.stringify(MASTER_PRIVATE_TEMPLATE));
        localStorage.setItem(`user_${user}`, JSON.stringify(userData));
        isUnlocked = true;
        switchPrepTab(user);
    },

    toggleCardEdit: function(idx) {
        editingCatIdx = (editingCatIdx === idx) ? null : idx;
        renderPrep();
    },

    toggleCat: function(cIdx) {
        const data = this._getData();
        data[cIdx].isCollapsed = !data[cIdx].isCollapsed;
        this._saveData(data);
        renderPrep();
    },

    toggleItem: function(cIdx, iIdx) {
        const data = this._getData();
        data[cIdx].items[iIdx].done = !data[cIdx].items[iIdx].done;
        this._saveData(data);
        renderPrep();
    },

    addItem: function(cIdx, val) {
        if (!val.trim()) return;
        const data = this._getData();
        data[cIdx].items.push({ text: val.trim(), done: false });
        this._saveData(data);
        renderPrep();
    },

    addCategory: function() {
        const val = prompt("請輸入分類名稱：");
        if (!val) return;
        const data = this._getData();
        data.push({ title: val, isCollapsed: false, items: [] });
        this._saveData(data);
        renderPrep();
    },

    deleteItem: function(cIdx, iIdx = null) {
        if (!confirm("確定要刪除嗎？")) return;
        const data = this._getData();
        if (iIdx !== null) {
            data[cIdx].items.splice(iIdx, 1);
        } else {
            data.splice(cIdx, 1);
            editingCatIdx = null;
        }
        this._saveData(data);
        renderPrep();
    }
};

/* ==========================================
   4. 導覽列與分頁邏輯 (重構：靜默初始化)
   ========================================== */
function renderPrepNav() {
    const nav = document.getElementById('prep-nav-list');
    if (!nav) return;
    
    const editors = JSON.parse(localStorage.getItem('editorList') || '[]');
    const currentUser = (localStorage.getItem('currentUser') || "").trim();
    
    if (currentUser) {
        const myData = JSON.parse(localStorage.getItem(`user_${currentUser}`));
        if (myData && (!myData.prep || myData.prep.length === 0)) {
            myData.prep = JSON.parse(JSON.stringify(MASTER_PRIVATE_TEMPLATE));
            localStorage.setItem(`user_${currentUser}`, JSON.stringify(myData));
        }
    }

    let html = `
        <div class="prep-tab ${activePrepOwner === 'public' ? 'active' : ''}" 
             onclick="switchPrepTab('public')">全體</div>
    `;

    editors.forEach(name => {
        const userData = JSON.parse(localStorage.getItem(`user_${name}`));
        const hasPrepData = userData && userData.prep && userData.prep.length > 0;
        if (hasPrepData || activePrepOwner === name) {
            html += `
                <div class="prep-tab ${activePrepOwner === name ? 'active' : ''}" 
                     onclick="switchPrepTab('${name}')">${name}</div>
            `;
        }
    });
    nav.innerHTML = html;
}

function switchPrepTab(owner) {
    activePrepOwner = owner;
    editingCatIdx = null;
    const currentUser = (localStorage.getItem('currentUser') || "").trim();
    if (owner === 'public' || owner === currentUser) {
        isUnlocked = true;
    } else {
        isUnlocked = false;
    }
    renderPrep();
}