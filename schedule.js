/* --- schedule.js --- */

/* ==========================================
   1. 行程專用變數 (Local State)
   ========================================== */
let editingIdx = null;
let selectedAuthor = "";
let modalPreviewImgBase64 = "";
let currentTransIdx = null; 
let currentLightboxTarget = { type: 'schedule', stepIdx: null, imgIdx: null, expenseId: null }; 

const transportIcons = {
    '🚶': '徒步', '🚇': '地鐵', '🚌': '巴士', '🚕': '計程車',
    '✈️': '飛機', '🚐': '接駁', '🚗': '包車', '🚢': '渡輪'
};

/* ==========================================
   2. 日期切換器渲染 (Day Switcher)
   ========================================== */
function initDays() { 
    const sw = document.getElementById('daySwitcher'); 
    if (!sw) return;
    sw.innerHTML = days.map((d, i) => `
        <div class="day-card ${i+1 === currentDay ? 'active' : ''}" onclick="switchDay(${i+1}, this)">
            <span class="row-1">DAY</span>
            <span class="row-2">${i+1}</span>
            <span class="row-3">${d}</span>
        </div>`).join(''); 
}

function switchDay(d, el) { 
    currentDay = d; 
    document.querySelectorAll('.day-card').forEach(x => x.classList.remove('active')); 
    if(el) el.classList.add('active'); 
    renderList(); 
    loadDailyData(); 
}

/* ==========================================
   3. 行程列表渲染 (Render Cards) - 已改為非同步
   ========================================== */
async function renderList() {
    const container = document.getElementById('schedule-list');
    if (!container) return;

    // 關鍵修改：從 fetchData 拿取最新雲端資料
    let allData = await fetchData('schedule', '[]');
    let filtered = allData.filter(i => i.day === currentDay).sort((a,b) => (a.time || "00:00").localeCompare(b.time || "00:00"));
    
    let html = ""; 
    filtered.forEach((item, i) => {
        const realIdx = allData.indexOf(item);
        const timeMarker = `<div class="time-marker-group"><div class="attraction-time">${item.time}</div><div class="time-dot"></div></div>`;
        
        // A. 在景點卡片之前渲染交通小卡 (從第 2 個景點開始，連接前一站到本站)
        if (i > 0) {
            html += `
            <div class="transport-wrapper">
                <div class="transport-bar" onclick="openTransportDetail(${realIdx})">
                    <div class="trans-main-row">
                        <span>${item.transportMode || '🚶'}</span>前往下一站
                    </div>
                    ${item.transportTime ? `<div class="trans-time-centered">${item.transportTime} min</div>` : ''}
                </div>
            </div>`;
        }

        // B. 渲染景點卡片或航班卡片
        if (item.cat === '飛機') {
            html += `<div class="event-node">${timeMarker}${renderFlightCard(item, realIdx)}</div>`;
        } else {
            let catClass = item.cat === '景點' ? "cat-tag-sight" : 
                           item.cat === '餐廳' ? "cat-tag-food" : 
                           item.cat === '購物' ? "cat-tag-shop" : 
                           item.cat === '體驗' ? "cat-tag-exp" : 
                           item.cat === '住宿' ? "cat-tag-hotel" : "cat-tag-default";
            
            html += `
            <div class="event-node">
                ${timeMarker}
                <div class="attraction-card" onclick="toggleCard(this)">
                    <div class="card-main-layout">
                        <div class="attraction-left">
                            <div class="cat-tag-outer ${catClass}">${item.cat}</div>
                            <div class="attraction-name">${item.name}</div>
                            <a class="attraction-addr" href="${item.addrLink || 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(item.address || item.name)}" target="_blank" onclick="event.stopPropagation()">📍 ${item.address || '查看地點'}</a>
                        </div>
                        <div class="attraction-right-col">
                            <div class="attraction-thumb-box">${item.previewImg ? `<img src="${item.previewImg}">` : '<span>📷</span>'}</div>
                            <div class="action-footer-row">
                                <div class="btn-group">
                                    <div class="mini-action-btn" 
                                         onclick="event.stopPropagation(); openModal(${realIdx});">✎</div>
                                    <div class="mini-action-btn" 
                                         onclick="event.stopPropagation(); deleteItem(${realIdx});">✕</div>
                                </div>
                                ${item.author ? `<div class="author-tag">👤 ${item.author}</div>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="card-details">${renderNotes(item.notes)}</div>
                </div>
            </div>`;
        }
    });
    
    container.innerHTML = html || "<div class='text-center p-10 text-gray-300'>今日尚無行程</div>";
}

function renderFlightCard(item, realIdx) {
    const d = (item.time || "00:00").split(':').map(Number); 
    const a = (item.arrTime || "00:00").split(':').map(Number);
    let diff = (a[0]*60+a[1])-(d[0]*60+d[1]); 
    if(diff<0) diff+=1440;
    
    return `
    <div class="flight-ticket-card" onclick="toggleCard(this)">
        <div class="ticket-main">
            <div class="ticket-header">
                <div class="airline-info">✈️ ${item.airline || '待定航空'}</div>
                <div class="action-bar flex gap-2">
                    <div class="mini-action-btn flight-action-btn" 
                         onclick="event.stopPropagation(); openModal(${realIdx})">✎</div>
                    <div class="mini-action-btn flight-action-btn" 
                         onclick="event.stopPropagation(); deleteItem(${realIdx})">✕</div>
                </div>
            </div>
            <div class="ticket-body">
                <div class="airport-side">
                    <div class="airport-code">${item.name || '---'}</div>
                    <div class="airport-time-sub">${item.time || '--:--'}</div>
                </div>
                <div class="path-container">
                    <div class="flight-no-sub">${item.flightNo || '航班號'}</div>
                    <div class="path-line-row">
                        <div class="path-line"></div>
                        <div class="path-plane-icon">✈</div>
                    </div>
                    <div class="duration-sub">${Math.floor(diff/60)}h ${diff%60}m</div>
                </div>
                <div class="airport-side">
                    <div class="airport-code">${item.dest || '---'}</div>
                    <div class="airport-time-sub">${item.arrTime || '--:--'}</div>
                </div>
            </div>
            <div class="card-details">${renderNotes(item.notes)}</div>
        </div>
        <div class="ticket-stub">${item.author ? `<div class="author-tag">👤 ${item.author}</div>` : ''}</div>
    </div>`;
}

function renderNotes(notes) { 
    if (!notes || notes.length === 0) return ""; 
    return notes.map(n => {
        const taggedText = utils.autoTagUrls(n.text);
        return `
        <div class="mb-2">
            <div class="note-tag ${colorMap[n.icon] || 'note-purple'}">${n.icon} ${taggedText}</div>
            ${n.img ? `<img src="${n.img}" class="note-img-preview">` : ''}
        </div>`;
    }).join(''); 
}

/* ==========================================
   4. 行程編輯彈窗
   ========================================== */
async function openModal(idx = null) {
    editingIdx = idx;
    modalPreviewImgBase64 = "";
    document.getElementById('notes-container').innerHTML = "";
    document.getElementById('modal-preview-img-box').innerHTML = '<span class="text-xs text-gray-300">預覽</span>';
    
    const inputs = document.querySelectorAll('#modal-content input[type="text"], #modal-content input[type="time"], #modal-content input[type="number"]');
    inputs.forEach(input => input.value = "");
    
    // 從雲端獲取最新資料
    const data = await fetchData('schedule', '[]');
    let item = idx !== null ? data[idx] : null;
    let targetAuthor = localStorage.getItem('nickname') || "";

    if (idx === null) {
        document.getElementById('modal-title').innerText = "新增行程";
        toggleCat({ catText: '景點' }); 
        addNoteInput();
        document.getElementById('f-time').value = "12:00";
    } else {
        document.getElementById('modal-title').innerText = "編輯行程";
        targetAuthor = item.author || "";
        toggleCat({ catText: item.cat });

        if (item.cat === '飛機') {
            document.getElementById('f-airline').value = item.airline || "";
            document.getElementById('f-flight-no').value = item.flightNo || "";
            document.getElementById('f-dep-time').value = item.time || "";
            document.getElementById('f-arr-time').value = item.arrTime || "";
            document.getElementById('f-dep-loc').value = item.name || "";
            document.getElementById('f-dest-loc').value = item.dest || "";
        } else {
            document.getElementById('f-time').value = item.time || "";
            document.getElementById('f-name').value = item.name || "";
            document.getElementById('f-address').value = item.address || "";
            document.getElementById('f-address-link').value = item.addrLink || "";
            document.getElementById('f-transport-time').value = item.transportTime || "";
            if (item.previewImg) {
                modalPreviewImgBase64 = item.previewImg;
                document.getElementById('modal-preview-img-box').innerHTML = `<img src="${item.previewImg}" class="w-full h-full object-cover">`;
            }
        }

        if (item.notes && item.notes.length > 0) {
            item.notes.forEach(n => addNoteInput(n.text, n.icon, n.img));
        } else {
            addNoteInput();
        }
    }
    
    const transPills = document.getElementById('transport-pills');
    transPills.className = "transport-grid";
    transPills.innerHTML = Object.keys(transportIcons).map(icon => `
        <div class="pill ${item && item.transportMode === icon ? 'selected' : ( (!item && icon === '🚶') ? 'selected' : '' )}" 
             onclick="toggleTransport(this)" data-icon="${icon}">
            ${icon} ${transportIcons[icon]}
        </div>`).join('');

    renderAuthorSelector(targetAuthor); 
    document.getElementById('modal-overlay').classList.add('active');
}

async function saveItem() {
    const cat = document.querySelector('#cat-pills .selected').innerText; 
    
    // 關鍵修改：存檔前先從雲端領取最新資料，避免覆蓋他人更動
    let data = await fetchData('schedule', '[]'); 
    let item = { day: currentDay, cat: cat, author: selectedAuthor, notes: [] };
    
    document.querySelectorAll('#notes-container > .note-input-row').forEach(div => { 
        const text = div.querySelector('textarea').value; 
        const img = div.querySelector('.note-preview-img img')?.src || ""; 
        if(text || img) item.notes.push({ icon: div.querySelector('select').value, text, img }); 
    });

    if (cat === '飛機') { 
        item.airline = document.getElementById('f-airline').value; 
        item.flightNo = document.getElementById('f-flight-no').value; 
        item.time = document.getElementById('f-dep-time').value; 
        item.arrTime = document.getElementById('f-arr-time').value; 
        item.name = document.getElementById('f-dep-loc').value; 
        item.dest = document.getElementById('f-dest-loc').value; 
    } else { 
        item.time = document.getElementById('f-time').value; 
        item.name = document.getElementById('f-name').value; 
        item.address = document.getElementById('f-address').value; 
        item.addrLink = document.getElementById('f-address-link').value; 
        item.previewImg = modalPreviewImgBase64; 
        item.transportMode = document.querySelector('#transport-pills .selected')?.getAttribute('data-icon') || "🚶";
        item.transportTime = document.getElementById('f-transport-time')?.value || ""; 
    }

    if (editingIdx !== null) {
        data[editingIdx] = item; 
    } else {
        data.push(item);
    }

    // 關鍵修改：使用 await saveData 存入雲端
    await saveData('schedule', data); 
    closeModal(); 
    renderList(); // 重新渲染
}

async function deleteItem(idx) { 
    if(confirm("確定刪除行程？")) { 
        let data = await fetchData('schedule', '[]'); 
        data.splice(idx, 1); 
        await saveData('schedule', data); 
        renderList(); 
    } 
}

/* ==========================================
   5. 交通詳情實作邏輯
   ========================================== */
async function openTransportDetail(idx) {
    currentTransIdx = idx; // idx 現在是目的地
    const overlay = document.getElementById('trans-detail-overlay');
    if (!overlay) return;

    document.body.classList.add('no-scroll');
    
    let allData = await fetchData('schedule', '[]');
    let currentItem = allData[idx]; // 目的地
    
    // 獲取前一站作為起點
    const prevItem = getPrevItem(allData, idx);
    const originName = prevItem ? prevItem.name : "目前位置";

    // 初始化交通步驟
    if (!currentItem.transitSteps || currentItem.transitSteps.length === 0) {
        currentItem.transitSteps = [
            { action: "從這裡出發", detail: originName, isHigh: false, imgs: [] },
            { action: "到達目的地", detail: currentItem.name, isHigh: false, imgs: [] }
        ];
        await saveData('schedule', allData);
    }

    // 導航連結設定
    const navLink = document.getElementById('trans-nav-link');
    if (navLink) {
        if (prevItem && currentItem) {
            const originStr = prevItem.address || prevItem.name;
            const destStr = currentItem.address || currentItem.name;
            navLink.href = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(destStr)}&travelmode=transit`;
            navLink.innerHTML = `<span>📍</span> 開始導航 (前往 ${currentItem.name})`;
            navLink.classList.remove('disabled');
        } else {
            navLink.href = "#";
            navLink.classList.add('disabled');
        }
    }

    // 標題與目的地顯示
    document.getElementById('trans-title').innerText = `${currentItem.transportMode || '🚶'} 前往下一站`;
    document.getElementById('trans-subtitle').innerHTML = `目的地：<span id="dest-copy-target">${currentItem.name}</span><button onclick="copyDestName('${currentItem.name}')" class="copy-btn">📋 複製</button>`;
    
    renderTransitTimeline(currentItem.transitSteps);
    overlay.classList.add('active');
}

// 輔助函式：獲取前一站
function getPrevItem(allData, currentIdx) {
    const currentItem = allData[currentIdx];
    const filtered = allData.filter(i => i.day === currentItem.day).sort((a,b) => (a.time || "00:00").localeCompare(b.time || "00:00"));
    const seqIdx = filtered.indexOf(currentItem);
    return filtered[seqIdx - 1] || null;
}

function closeTransitDetail(e) {
    const overlay = document.getElementById('trans-detail-overlay');
    if (!overlay) return;

    const isManual = !e;
    const isBackground = e && e.target && e.target.id === 'trans-detail-overlay';
    const isCloseBtn = e && e.target && e.target.closest('.close-trigger');

    if (isManual || isBackground || isCloseBtn) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        overlay.classList.remove('active');
        document.body.classList.remove('no-scroll');
        document.body.style.overflow = '';
        currentTransIdx = null;
        
        setTimeout(() => renderList(), 150);
    }
}

function renderTransitTimeline(steps) {
    const container = document.getElementById('transit-steps-container');
    if (!container) return;
    
    container.innerHTML = steps.map((s, i) => `
        <div class="transit-step-row ${s.isHigh ? 'is-highlighted' : ''}">
            <div class="step-dot"></div>
            <div class="step-tool-column">
                <button onclick="toggleStepHighlight(${i})" class="step-tool-btn ${s.isHigh ? 'active' : ''}">🚩</button>
                <label class="step-tool-btn" style="opacity:0.3; cursor:pointer;">
                    📷<input type="file" class="hidden" accept="image/*" onchange="handleStepImg(${i}, this)">
                </label>
            </div>
            <div class="step-content">
                <div class="flex w-full">
                    <textarea class="step-action-input" rows="1" oninput="updateTransitStep(${i}, 'action', this.value); autoResizeTextarea(this)" placeholder="標題">${s.action || ''}</textarea>
                    <textarea class="step-detail-input" rows="1" oninput="updateTransitStep(${i}, 'detail', this.value); autoResizeTextarea(this)" placeholder="輸入細節">${s.detail || ''}</textarea>
                </div>
                <div class="step-img-container">
                    ${(s.imgs || []).map((img, imgIdx) => `
                        <img src="${img}" class="step-img-thumb" onclick="openLightbox(${i}, ${imgIdx}, '${img}')">
                    `).join('')}
                </div>
            </div>
            <button onclick="removeTransitStep(${i})" class="step-delete-btn">✕</button>
        </div>
    `).join('');

    requestAnimationFrame(() => {
        container.querySelectorAll('textarea').forEach(tx => autoResizeTextarea(tx));
    });
}

async function handleStepImg(stepIdx, input) {
    if (!input.files || !input.files[0]) return;
    try {
        const compressedBase64 = await utils.compressImage(input.files[0], 1200, 0.8);
        await saveStepImg(stepIdx, compressedBase64);
    } catch (err) {
        console.error(err);
        alert("圖片處理發生錯誤");
    }
}

async function saveStepImg(stepIdx, base64) {
    let data = await fetchData('schedule', '[]');
    if (data[currentTransIdx] && data[currentTransIdx].transitSteps) {
        let step = data[currentTransIdx].transitSteps[stepIdx];
        if (!step.imgs) step.imgs = [];
        step.imgs.push(base64);
        await saveData('schedule', data);
        renderTransitTimeline(data[currentTransIdx].transitSteps);
    }
}

function openLightbox(stepIdx, imgIdx, src, extra = null) {
    const lb = document.getElementById('trans-lightbox');
    const img = document.getElementById('lightbox-img');
    
    lb.classList.remove('guide-mode');

    if (extra && extra.type === 'guide') {
        currentLightboxTarget = { type: 'guide' };
        lb.classList.add('guide-mode');
    } else if (extra && extra.type === 'expense') {
        currentLightboxTarget = { type: 'expense', expenseId: extra.id };
    } else {
        currentLightboxTarget = { type: 'schedule', stepIdx, imgIdx };
    }
    
    img.src = src;
    lb.classList.add('active');
    document.body.style.overflow = 'hidden'; 
}

async function confirmDeleteStepImg() {
    if (!confirm("確定要刪除這張圖片嗎？")) return;
    
    if (currentLightboxTarget.type === 'expense') {
        if (typeof deleteExpensePhoto === 'function') {
            await deleteExpensePhoto(currentLightboxTarget.expenseId);
        }
    } else {
        let data = await fetchData('schedule', '[]');
        const { stepIdx, imgIdx } = currentLightboxTarget;
        if (data[currentTransIdx] && data[currentTransIdx].transitSteps[stepIdx]) {
            data[currentTransIdx].transitSteps[stepIdx].imgs.splice(imgIdx, 1);
            await saveData('schedule', data);
            document.getElementById('trans-lightbox').classList.remove('active');
            renderTransitTimeline(data[currentTransIdx].transitSteps);
        }
    }
}

function closeLightbox(e) {
    if (!e || e.target.id === 'trans-lightbox' || e.target.classList.contains('lightbox-content')) {
        document.getElementById('trans-lightbox').classList.remove('active');
        document.body.style.overflow = '';
    }
}

async function toggleStepHighlight(stepIdx) {
    let data = await fetchData('schedule', '[]');
    if (data[currentTransIdx] && data[currentTransIdx].transitSteps) {
        let step = data[currentTransIdx].transitSteps[stepIdx];
        step.isHigh = !step.isHigh;
        await saveData('schedule', data);
        renderTransitTimeline(data[currentTransIdx].transitSteps);
    }
}

async function updateTransitStep(stepIdx, field, value) {
    let data = await fetchData('schedule', '[]');
    if (data[currentTransIdx] && data[currentTransIdx].transitSteps) {
        if (data[currentTransIdx].transitSteps[stepIdx]) {
            data[currentTransIdx].transitSteps[stepIdx][field] = value;
            await saveData('schedule', data);
        }
    }
}

async function addTransitStep() {
    let data = await fetchData('schedule', '[]');
    if (data[currentTransIdx]) {
        if (!data[currentTransIdx].transitSteps) {
            data[currentTransIdx].transitSteps = [];
        }
        const newStep = { action: "轉乘/步行", detail: "請輸入說明", isHigh: false, imgs: [] };
        const insertAt = Math.max(0, data[currentTransIdx].transitSteps.length - 1);
        data[currentTransIdx].transitSteps.splice(insertAt, 0, newStep);
        await saveData('schedule', data);
        renderTransitTimeline(data[currentTransIdx].transitSteps);
    }
}

async function removeTransitStep(stepIdx) {
    let data = await fetchData('schedule', '[]');
    if (data[currentTransIdx] && data[currentTransIdx].transitSteps) {
        data[currentTransIdx].transitSteps.splice(stepIdx, 1);
        await saveData('schedule', data);
        renderTransitTimeline(data[currentTransIdx].transitSteps);
    }
}

function copyDestName(text) {
    if (!text || text === "未定") return;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.querySelector('.copy-btn');
        if (btn) {
            const originalText = btn.innerText;
            btn.innerText = "✅ 已複製";
            btn.style.color = "#059669";
            setTimeout(() => {
                btn.innerText = originalText;
                btn.style.color = "";
            }, 1500);
        }
    });
}

/* ==========================================
   6. 通用工具函式
   ========================================== */
function toggleCard(el) { el.classList.toggle('expanded'); }

function closeModal(e) { 
    if (!e || e.target.id === 'modal-overlay') {
        document.getElementById('modal-overlay').classList.remove('active'); 
    }
}

function toggleCat(el) {
    const catText = el.innerText || el.catText; 
    document.querySelectorAll('#cat-pills .pill').forEach(p => p.classList.toggle('selected', p.innerText === catText));
    document.getElementById('flight-fields').classList.toggle('hidden', catText !== '飛機');
    document.getElementById('normal-fields').classList.toggle('hidden', catText === '飛機');
}

function toggleTransport(el) { 
    document.querySelectorAll('#transport-pills .pill').forEach(p => p.classList.remove('selected')); 
    el.classList.add('selected'); 
}

function autoResizeTextarea(el) {
    if (!el) return;
    el.style.height = 'auto'; 
    const newHeight = el.scrollHeight + 'px';
    el.style.height = newHeight;
}

function moveNote(btn, direction) {
    const row = btn.closest('.note-input-row');
    if (direction === 'up' && row.previousElementSibling) {
        row.parentNode.insertBefore(row, row.previousElementSibling);
    } else if (direction === 'down' && row.nextElementSibling) {
        row.parentNode.insertBefore(row.nextElementSibling, row);
    }
}

function addNoteInput(val = "", icon = "📌", img = "") {
    const container = document.getElementById('notes-container'); 
    const div = document.createElement('div');
    div.className = "note-input-row mb-3";
    const iconList = ['📌', '⌛', '📢', '‼️', '📸', '🍀', '⚡', '▶️', '🍹', '🍴', '💕'];
    
    div.innerHTML = `
        <div class="note-input-v2-row">
            <div class="flex flex-col items-center gap-1.5 flex-shrink-0">
                <select class="note-icon-select">
                    ${iconList.map(k => `<option ${k===icon?'selected':''}>${k}</option>`).join('')}
                </select>
                <div class="flex gap-1">
                    <button onclick="moveNote(this, 'up')" class="note-sort-mini-btn">▲</button>
                    <button onclick="moveNote(this, 'down')" class="note-sort-mini-btn">▼</button>
                </div>
            </div>
            <textarea class="note-textarea-v2" placeholder="請輸入細節......" oninput="autoResizeTextarea(this)">${val}</textarea>
            <div class="flex flex-col gap-1.5 flex-shrink-0">
                <label class="note-tool-btn">
                    📷<input type="file" class="hidden" accept="image/*" onchange="handleNoteImg(this)">
                </label>
                <button onclick="this.closest('.note-input-row').remove()" class="note-tool-btn text-red-400">✕</button>
            </div>
        </div>
        <div class="note-preview-img mt-2">${img ? `<img src="${img}" class="note-img-preview">` : ''}</div>`;
        
    container.appendChild(div);
    if(val) {
        const tx = div.querySelector('textarea');
        setTimeout(() => autoResizeTextarea(tx), 10);
    }
}

function handleNoteImg(input) { 
    if (input.files && input.files[0]) { 
        const reader = new FileReader(); 
        reader.onload = (e) => input.parentElement.parentElement.parentElement.nextElementSibling.innerHTML = `<img src="${e.target.result}" class="note-img-preview">`; 
        reader.readAsDataURL(input.files[0]); 
    } 
}

async function handleModalPreviewImg(input) { 
    if (input.files && input.files[0]) { 
        try {
            modalPreviewImgBase64 = await utils.compressImage(input.files[0], 1200, 0.8);
            document.getElementById('modal-preview-img-box').innerHTML = 
                `<img src="${modalPreviewImgBase64}" class="w-full h-full object-cover">`; 
        } catch (err) {
            alert("預覽圖處理失敗");
        }
    } 
}

function renderAuthorSelector(currentValue = "") {
    const container = document.getElementById('author-selector');
    if (!container) return;
    container.className = "author-selector-box"; 
    const list = JSON.parse(localStorage.getItem('editorList') || '[]');
    selectedAuthor = currentValue; 
    let html = `<div class="author-pill ${selectedAuthor === '' ? 'active' : ''}" onclick="pickAuthor('', this)">不顯示</div>`;
    list.forEach(name => { 
        html += `<div class="author-pill ${selectedAuthor === name ? 'active' : ''}" onclick="pickAuthor('${name}', this)">${name}</div>`; 
    });
    html += `<div class="author-pill" onclick="addNewAuthor()" style="border-style: dashed; color: var(--honey-orange);">+ 新增</div>`;
    container.innerHTML = html;
}

function pickAuthor(name, el) { 
    selectedAuthor = name; 
    document.querySelectorAll('.author-pill').forEach(p => p.classList.remove('active')); 
    if (el) el.classList.add('active'); 
}

function addNewAuthor() { 
    const name = prompt("輸入新的編輯者暱稱："); 
    if (name) { 
        addToEditorList(name.trim()); 
        renderAuthorSelector(name.trim()); 
    } 
}