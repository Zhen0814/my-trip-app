/**
 * ==============================================================================
 * [檔案名稱] guide.js
 * [功能描述] 旅遊指南核心邏輯模組 (Senior Grade)
 *            - 資料橋接 (Data Bridge)：支援公用與旅伴私人方格系統 (全雲端同步)
 *            - 區塊編輯器 (Block Editor)：支援標題、文字、圖片區塊與排序
 *            - 拖拽排序系統 (Tile Drag & Drop)：行動端長按方格排序
 *            - 加密解鎖：私人清單 Base64 密碼驗證與視圖切換
 *            - 影像優化：自動壓縮上傳與 Loading 狀態處理
 * ==============================================================================
 */

/* ==========================================
   1. 狀態變數與資料初始化管理
   ========================================== */
let currentGuideView = 'public';      // 當前檢視視圖：'public' (公用) 或 'private' (私人)
let currentGuideMember = "";         // 當前查看的私人區成員名稱
let isGuideUnlocked = false;         // 私人頁面是否已通過密碼解鎖

let publicSearchKeyword = "";        // 公用區搜尋關鍵字暫存
let privateSearchKeyword = "";       // 私人區搜尋關鍵字暫存

let isGuideTileManaging = false;     // 指指南方塊 (Tiles) 管理模式開關
let currentEditingTileId = null;     // 當前正在修改設定的 Tile ID
let tempTileImgBase64 = "";          // 編輯 Tile 屬性時的封面圖片暫存區

/* --- 拖拽排序專用變數 --- */
let dragTimer = null;
let dragActive = false;
let draggedIdx = null;
let currentDragEl = null;
let initialTouchX = 0;
let initialTouchY = 0;

/* --- 指南內容區塊編輯器 (Block Editor) 專用狀態 --- */
let currentDetailId = null;          // 當前開啟的詳情 ID (例如 g1, gt123...)
let isGuideBlockEditing = false;     // 是否處於指南內容區塊的「編輯模式」
let editingBlocks = [];              // 編輯中的區塊暫存陣列

/**
 * 核心數據橋接層 (Data Bridge)：改為非同步從雲端抓取資料
 */
async function getActiveTilesData() {
    if (currentGuideView === 'public') {
        return await getGuideData(); 
    } else {
        const storageKey = `guide_tiles_${currentGuideMember}`;
        let data = await fetchData(storageKey, 'null');
        if (!data) {
            const personalTemplate = [
                { 
                    id: "p" + Date.now(), 
                    title: "我的私房筆記", 
                    img: "", 
                    blocks: [
                        { type: 'title', content: '歡迎使用私人筆記' },
                        { type: 'text', content: '這裡可以記錄您專屬的購物清單、餐廳地圖或重要憑證照片。這部分內容僅在輸入正確密碼後可見。' }
                    ] 
                }
            ];
            await saveData(storageKey, personalTemplate);
            return personalTemplate;
        }
        return data;
    }
}

/**
 * 核心數據儲存層 (Data Bridge)
 */
async function saveActiveTilesData(data) {
    if (currentGuideView === 'public') {
        await saveData('tripGuides', data);
    } else {
        await saveData(`guide_tiles_${currentGuideMember}`, data);
    }
}

/**
 * 獲取公用指南原始數據 (預設 16 個分類)
 */
async function getGuideData() {
    let data = await fetchData('tripGuides', 'null');
    if (!data) {
        const initialTemplate = [
            { id: "g1", title: "入境", img: "", blocks: [{ type: 'text', content: `<b>● e-Arrival Card</b><br>沒有SES要填寫e-Arrival Card（網址：<a href="https://www.e-arrivalcard.go.kr" target="_blank">www.e-arrivalcard.go.kr</a>）。<br>抵達韓國前72小時內可以申報，填寫完成後沒有Qr code。<br><br><b>● SES 自動通關</b><br>17歲以上台灣旅客可以辦。在入境審查區跟著 <b>SES／自動出入境審查</b> 走。<br>- T1 第一航廈：A、F 區可以直接辦（07:00～22:00）<br>- T2 第二航廈：A 區（24h）、B 區（05:00～20:00）` }] },
            { id: "g2", title: "出境", img: "", blocks: [{ type: 'text', content: "包含海關申報、航空公司櫃檯分布與退稅機位置說明。建議提前 3 小時抵達機場。" }] },
            { id: "g3", title: "Tmoney", img: "", blocks: [{ type: 'text', content: "韓國最通用的交通卡。便利商店(7-11, CU, GS25)皆可購買與儲值，單程扣款更優惠。" }] },
            { id: "g4", title: "WOWPASS", img: "", blocks: [{ type: 'text', content: "全能型外幣兌換卡。可在機器直接存入台幣換韓元，並具備交通卡功能，超市購物也可用。" }] },
            { id: "g5", title: "APP推薦", img: "", blocks: [{ type: 'text', content: "1. Naver Map (中文地圖)<br>2. KakaoT (叫車首選)<br>3. Papago (最強翻譯)<br>4. Subways (地鐵導航)" }] },
            { id: "g6", title: "機場巴士", img: "", blocks: [{ type: 'text', content: "內容整理中...包含 6001 (東大門)、6015 (明洞) 等熱門路線時刻表與站點資訊。" }] },
            { id: "g7", title: "地鐵", img: "", blocks: [{ type: 'text', content: "注意換乘站的方向標示。韓國地鐵階梯多，若有行李請多利用電梯（Elevator）標示。" }] },
            { id: "g8", title: "計程車", img: "", blocks: [{ type: 'text', content: "一般計程車(橘/白)、模範計程車(黑)。深夜時段會有加成，建議使用 KakaoT 預估車資。" }] },
            { id: "g9", title: "公車", img: "", blocks: [{ type: 'text', content: "上下車皆需刷卡。站牌通常有即時到站顯示資訊，藍色為幹線，綠色為支線。" }] },
            { id: "g10", title: "用餐文化", img: "", blocks: [{ type: 'text', content: "大部分餐廳小菜(Banchan)皆可免費續加，點餐後通常會給予水瓶與水杯，需自取餐具。" }] },
            { id: "g11", title: "免稅退稅", img: "", blocks: [{ type: 'text', content: "滿 30,000 韓元可退稅。市區百貨與機場皆有自動退稅機。結帳時出示護照可即時折抵。" }] },
            { id: "g12", title: "購物", img: "", blocks: [{ type: 'text', content: "明洞、弘大、聖水洞、以及樂天超市(Lotte Mart)與大創(Daiso)推薦必買清單。" }] },
            { id: "g13", title: "Naver Map", img: "", blocks: [{ type: 'text', content: "強烈建議登入帳號，將景點預先存入星星清單，導航最精準，可查看餐廳評分。" }] },
            { id: "g14", title: "外送", img: "", blocks: [{ type: 'text', content: "Coupang Eats 或 Baedal Minjok。大部分旅店可代收外送炸雞，記得詢問櫃檯位置。" }] },
            { id: "g15", title: "緊急資訊", img: "", blocks: [{ type: 'text', content: "119 火警/急救、112 報警、1330 旅遊諮詢與翻譯（支援多國語言服務）。" }] },
            { id: "g16", title: "其他", img: "", blocks: [{ type: 'text', content: "插座轉接頭(220V 圓孔)、時差(快1小時)。公共區域禁菸，需找指定抽菸區。" }] }
        ];
        await saveData('tripGuides', initialTemplate);
        return initialTemplate;
    }
    return data;
}

/* --- 2. 搜尋與過濾執行 --- */

async function filterPublicGuides(val) {
    publicSearchKeyword = val.trim().toLowerCase();
    await renderGuide(); 
}

async function filterPrivateContent(val) {
    privateSearchKeyword = val.trim().toLowerCase();
    await renderGuide(); 
}

/* ==========================================
   3. 方格渲染與 CRUD 邏輯
   ========================================== */

/**
 * 切換方塊管理模式
 */
async function toggleGuideTileManage() {
    isGuideTileManaging = !isGuideTileManaging;
    const btnId = (currentGuideView === 'public') ? 'btn-guide-tile-manage' : 'btn-guide-private-manage';
    const btn = document.getElementById(btnId);
    
    if (btn) {
        btn.innerText = isGuideTileManaging ? "✅ 完成" : "✎ 編輯";
        if (isGuideTileManaging) {
            btn.classList.add('bg-green-500', 'text-white');
            btn.classList.remove('text-indigo-400', 'bg-white');
        } else {
            btn.classList.remove('bg-green-500', 'text-white');
            btn.classList.add('text-indigo-400', 'bg-white');
        }
    }
    await renderGuide(); 
}

/**
 * 核心渲染引擎 (非同步化)
 */
async function renderGuide() {
    const containerId = (currentGuideView === 'public') ? 'guide-grid-container' : 'guide-private-content';
    const container = document.getElementById(containerId);
    if (!container) return;

    let data = await getActiveTilesData(); 

    const keyword = (currentGuideView === 'public') ? publicSearchKeyword : privateSearchKeyword;
    if (keyword) {
        data = data.filter(item => item.title.toLowerCase().includes(keyword));
    }

    let html = `<div class="guide-grid">`;
    data.forEach((item, idx) => {
        const topContent = item.img 
            ? `<img src="${item.img}" class="object-cover w-full h-full">` 
            : `<div class="guide-tile-no-img">${item.title}</div>`;

        const clickAction = isGuideTileManaging 
            ? `openTileSettings('${item.id}')` 
            : `openGuideDetail('${item.id}')`;

        html += `
            <div class="guide-tile relative ${isGuideTileManaging ? 'scale-95 opacity-90 border-2 border-indigo-200 shadow-inner' : 'active:scale-95'} transition-all duration-300" 
                 data-index="${idx}"
                 ontouchstart="handleTileTouchStart(event, ${idx})"
                 ontouchmove="handleTileTouchMove(event)"
                 ontouchend="handleTileTouchEnd(event)"
                 style="cursor:pointer" 
                 onclick="${clickAction}">
                <div class="tile-top">${topContent}</div>
                <div class="tile-bottom">
                    <div class="tile-title">${item.title}</div>
                </div>
                ${isGuideTileManaging ? `
                    <button onclick="event.stopPropagation(); deleteGuideTile('${item.id}')" 
                            class="guide-tile-delete-btn">✕</button>
                ` : ''}
            </div>`;
    });

    if (isGuideTileManaging) {
        html += `
            <div class="guide-tile border-2 border-dashed border-gray-200 flex items-center justify-center bg-white/50 active:bg-indigo-50" 
                 style="cursor:pointer" 
                 onclick="addGuideTile()">
                <div class="text-gray-300 text-3xl font-light">＋</div>
            </div>`;
    }

    html += `</div>`;
    container.innerHTML = html;
}

/**
 * 新增分類方塊
 */
async function addGuideTile() {
    let data = await getActiveTilesData();
    const newTile = { 
        id: "gt" + Date.now(), 
        title: "新分類", 
        img: "", 
        blocks: [{ type: 'text', content: '點擊編輯內容...' }] 
    };
    data.push(newTile);
    await saveActiveTilesData(data); 
    await renderGuide();
}

/**
 * 刪除分類方塊
 */
async function deleteGuideTile(id) {
    if (!confirm("確定要刪除整個分類嗎？內部的詳細資料將會永久消失！")) return;
    let data = await getActiveTilesData();
    data = data.filter(item => item.id !== id);
    await saveActiveTilesData(data);
    await renderGuide();
}

/* ==========================================
   4. 方塊拖拽排序邏輯 (Touch Support)
   ========================================== */

function handleTileTouchStart(e, idx) {
    if (!isGuideTileManaging) return; 
    
    const touch = e.touches[0];
    initialTouchX = touch.clientX;
    initialTouchY = touch.clientY;
    draggedIdx = idx;
    currentDragEl = e.currentTarget;

    dragTimer = setTimeout(() => {
        dragActive = true;
        currentDragEl.classList.add('is-dragging');
        if (navigator.vibrate) navigator.vibrate(50); 
    }, 500);
}

function handleTileTouchMove(e) {
    if (!dragActive) {
        const touch = e.touches[0];
        if (Math.abs(touch.clientX - initialTouchX) > 10 || Math.abs(touch.clientY - initialTouchY) > 10) {
            clearTimeout(dragTimer);
        }
        return;
    }

    e.preventDefault(); 
    const touch = e.touches[0];
    
    const moveX = touch.clientX - initialTouchX;
    const moveY = touch.clientY - initialTouchY;
    currentDragEl.style.transform = `translate(${moveX}px, ${moveY}px) scale(1.08)`;

    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
    const dropZone = targetEl ? targetEl.closest('.guide-tile') : null;

    if (dropZone && dropZone !== currentDragEl) {
        const targetIdx = parseInt(dropZone.getAttribute('data-index'));
        if (!isNaN(targetIdx)) {
            swapGuideTiles(draggedIdx, targetIdx);
            draggedIdx = targetIdx; 
        }
    }
}

async function swapGuideTiles(from, to) {
    let data = await getActiveTilesData();
    const [movedItem] = data.splice(from, 1);
    data.splice(to, 0, movedItem);
    await saveActiveTilesData(data);
    await renderGuide(); 
}

function handleTileTouchEnd(e) {
    clearTimeout(dragTimer);
    if (!dragActive) return;

    dragActive = false;
    if (currentDragEl) {
        currentDragEl.classList.remove('is-dragging');
        currentDragEl.style.transform = '';
    }
    renderGuide(); 
}

/* ==========================================
   5. 方塊屬性修改彈窗
   ========================================== */

async function openTileSettings(id) {
    const data = await getActiveTilesData();
    const item = data.find(g => g.id === id);
    if (!item) return;

    currentEditingTileId = id;
    tempTileImgBase64 = item.img || "";
    
    const titleInput = document.getElementById('edit-tile-title');
    if (titleInput) titleInput.value = item.title;
    
    updateTilePreview();
    
    const overlay = document.getElementById('tile-settings-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
    }
}

function closeTileSettings() {
    const overlay = document.getElementById('tile-settings-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
    }
}

async function handleTileImgSelect(input) {
    if (!input.files || !input.files[0]) return;
    try {
        tempTileImgBase64 = await utils.compressImage(input.files[0], 800, 0.7);
        updateTilePreview();
    } catch (err) { alert("圖片處理失敗，請換一張試試"); }
}

function removeTileImg() {
    if (confirm("確定要移除封面圖嗎？")) {
        tempTileImgBase64 = "";
        updateTilePreview();
    }
}

function updateTilePreview() {
    const box = document.getElementById('tile-img-preview');
    if (!box) return;
    box.innerHTML = tempTileImgBase64 
        ? `<img src="${tempTileImgBase64}" class="w-full h-full object-cover">` 
        : "<span class='text-gray-300'>無圖片</span>";
}

async function saveTileSettings() {
    const titleInput = document.getElementById('edit-tile-title');
    const newTitle = titleInput ? titleInput.value.trim() : "";
    if (!newTitle) return alert("請輸入分類標題");

    let data = await getActiveTilesData();
    const idx = data.findIndex(g => g.id === currentEditingTileId);
    if (idx !== -1) {
        data[idx].title = newTitle;
        data[idx].img = tempTileImgBase64;
        await saveActiveTilesData(data);
        await renderGuide();
        closeTileSettings();
    }
}

/* ==========================================
   6. 指南詳情 (區塊編輯核心邏輯)
   ========================================== */

async function openGuideDetail(id) {
    const data = await getActiveTilesData();
    const item = data.find(g => g.id === id);
    if (!item) return;

    currentDetailId = id;
    isGuideBlockEditing = false;
    
    editingBlocks = item.blocks || [{ type: 'text', content: item.content || "" }];
    
    const titleEl = document.getElementById('g-detail-title');
    if (titleEl) titleEl.innerText = item.title;
    
    renderGuideDetailBlocks();
    
    const toolbar = document.getElementById('guide-editor-toolbar');
    if (toolbar) toolbar.classList.add('hidden');
    
    const editBtn = document.getElementById('btn-guide-block-edit');
    if (editBtn) {
        editBtn.innerText = "✎ 編輯內容";
        editBtn.classList.remove('text-red-400', 'bg-red-50');
    }
    
    const overlay = document.getElementById('guide-detail-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        overlay.classList.add('flex'); 
    }
    document.body.style.overflow = 'hidden'; 
}

function toggleGuideBlockEdit() {
    isGuideBlockEditing = !isGuideBlockEditing;
    const btn = document.getElementById('btn-guide-block-edit');
    const toolbar = document.getElementById('guide-editor-toolbar');
    
    if (btn) {
        btn.innerText = isGuideBlockEditing ? "取消編輯" : "✎ 編輯內容";
        btn.classList.toggle('text-red-400', isGuideBlockEditing);
        btn.classList.toggle('bg-red-50', isGuideBlockEditing);
    }
    
    if (toolbar) toolbar.classList.toggle('hidden', !isGuideBlockEditing);
    
    renderGuideDetailBlocks();
}

function renderGuideDetailBlocks() {
    const container = document.getElementById('g-blocks-container'); 
    if (!container) return;

    container.className = "flex-1 overflow-y-auto p-6 space-y-2 no-scrollbar";

    if (editingBlocks.length === 0) {
        container.innerHTML = `<div class="py-20 text-center text-gray-300 text-xs">尚無任何內容，請點擊編輯增加區塊</div>`;
        return;
    }

    container.innerHTML = editingBlocks.map((block, idx) => {
        if (isGuideBlockEditing) {
            let contentHtml = "";
            if (block.type === 'title') {
                contentHtml = `<input type="text" class="guide-edit-title" value="${block.content}" oninput="updateBlockData(${idx}, this.value)" placeholder="輸入區塊標題...">`;
            } else if (block.type === 'text') {
                contentHtml = `<textarea class="guide-edit-text" oninput="updateBlockData(${idx}, this.value); guideAutoResize(this)" placeholder="輸入內容...">${block.content}</textarea>`;
            } else if (block.type === 'image') {
                contentHtml = `<div class="relative rounded-xl overflow-hidden border border-gray-100 shadow-sm"><img src="${block.content}" class="w-full h-auto"></div>`;
            }
            
            return `
                <div class="guide-block-item border-l-2 border-dashed border-indigo-50 pl-2 animate-fade-in">
                    <div class="flex items-start gap-2">
                        <div class="flex flex-col gap-1">
                            <button onclick="moveGuideBlock(${idx}, 'up')" class="guide-sort-btn active:scale-75 ${idx === 0 ? 'opacity-20' : ''}">▲</button>
                            <button onclick="moveGuideBlock(${idx}, 'down')" class="guide-sort-btn active:scale-75 ${idx === editingBlocks.length - 1 ? 'opacity-20' : ''}">▼</button>
                        </div>
                        <div class="flex-1">${contentHtml}</div>
                    </div>
                    <div class="text-right mt-1">
                        <button onclick="deleteBlock(${idx})" class="text-red-300 text-[10px] font-bold py-1 px-2 border border-red-50 rounded-lg">✕ 刪除區塊</button>
                    </div>
                </div>`;
        } else {
            if (block.type === 'title') {
                return `<div class="guide-block-item"><h4 class="guide-read-title">${block.content || "未命名"}</h4></div>`;
            } else if (block.type === 'text') {
                const tagged = (typeof utils !== 'undefined') ? utils.autoTagUrls(block.content || "") : block.content;
                return `<div class="guide-block-item"><div class="guide-read-text">${tagged}</div></div>`;
            } else if (block.type === 'image') {
                return `
                    <div class="guide-block-item">
                        <img src="${block.content}" class="guide-read-img-preview" 
                             onclick="openLightbox(null, null, '${block.content}', {type:'guide'})">
                    </div>`;
            }
        }
    }).join('');

    if (isGuideBlockEditing) {
        setTimeout(() => {
            container.querySelectorAll('textarea').forEach(tx => guideAutoResize(tx));
        }, 50);
    }
}

function updateBlockData(idx, val) {
    if (editingBlocks[idx]) editingBlocks[idx].content = val;
}

function addGuideBlock(type) {
    editingBlocks.push({ type: type, content: "" });
    renderGuideDetailBlocks();
    const container = document.getElementById('g-blocks-container');
    if (container) {
        setTimeout(() => {
            container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        }, 150);
    }
}

function moveGuideBlock(idx, direction) {
    if (direction === 'up' && idx > 0) {
        [editingBlocks[idx], editingBlocks[idx - 1]] = [editingBlocks[idx - 1], editingBlocks[idx]];
    } else if (direction === 'down' && idx < editingBlocks.length - 1) {
        [editingBlocks[idx], editingBlocks[idx + 1]] = [editingBlocks[idx + 1], editingBlocks[idx]];
    } else {
        return;
    }
    renderGuideDetailBlocks();
}

async function handleBlockImgUpload(input) {
    if (!input.files || !input.files[0]) return;
    const btn = document.querySelector('button[onclick*="block-img-input"]');
    const originalContent = btn ? btn.innerHTML : "";
    if (btn) {
        btn.innerHTML = `<span class="animate-spin text-lg inline-block">⏳</span>`;
        btn.disabled = true;
    }
    try {
        const base64 = await utils.compressImage(input.files[0], 1200, 0.8);
        editingBlocks.push({ type: 'image', content: base64 });
        renderGuideDetailBlocks();
        const container = document.getElementById('g-blocks-container');
        if (container) {
            setTimeout(() => {
                container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
            }, 100);
        }
    } catch (err) { 
        alert("圖片處理失敗，請縮小尺寸後再試"); 
    } finally {
        if (btn) {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    }
}

function deleteBlock(idx) {
    if (!confirm("確定要刪除此內容區塊嗎？")) return;
    editingBlocks.splice(idx, 1);
    renderGuideDetailBlocks();
}

async function saveGuideBlocks() {
    let data = await getActiveTilesData();
    const idx = data.findIndex(g => g.id === currentDetailId);
    if (idx !== -1) {
        data[idx].blocks = editingBlocks;
        await saveActiveTilesData(data);
        alert("✅ 指南內容已儲存");
        toggleGuideBlockEdit(); 
    }
}

function guideAutoResize(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = (el.scrollHeight) + 'px';
}

function closeGuideDetail(e) {
    const overlay = document.getElementById('guide-detail-overlay');
    if (!overlay) return;
    if (e && e.target && e.target.id !== 'guide-detail-overlay' && e.type === 'click') return;
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
    document.body.style.overflow = '';
}

/* ==========================================
   7. 私人清單導覽與加密解鎖機制
   ========================================== */

async function switchGuideView(view) {
    currentGuideView = view;
    isGuideTileManaging = false; 
    
    const zonePublic = document.getElementById('guide-public-zone');
    const zonePrivate = document.getElementById('guide-private-zone');
    const navPublic = document.getElementById('nav-guide-public');
    const navPrivate = document.getElementById('nav-guide-private');

    if (zonePublic) zonePublic.classList.toggle('hidden', view !== 'public');
    if (zonePrivate) zonePrivate.classList.toggle('hidden', view !== 'private');
    if (navPublic) navPublic.classList.toggle('active', view === 'public');
    if (navPrivate) navPrivate.classList.toggle('active', view === 'private');
    
    if (view === 'private') {
        const editors = await fetchData('editorList', '[]');
        const me = (localStorage.getItem('currentUser') || "").trim();
        if (me && !editors.includes(me)) {
            await addToEditorList(me);
        }
        if (!currentGuideMember) currentGuideMember = me || (editors.length > 0 ? editors[0] : "");
        await renderGuideMemberTabs();
        await renderGuidePrivateContent();
    } else {
        await renderGuide(); 
    }
}

async function renderGuideMemberTabs() {
    const container = document.getElementById('guide-member-list');
    if (!container) return;

    // 從雲端抓取最新的旅伴名單
    const editors = await fetchData('editorList', '[]');

    let html = '';
    editors.forEach(name => {
        const isSelected = (currentGuideMember === name.trim());
        html += `<div class="exp-subtab ${isSelected ? 'active' : ''}" onclick="switchGuideMember('${name}')">👤 ${name}</div>`;
    });
    container.innerHTML = html;
}

async function switchGuideMember(name) {
    currentGuideMember = (name || "").trim();
    isGuideUnlocked = false; 
    isGuideTileManaging = false; 
    await renderGuideMemberTabs();
    await renderGuidePrivateContent();
}

async function renderGuidePrivateContent() {
    const content = document.getElementById('guide-private-content');
    const currentUser = (localStorage.getItem('currentUser') || "").trim();
    if (!content) return;

    const isLocked = (currentGuideMember !== currentUser && !isGuideUnlocked);

    if (isLocked) {
        content.innerHTML = `
            <div class="lock-zone flex flex-col items-center justify-center pt-2 pb-12">
                <div class="lock-card">
                    <div class="lock-emoji">🔐</div>
                    <div class="lock-title">這是 ${currentGuideMember} 的私人筆記</div>
                    <div class="lock-subtitle">請輸入該旅伴的密碼以解鎖查看</div>
                    
                    <input type="password" id="guide-lock-pwd" class="lock-input" placeholder="輸入解鎖密碼">
                    
                    <button onclick="unlockGuideMember()" class="guide-lock-btn">
                        解鎖查看
                    </button>
                </div>
            </div>`;
        return;
    }

    await renderGuide();
}

/**
 * 解鎖私人筆記 (修復為全雲端密碼校驗)
 */
async function unlockGuideMember() {
    const pwdInputEl = document.getElementById('guide-lock-pwd');
    const pwdInput = pwdInputEl ? pwdInputEl.value : "";
    
    if (!pwdInput) return alert("請輸入旅伴的存取密碼");

    // 從雲端抓取目標使用者的註冊資料進行 Base64 比對
    const userData = await fetchData(`user_${currentGuideMember}`, 'null');
    
    if (userData && btoa(pwdInput) === userData.password) {
        isGuideUnlocked = true;
        await renderGuidePrivateContent();
    } else {
        alert("密碼不正確！請向該旅伴詢問。");
    }
}