/**
 * ==============================================================================
 * [檔案名稱] quotes.js
 * [功能描述] 旅遊短句管理系統：包含情境分類、韓文 TTS 語音、羅馬拼音顯示與全雲端 CRUD
 * [工程師] Senior Front-end Engineer (10+ Years Exp)
 * [更新內容] 升級為全雲端同步架構 (fetchData / saveData)
 * ==============================================================================
 */

/* --- 1. 預設資料與狀態管理 --- */
const DEFAULT_QUOTES_DATA = {
    "日常用語": [
        { id: 1, zh: "你好", ko: "안녕하세요", pron: "an-nyeong-ha-se-yo", en: "Hello." },
        { id: 2, zh: "謝謝", ko: "감사합니다", pron: "gam-sa-ham-ni-da", en: "Thank you." },
        { id: 3, zh: "不好意思", ko: "저기요", pron: "jeo-gi-yo", en: "Excuse me." },
        { id: 4, zh: "對不起", ko: "죄송합니다", pron: "joe-song-ham-ni-da", en: "I'm sorry." },
        { id: 5, zh: "不是/不用了", ko: "아니요", pron: "a-ni-yo", en: "No. / No, thank you." },
        { id: 6, zh: "是/好的", ko: "네", pron: "ne", en: "Yes. / Okay." }
    ],
    "購物": [
        { id: 7, zh: "需要袋子嗎？", ko: "봉투 필요하세요?", pron: "bong-tu pil-yo-ha-se-yo?", en: "Do you need a bag?" },
        { id: 8, zh: "需要收據嗎？", ko: "영수증 필요하세요?", pron: "yeong-su-jeung pil-yo-ha-se-yo?", en: "Do you need a receipt?" },
        { id: 9, zh: "這個是買一送一喔！", ko: "이거 1+1이에요", pron: "i-geo won peul-leo-seu won-i-e-yo", en: "This is buy one, get one free!" }
    ],
    "吃飯": [
        { id: 10, zh: "內用", ko: "여기서 먹을게요", pron: "yeo-gi-seo meo-geul-ge-yo", en: "For here, please." },
        { id: 11, zh: "外帶", ko: "포장해 주세요", pron: "po-jang-hae ju-se-yo", en: "Take out, please." }
    ]
};

let quotesData = null;           // 雲端抓取到的對話資料庫
let currentQuoteCat = null;      // 目前所在分類
let isQuotesEditing = false;    // 是否為編輯模式
let expandedQuoteId = null;     // 目前展開的短句 ID
let quoteSearchKey = "";        // 搜尋關鍵字

/* --- 2. 核心渲染邏輯 --- */

/**
 * 讀取雲端短句庫資料
 */
async function loadQuotesData() {
    let data = await fetchData('quotes', 'null');
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
        data = DEFAULT_QUOTES_DATA;
        await saveData('quotes', data);
    }
    quotesData = data;
}

/**
 * 渲染入口 (改為非同步)
 */
async function renderQuotes() {
    const container = document.getElementById('quote-view-container');
    if (!container) return;

    if (!quotesData) {
        await loadQuotesData();
    }

    if (!currentQuoteCat) {
        renderCategoryGrid(container);
    } else {
        renderPhraseList(container);
    }
}

/**
 * 1. 渲染情境方格 (外層)
 */
function renderCategoryGrid(container) {
    let html = `<div class="grid grid-cols-3 gap-3 mt-2">`;
    Object.keys(quotesData).forEach(cat => {
        const nameMatch = quoteSearchKey && cat.includes(quoteSearchKey);
        const contentMatch = quoteSearchKey && quotesData[cat].some(q => 
            q.zh.includes(quoteSearchKey) || q.en.toLowerCase().includes(quoteSearchKey.toLowerCase())
        );
        const isHit = nameMatch || contentMatch;
        
        html += `
            <div class="quote-tile relative ${isHit ? 'quote-hit' : ''}" onclick="enterQuoteCat('${cat}')">
                <div class="quote-tile-text">${cat}</div>
                ${isQuotesEditing ? `
                    <button onclick="event.stopPropagation(); deleteQuoteCat('${cat}')" 
                            class="absolute -top-2 -right-2 bg-red-400 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow-sm">✕</button>
                ` : ''}
            </div>`;
    });
    
    if (isQuotesEditing) {
        html += `
            <div class="quote-tile border-2 border-dashed border-gray-200 text-gray-300 flex items-center justify-center bg-white/50" 
                 onclick="addQuoteCat()">
                <span class="text-xl">＋</span>
            </div>`;
    }
    html += `</div>`;
    container.innerHTML = html;
}

/**
 * 2. 渲染短句列表 (內層)
 */
function renderPhraseList(container) {
    let html = `
        <div class="flex items-center gap-2 mb-3">
            <button onclick="exitQuoteCat()" class="text-[10px] font-bold text-gray-400 px-2 py-0.5 bg-white border border-gray-100 rounded-lg active:scale-95">❮ 返回</button>
            <h2 class="text-sm font-black text-[#d5a6bd]">${currentQuoteCat}</h2>
        </div>`;
    
    const currentList = quotesData[currentQuoteCat] || [];
    const phrases = currentList.filter(q => 
        q.zh.includes(quoteSearchKey) || q.en.toLowerCase().includes(quoteSearchKey.toLowerCase())
    );

    if (phrases.length === 0) {
        html += `<div class="py-20 text-center text-gray-300 text-xs font-bold">目前沒有符合的短句內容</div>`;
    }

    phrases.forEach(q => {
        const isExpanded = expandedQuoteId === q.id;
        html += `
            <div class="bg-white rounded-xl mb-1.5 border border-gray-50 overflow-hidden shadow-sm">
                <div class="px-5 py-2.5 flex justify-between items-center active:bg-gray-50 transition-colors" onclick="toggleQuoteDetail(${q.id})">
                    <span class="text-[17px] font-black text-gray-800 tracking-tight">${q.zh}</span>
                    <span class="text-gray-300 text-[10px] transition-transform duration-300" style="transform: ${isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'}">▼</span>
                </div>
                <div class="q-detail-content px-5 ${isExpanded ? 'expanded' : ''}">
                    <!-- 韓文與發音組合區 -->
                    <div class="flex justify-between items-end mb-1" onclick="speakKorean('${q.ko}')">
                        <div class="q-ko-group">
                            <div class="q-ko-main text-base font-black text-[#d5a6bd]">${q.ko}</div>
                            <div class="q-pron-main text-[11px] text-gray-400 font-bold">${q.pron}</div>
                        </div>
                        <div class="text-base pb-1.5 opacity-40">🔊</div>
                    </div>
                    <!-- 英文說明 -->
                    <div class="q-en-main">${q.en}</div>
                    
                    ${isQuotesEditing ? `
                        <div class="text-right pb-1">
                            <button onclick="deletePhrase(${q.id})" class="text-[9px] text-red-200 font-bold border border-red-50 px-1.5 py-0.5 rounded">✕ 刪除</button>
                        </div>
                    ` : ''}
                </div>
            </div>`;
    });

    if (isQuotesEditing) {
        html += `<div class="phrase-add-tile mt-2" style="height: 50px;" onclick="addPhrase()">＋</div>`;
    }
    container.innerHTML = html;
}

/* --- 3. 視圖操作與事件 --- */

async function enterQuoteCat(cat) { 
    currentQuoteCat = cat; 
    expandedQuoteId = null; 
    await renderQuotes(); 
    window.scrollTo({ top: 0, behavior: 'auto' });
}

async function exitQuoteCat() { 
    currentQuoteCat = null; 
    await renderQuotes(); 
}

async function toggleQuoteDetail(id) { 
    expandedQuoteId = (expandedQuoteId === id) ? null : id; 
    await renderQuotes(); 
}

async function handleQuoteSearch(val) { 
    quoteSearchKey = val.trim(); 
    await renderQuotes(); 
}

async function toggleQuoteManage() { 
    isQuotesEditing = !isQuotesEditing; 
    const btn = document.getElementById('btn-quote-manage');
    if (btn) {
        btn.innerText = isQuotesEditing ? "✅ 完成" : "✎ 編輯";
        btn.classList.toggle('active', isQuotesEditing);
    }
    await renderQuotes(); 
}

/**
 * 語音播放功能 (韓語)
 */
function speakKorean(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ko-KR';
    utter.rate = 0.85;
    window.speechSynthesis.speak(utter);
}

/* --- 4. 彈窗控制與 CRUD --- */

function addQuoteCat() { 
    const overlay = document.getElementById('quote-cat-modal-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        overlay.classList.add('active'); 
        const input = document.getElementById('new-cat-name');
        if (input) {
            input.value = "";
            input.focus();
        }
    }
}

function addPhrase() { 
    const overlay = document.getElementById('quote-phrase-modal-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        overlay.classList.add('active'); 
        ['new-q-zh', 'new-q-ko', 'new-q-pron', 'new-q-en'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = "";
        });
    }
}

function closeQuoteModals() {
    const overlays = ['quote-cat-modal-overlay', 'quote-phrase-modal-overlay'];
    overlays.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('active');
            el.classList.add('hidden');
        }
    });
}

async function confirmAddQuoteCat() {
    const nameInput = document.getElementById('new-cat-name');
    const name = nameInput ? nameInput.value.trim() : "";
    if (name && !quotesData[name]) {
        quotesData[name] = [];
        await saveQuotes();
        closeQuoteModals();
    } else if (quotesData[name]) {
        alert("此分類名稱已存在");
    }
}

async function confirmAddPhrase() {
    const zh = document.getElementById('new-q-zh').value.trim();
    const ko = document.getElementById('new-q-ko').value.trim();
    const pron = document.getElementById('new-q-pron').value.trim();
    const en = document.getElementById('new-q-en').value.trim();
    
    if (zh && ko) {
        if (!quotesData[currentQuoteCat]) quotesData[currentQuoteCat] = [];
        quotesData[currentQuoteCat].push({ 
            id: Date.now(), 
            zh, ko, pron, en 
        });
        await saveQuotes();
        closeQuoteModals();
    } else {
        alert("中文名稱與韓文內容為必填");
    }
}

async function deletePhrase(id) {
    if(!confirm("確定要刪除這句翻譯嗎？")) return;
    quotesData[currentQuoteCat] = quotesData[currentQuoteCat].filter(q => q.id !== id);
    await saveQuotes();
}

async function deleteQuoteCat(cat) {
    if(!confirm(`確定要刪除「${cat}」整個情境嗎？內含短句將會消失。`)) return;
    delete quotesData[cat];
    await saveQuotes();
}

/**
 * 寫入雲端
 */
async function saveQuotes() { 
    await saveData('quotes', quotesData); 
    await renderQuotes(); 
}

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    const quotesTab = document.getElementById('tab-quotes');
    if (quotesTab && !quotesTab.classList.contains('hidden')) {
        await renderQuotes();
    }
});