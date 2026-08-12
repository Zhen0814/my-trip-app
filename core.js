/**
 * ==============================================================================
 * [檔案名稱] core.js
 * [功能描述] WebApp 核心控制中心：對接 Supabase 雲端資料庫與實時同步機制
 * [工程師] Senior Front-end Engineer (10+ Years Exp)
 * [更新內容] 徹底實作 fetchData/saveData 雲端化，導入 Supabase Realtime Sync
 * ==============================================================================
 */

/* --- core.js 頂部效能與警告優化 --- */
(function() {
    const originalWarn = console.warn;
    console.warn = (...args) => {
        // 屏蔽 Tailwind CDN 生產環境警告
        if (typeof args[0] === 'string' && args[0].includes('cdn.tailwindcss.com')) return;
        originalWarn.apply(console, args);
    };
})();

/* ==========================================
   1. 雲端控管大腦 (Supabase Configuration)
   ========================================== */
const CLOUD_CONFIG = {
    useCloud: true, 
    // Supabase 專案資訊
    endpoint: 'https://ifermcurjgpxphchlzub.supabase.co', 
    apiKey: 'sb_publishable_SzhvuztkkmzJGgxfQKxhHA_oSIjpsTV' 
};

// 初始化 Supabase 連線
const supabase = window.supabase.createClient(CLOUD_CONFIG.endpoint, CLOUD_CONFIG.apiKey);

/* ==========================================
   2. 全域變數 (Global State)
   ========================================== */
let currentDay = 1;
let days = []; // 儲存格式如 ["08.13", "08.14", ...]

// 備註圖示顏色映射表 (11 色補完版)
const colorMap = { 
    '📌': 'note-purple', '⌛': 'note-blue', '📢': 'note-yellow',
    '‼️': 'note-red', '📸': 'note-green', '🍀': 'note-teal',   
    '⚡': 'note-amber', '▶️': 'note-indigo', '🍹': 'note-orange', 
    '🍴': 'note-brown', '💕': 'note-pink'    
};

/* ==========================================
   3. 雲端資料存取層 (Data Access Layer - Supabase)
   ========================================== */

/**
 * 雲端連線狀態指示燈控制
 */
function updateCloudStatus(isOnline) {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (!dot || !text) return;
    
    if (isOnline) {
        dot.className = 'w-2 h-2 rounded-full bg-green-400 shadow-[0_0_5px_rgba(74,222,128,0.5)]';
        text.innerText = 'ONLINE';
        text.className = 'text-[9px] font-bold text-green-500';
    } else {
        dot.className = 'w-2 h-2 rounded-full bg-gray-300';
        text.innerText = 'OFFLINE';
        text.className = 'text-[9px] font-bold text-gray-400';
    }
}

/**
 * 統一的資料讀取器 (fetchData)
 */
async function fetchData(key, defaultValue = '[]') {
    if (!CLOUD_CONFIG.useCloud) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : JSON.parse(defaultValue);
    }

    try {
        // 雲端獲取
        const { data, error } = await supabase
            .from('trip_data')
            .select('content')
            .eq('key', key)
            .single();

        if (error || !data) {
            console.log(`Fetch: [${key}] 無雲端紀錄，使用預設值。`);
            return JSON.parse(defaultValue);
        }
        
        updateCloudStatus(true);
        return data.content;
    } catch (e) {
        console.error(`Fetch Error [${key}]:`, e);
        return JSON.parse(defaultValue);
    }
}

/**
 * 統一的資料寫入器 (saveData)
 */
async function saveData(key, data) {
    const loader = document.getElementById('global-loader');
    if (loader) loader.classList.remove('hidden');
    
    try {
        if (!CLOUD_CONFIG.useCloud) {
            localStorage.setItem(key, JSON.stringify(data));
        } else {
            // 雲端 Upsert (有則更新，無則新增)
            const { error } = await supabase
                .from('trip_data')
                .upsert({ key: key, content: data }, { onConflict: 'key' });
            
            if (error) throw error;
            updateCloudStatus(true);
        }
    } catch (e) {
        console.error(`Save Error [${key}]:`, e);
        updateCloudStatus(false);
    }
    
    // 模擬行動端同步感與視覺緩衝
    return new Promise(resolve => {
        setTimeout(() => {
            if (loader) loader.classList.add('hidden');
            resolve(true);
        }, 500);
    });
}

/* ==========================================
   4. 初始化與實時同步 (Initialization & Sync)
   ========================================== */

window.onload = async () => { 
    // 屏蔽 Tailwind CDN 生產環境警告 (重複確保)
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        const warn = console.warn;
        console.warn = (...args) => {
            if (args[0] && args[0].includes('should not be used in production')) return;
            warn(...args);
        };
    }

    auth.init(); 
    await loadTripSettings(); 
    
    if (typeof initDays === 'function') initDays(); 
    if (typeof renderList === 'function') renderList(); 
    
    await loadDailyData(); 
    
    if (typeof renderExpensesV2 === 'function') renderExpensesV2();
    if (typeof renderPrep === 'function') renderPrep();
    if (typeof renderGuide === 'function') renderGuide();
    if (typeof renderQuotes === 'function') renderQuotes();

    // 啟動實時監聽
    initRealtimeSync();
};

/**
 * 實時同步監聽器：達成多人異步協作
 */
function initRealtimeSync() {
    if (!CLOUD_CONFIG.useCloud) return;

    supabase
        .channel('trip_sync_channel')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trip_data' }, payload => {
            const updatedKey = payload.new.key;
            console.log(`⚡ 偵測到雲端更新: ${updatedKey}`);
            
            // 根據更新的資料類型，自動重新渲染畫面，不需重新整理
            if (updatedKey === 'schedule') {
                if (typeof renderList === 'function') renderList();
            }
            if (updatedKey === 'tripExpenses') {
                if (typeof renderExpensesV2 === 'function') renderExpensesV2();
            }
            if (updatedKey === 'dailyData') {
                if (typeof loadDailyData === 'function') loadDailyData();
            }
            if (updatedKey === 'prep_items') {
                if (typeof renderPrep === 'function') renderPrep();
            }
            if (updatedKey.includes('guide_tiles')) {
                if (typeof renderGuide === 'function') renderGuide();
            }
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') updateCloudStatus(true);
        });
}

/* ==========================================
   5. 全域身份中心邏輯 (Identity Hub)
   ========================================== */
const auth = {
    init: function() {
        const currentUser = localStorage.getItem('currentUser');
        if (!currentUser) {
            document.body.classList.add('auth-locked');
            const overlay = document.getElementById('identity-overlay');
            if (overlay) overlay.classList.remove('hidden');
        } else {
            const displayEl = document.getElementById('user-display');
            if (displayEl) displayEl.innerText = currentUser;
            document.body.classList.remove('auth-locked');
            const overlay = document.getElementById('identity-overlay');
            if (overlay) overlay.classList.add('hidden');
        }
    },

    register: async function() {
        const nameInput = document.getElementById('reg-nickname');
        const pwdInput = document.getElementById('reg-password');
        const name = nameInput ? nameInput.value.trim() : "";
        const pwd = pwdInput ? pwdInput.value : "";

        if (!name || name.length < 2) return alert("旅伴暱稱至少需要 2 個字");
        if (!pwd) return alert("請設定存取密碼");

        const userData = {
            nickname: name,
            password: btoa(pwd),
            createdAt: new Date().getTime()
        };

        await saveData(`user_${name}`, userData);
        // 本地身分識別仍需存於 localStorage 作為裝置標記
        localStorage.setItem('currentUser', name);
        localStorage.setItem('nickname', name);
        
        if (typeof addToEditorList === 'function') await addToEditorList(name);
        location.reload();
    },

    isOwner: function(targetName) {
        const current = localStorage.getItem('currentUser');
        return current === (targetName || "").trim();
    },

    logout: function() {
        if (confirm("登出後需重新輸入密碼才能存取旅程資料，確定登出？")) {
            localStorage.removeItem('currentUser');
            location.reload();
        }
    },

    deleteAccount: async function() {
        const user = localStorage.getItem('currentUser');
        if (!user) return;

        if (confirm(`警告：您正在註銷「${user}」的帳號。\n私人清單與支出紀錄將永久刪除且無法復原。`)) {
            if (prompt(`請輸入暱稱「${user}」確認：`) !== user) return alert("輸入錯誤");

            document.getElementById('global-loader').classList.remove('hidden');

            // 雲端資料刪除通常由後端處理，此處模擬清理
            await supabase.from('trip_data').delete().eq('key', `user_${user}`);
            await supabase.from('trip_data').delete().eq('key', `guide_tiles_${user}`);

            let expenses = await fetchData('tripExpenses', '[]');
            expenses = expenses.filter(item => item.owner !== user);
            await saveData('tripExpenses', expenses);

            let editors = await fetchData('editorList', '[]');
            editors = editors.filter(e => e !== user);
            await saveData('editorList', editors);

            localStorage.removeItem('currentUser');
            localStorage.removeItem('nickname');

            setTimeout(() => { location.reload(); }, 600);
        }
    }
};

/* ==========================================
   6. 導覽列與分頁控制 (UI Control)
   ========================================== */
function showPage(pageId, btnEl) {
    document.body.setAttribute('data-page', pageId);
    document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
    const targetPage = document.getElementById(`tab-${pageId}`);
    if (targetPage) targetPage.classList.remove('hidden');
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    const globalAddBtn = document.getElementById('global-add-btn');
    if (globalAddBtn) {
        if (pageId === 'schedule') { 
            globalAddBtn.classList.remove('hidden');
            globalAddBtn.style.display = 'flex';
            globalAddBtn.setAttribute('onclick', 'openModal()'); 
        } else { 
            globalAddBtn.classList.add('hidden');
            globalAddBtn.style.display = 'none';
        }
    }

    if (pageId === 'expense' && typeof switchExpView === 'function') {
        switchExpView(typeof currentExpView !== 'undefined' ? currentExpView : 'entry');
    } else if (pageId === 'guide' && typeof switchGuideView === 'function') {
        switchGuideView(typeof currentGuideView !== 'undefined' ? currentGuideView : 'public');
    }
    
    window.scrollTo(0, 0);
}

/* ==========================================
   7. 旅程設定與匯率邏輯 (Settings Logic)
   ========================================== */
async function openSettings() {
    const overlay = document.getElementById('settings-overlay');
    if (overlay) overlay.classList.add('active');
    
    document.getElementById('set-nickname').value = localStorage.getItem('nickname') || "";
    document.getElementById('set-trip-title').value = localStorage.getItem('tripTitle') || "我要出去玩";
    document.getElementById('set-start-date').value = localStorage.getItem('startDate') || "2026-08-13";
    document.getElementById('set-end-date').value = localStorage.getItem('endDate') || "2026-08-18";
    document.getElementById('set-header-url').value = localStorage.getItem('headerImg') || "https://i.meee.com.tw/YTg8aFq.jpg";
    
    const offset = localStorage.getItem('headerOffset') || "50";
    document.getElementById('set-header-offset').value = offset;
    const scale = localStorage.getItem('headerScale') || "100";
    document.getElementById('set-header-scale').value = scale;

    const rates = await fetchData('tripRates', '{"KRW":0.024, "USD":32.5}');
    if (document.getElementById('set-rate-krw')) document.getElementById('set-rate-krw').value = rates.KRW;
    if (document.getElementById('set-rate-usd')) document.getElementById('set-rate-usd').value = rates.USD;
}

function closeSettings(e) { 
    if (!e || e.target.id === 'settings-overlay') {
        const overlay = document.getElementById('settings-overlay');
        if (overlay) overlay.classList.remove('active');
    }
}

async function saveGeneralSettings() {
    const sDate = document.getElementById('set-start-date').value;
    const eDate = document.getElementById('set-end-date').value;

    if (!sDate || !eDate) return alert("請選擇日期範圍");
    if (new Date(sDate) > new Date(eDate)) return alert("開始日期錯誤");

    const nickname = document.getElementById('set-nickname').value;
    
    // 基本設定存於本地與雲端同步
    localStorage.setItem('nickname', nickname);
    localStorage.setItem('tripTitle', document.getElementById('set-trip-title').value);
    localStorage.setItem('startDate', sDate);
    localStorage.setItem('endDate', eDate);
    localStorage.setItem('headerImg', document.getElementById('set-header-url').value);
    localStorage.setItem('headerOffset', document.getElementById('set-header-offset').value);
    localStorage.setItem('headerScale', document.getElementById('set-header-scale').value);
    
    // 匯率等重要共享資料必存雲端
    const newRates = {
        KRW: parseFloat(document.getElementById('set-rate-krw').value) || 0.024,
        USD: parseFloat(document.getElementById('set-rate-usd').value) || 32.5,
        TWD: 1.0
    };
    await saveData('tripRates', newRates);
    await saveData('tripTitle', document.getElementById('set-trip-title').value);
    
    if (nickname) await addToEditorList(nickname);
    alert("旅程設定已同步至雲端！");
    location.reload(); 
}

async function loadTripSettings() { 
    const title = localStorage.getItem('tripTitle') || '我要出去玩';
    if (document.getElementById('main-trip-title')) document.getElementById('main-trip-title').innerText = title; 
    
    const sDate = localStorage.getItem('startDate') || "2026-08-13";
    const eDate = localStorage.getItem('endDate') || "2026-08-18";
    calculateDaysArray(sDate, eDate);
    
    const rangeEl = document.getElementById('trip-date-range');
    if (rangeEl) rangeEl.innerText = `${formatFullDate(sDate)} - ${formatFullDate(eDate)}`;
    
    const h = document.getElementById('header-bg');
    if (h) {
        h.style.setProperty('--header-bg-img', `url('${localStorage.getItem('headerImg') || 'https://i.meee.com.tw/YTg8aFq.jpg'}')`);
        h.style.setProperty('--header-bg-pos-y', `${localStorage.getItem('headerOffset') || '50'}%`);
        h.style.setProperty('--header-bg-scale', `${localStorage.getItem('headerScale') || '100'}%`);
    }
}

/* ==========================================
   8. 日期運算工具
   ========================================== */
function calculateDaysArray(start, end) {
    const s = new Date(start);
    const e = new Date(end);
    const temp = [];
    let curr = new Date(s);
    while (curr <= e) {
        temp.push(`${String(curr.getMonth() + 1).padStart(2, '0')}.${String(curr.getDate()).padStart(2, '0')}`);
        curr.setDate(curr.getDate() + 1);
    }
    days = temp;
}

function getDayOfWeek(dateStr) {
    const d = new Date(dateStr);
    return ['週日', '週一', '週二', '週三', '週四', '週五', '週六'][d.getDay()];
}

function formatFullDate(dateStr) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} (${getDayOfWeek(dateStr)})`;
}

/* ==========================================
   9. 飯店與當日主題 (Daily Info)
   ========================================== */
async function saveDailyData() {
    const data = await fetchData('dailyData', '{}');
    data[currentDay] = { 
        title: document.getElementById('daily-status-title').innerText, 
        hotel: document.getElementById('hotel-name').innerText, 
        addr: document.getElementById('hotel-addr').innerText 
    };
    await saveData('dailyData', data);
    updateHotelLink();
}

async function loadDailyData() {
    const data = await fetchData('dailyData', '{}');
    const current = data[currentDay] || {};
    if (document.getElementById('daily-status-title')) document.getElementById('daily-status-title').innerText = current.title || '點擊輸入今日主題...';
    if (document.getElementById('hotel-name')) document.getElementById('hotel-name').innerText = current.hotel || '飯店名稱';
    if (document.getElementById('hotel-addr')) document.getElementById('hotel-addr').innerText = current.addr || '輸入地址或連結...';
    updateHotelLink();
}

function updateHotelLink() {
    const el = document.getElementById('hotel-addr');
    if (!el) return;
    el.href = el.innerText.startsWith('http') ? el.innerText : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(el.innerText)}`;
}

/* ==========================================
   10. 編輯者輔助邏輯
   ========================================== */
async function addToEditorList(name) {
    let list = await fetchData('editorList', '[]');
    if (!list.includes(name)) { 
        list.push(name); 
        await saveData('editorList', list); 
    }
}

/* ==========================================
   11. 全域工具工具 (Utilities)
   ========================================== */
const utils = {
    compressImage: function(file, maxSide = 1200, quality = 0.8) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width, height = img.height;
                    if (width > height && width > maxSide) { height *= maxSide / width; width = maxSide; }
                    else if (height > maxSide) { width *= maxSide / height; height = maxSide; }
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    },

    parseUrlTag: function(url) {
        if (!url || typeof url !== 'string' || !url.startsWith('http')) return null;
        try {
            const urlObj = new URL(url);
            const host = urlObj.hostname.replace('www.', ''); 
            let icon = '🔗', label = host; 
            if (host.includes('google.com') && url.includes('maps')) { icon = '📍'; label = 'Maps'; }
            else if (host.includes('naver')) { icon = '🗺️'; label = 'Naver'; }
            else if (host.includes('threads')) { icon = '💬'; label = 'Threads'; }
            else if (host.includes('instagram')) { icon = '📸'; label = 'IG'; }
            return { icon, label };
        } catch (e) { return null; }
    },

    autoTagUrls: function(text) {
        if (!text) return "";
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, (url) => {
            const info = this.parseUrlTag(url);
            if (!info) return url;
            return `<a class="link-pill" href="${url.trim()}" target="_blank" onclick="event.stopPropagation()"><span>${info.icon}</span><span>${info.label}</span></a>`;
        });
    }
};