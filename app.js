// 内置默认数据，防止首次打开没有本地存储及服务器CORS导致无法加载link.json的情况

let state = {
    columns: [],
    links: [],
    colors: ["#0000ff", "#800080", "#ff0000", "#000000", "#ffffff"],
    panelWidth: 800,
    poemStyle: {
        color: '#e8e1c8',
        fontSize: 21,
        fontCssUrl: 'https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/style.css',
        fontFamily: 'LXGW WenKai'
    },
    pageVisibility: { todo: true, prompts: true, poem: true, dice: true, ai: true },
    aiConfig: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo', apiKey: '' },
    diceConfig: { count: 3, type: 'd6' }
};
let sideState = { todo: [], prompts: [], poem: [], dice: [], ai: [] };
let activeFeature = null;
let currentAiChat = { id: null, messages: [] };
let draggedItem = { type: null, id: null };
let isResizingPanel = false;
let resizeStartX = 0;
let resizeStartWidth = 800;

// 十六进制颜色转RGB用于背景和发光效果计算
function hexToRgb(hex) {
    let m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [255, 255, 255];
}

// 初始化读取数据
async function init() {
    let saved = localStorage.getItem('e-desktop-data');
    if (saved) {
        try {
            state = JSON.parse(saved);
            if(!state.colors) state.colors = ["#0000ff", "#800080", "#ff0000", "#000000", "#ffffff"];
            if(!state.aiConfig) state.aiConfig = { baseUrl: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo', apiKey: '' };
            if(!state.diceConfig) state.diceConfig = { count: 1, type: 'd6' };
            ensurePageVisibility()
            if(typeof state.panelWidth !== 'number' || Number.isNaN(state.panelWidth)) state.panelWidth = 800;
        } catch(e) {
            state = JSON.parse(JSON.stringify(window.DEFAULT_DATA));
        }
        applyPoemStyle();
        renderLinks();
    } else {
        try {
            let res = await fetch('link.json');
            if(res.ok) {
                state = await res.json();
                if(!state.colors) state.colors = ["#0000ff", "#800080", "#ff0000", "#000000", "#ffffff"];
                ensurePageVisibility()
                if(typeof state.panelWidth !== 'number' || Number.isNaN(state.panelWidth)) state.panelWidth = 800;
                saveData(false);
            } else {
                throw new Error();
            }
        } catch(e) {
            // 若fetch失败(如未开启本地服务器跨域失败) 将使用内嵌数据
            state = JSON.parse(JSON.stringify(window.DEFAULT_DATA));
            saveData(false);
        }
        applyPoemStyle();
        renderLinks();
    }
}

function initRightPanel() {
    loadSideData();
    updateTime();
    setInterval(updateTime, 1000);
    applyPoemStyle();
    fetchPoem();
    renderFeatureList('todo');
    renderFeatureList('prompts');
    renderFeatureList('poem');
    renderFeatureList('dice');
    renderFeatureList('ai');
    bindFeatureInputEnter('todo-input', 'todo');
    bindFeatureInputEnter('prompts-input', 'prompts');
    bindFeatureInputEnter('poem-input', 'poem');
    applyPageVisibility();
    initRightPanelResize();
}

function ensurePageVisibility() {
    const defaults = { todo: true, prompts: true, poem: true, dice: true, ai: true };
    if (!state.pageVisibility) state.pageVisibility = {};
    for (let key of Object.keys(defaults)) {
        if (state.pageVisibility[key] === undefined) state.pageVisibility[key] = defaults[key];
    }
}

function ensurePoemStyle() {
    if (!state.poemStyle || typeof state.poemStyle !== 'object') {
        state.poemStyle = {
            color: '#e8e1c8',
            fontSize: 21,
            fontCssUrl: 'https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/style.css',
            fontFamily: 'LXGW WenKai'
        };
        return;
    }
    if (!state.poemStyle.color) state.poemStyle.color = '#e8e1c8';
    let fontSize = Number(state.poemStyle.fontSize);
    if (Number.isNaN(fontSize)) {
        state.poemStyle.fontSize = 21;
    } else {
        state.poemStyle.fontSize = Math.max(14, Math.min(48, fontSize));
    }
    if (typeof state.poemStyle.fontCssUrl !== 'string') state.poemStyle.fontCssUrl = 'https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/style.css';
    if (typeof state.poemStyle.fontFamily !== 'string') state.poemStyle.fontFamily = 'LXGW WenKai';
    state.poemStyle.fontCssUrl = state.poemStyle.fontCssUrl.trim();
    state.poemStyle.fontFamily = state.poemStyle.fontFamily.trim();
}

function applyPoemFontSource() {
    ensurePoemStyle();
    let head = document.head || document.getElementsByTagName('head')[0];
    let fontLink = document.getElementById('poem-font-link');
    let url = state.poemStyle.fontCssUrl;

    if (!url) {
        if (fontLink) fontLink.remove();
        return;
    }

    if (!fontLink) {
        fontLink = document.createElement('link');
        fontLink.id = 'poem-font-link';
        fontLink.rel = 'stylesheet';
        head.appendChild(fontLink);
    }
    if (fontLink.href !== url) {
        fontLink.href = url;
    }
}

function applyPoemStyle() {
    ensurePoemStyle();
    applyPoemFontSource();
    let poemEl = document.getElementById('info-poem');
    if (!poemEl) return;
    poemEl.style.color = state.poemStyle.color;
    poemEl.style.fontSize = state.poemStyle.fontSize + 'px';
    poemEl.style.fontFamily = state.poemStyle.fontFamily || 'inherit';
}

function initRightPanelResize() {
    let panel = document.querySelector('.right-panel');
    if (!panel) return;
    // 迁移旧版 localStorage 宽度值
    let legacyWidth = localStorage.getItem('e-desktop-right-width');
    if (legacyWidth !== null) {
        let w = parseInt(legacyWidth, 10);
        if (!Number.isNaN(w)) state.panelWidth = Math.max(280, Math.min(800, w));
        localStorage.removeItem('e-desktop-right-width');
        saveData(false);
    }
    if (typeof state.panelWidth !== 'number' || Number.isNaN(state.panelWidth)) {
        state.panelWidth = 800;
    }
    state.panelWidth = Math.max(280, Math.min(800, state.panelWidth));
    if (window.innerWidth > 1100) {
        panel.style.width = state.panelWidth + 'px';
    }

    window.addEventListener('mousemove', function(event) {
        if (!isResizingPanel) return;
        let delta = resizeStartX - event.clientX;
        let nextWidth = resizeStartWidth + delta;
        state.panelWidth = Math.max(280, Math.min(window.innerWidth * 0.7, nextWidth));
        panel.style.width = state.panelWidth + 'px';
    });

    window.addEventListener('mouseup', function() {
        if (!isResizingPanel) return;
        isResizingPanel = false;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        saveData(false);
    });
}

function startPanelResize(event) {
    if (window.innerWidth <= 1100) return;
    event.preventDefault();
    let panel = document.querySelector('.right-panel');
    if (!panel) return;
    isResizingPanel = true;
    resizeStartX = event.clientX;
    resizeStartWidth = panel.getBoundingClientRect().width;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
}

function updatePanelWidth(value) {
    let w = Math.max(280, Math.min(800, Number(value) || 800));
    state.panelWidth = w;
    let panel = document.querySelector('.right-panel');
    if (panel && window.innerWidth > 1100) {
        panel.style.width = w + 'px';
    }
    let range = document.getElementById('panel-width-range');
    let input = document.getElementById('panel-width-input');
    if (range) range.value = w;
    if (input) input.value = w;
    saveData(false);
}

function loadSideData() {
    let saved = localStorage.getItem('e-desktop-side-data');
    if (!saved) return;
    try {
        let parsed = JSON.parse(saved);
        sideState.todo = Array.isArray(parsed.todo) ? parsed.todo : [];
        sideState.prompts = Array.isArray(parsed.prompts) ? parsed.prompts : [];
        sideState.poem = Array.isArray(parsed.poem) ? parsed.poem : [];
        sideState.dice = Array.isArray(parsed.dice) ? parsed.dice : [];
        sideState.ai = Array.isArray(parsed.ai) ? parsed.ai : [];
    } catch (e) {
        sideState = { todo: [], prompts: [], poem: [], dice: [], ai: [] };
    }
}

function saveSideData() {
    localStorage.setItem('e-desktop-side-data', JSON.stringify(sideState));
}

function applyPageVisibility() {
    ensurePageVisibility();
    ['todo', 'prompts', 'poem', 'dice', 'ai'].forEach(type => {
        let btn = document.getElementById('toggle-' + type);
        if (btn) btn.style.display = state.pageVisibility[type] ? '' : 'none';
    });
}

function togglePageVisibility(key, checked) {
    ensurePageVisibility();
    state.pageVisibility[key] = checked;
    saveData(false);
    applyPageVisibility();
}

function updateTime() {
    let now = new Date();
    let date = now.toLocaleDateString('zh-CN', { weekday: 'long', month: '2-digit', day: '2-digit' });
    let time = now.toLocaleTimeString('zh-CN', { hour12: false });
    document.getElementById('info-time').textContent = `${date} ${time}`;
}

async function fetchPoem() {
    try {
        let res = await fetch('https://v1.jinrishici.com/all.json');
        if (!res.ok) throw new Error();
        let data = await res.json();
        let sentence = data.content ? data.content : '今日诗词暂不可用';
        let source = data.author && data.origin ? ` —— ${data.author}《${data.origin}》` : '';
        document.getElementById('info-poem').textContent = sentence + source;
    } catch (e) {
        document.getElementById('info-poem').textContent = '诗词: 获取失败';
    }
}

function bindFeatureInputEnter(inputId, type) {
    let input = document.getElementById(inputId);
    input.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') addItem(type);
    });
}

function toggleFeature(type) {
    activeFeature = activeFeature === type ? null : type;
    let labels = { todo: '待办', prompts: '提示词', poem: '诗词', dice: '骰子', ai: 'AI' };
    ['todo', 'prompts', 'poem', 'dice', 'ai'].forEach(t => {
        let btn = document.getElementById('toggle-' + t);
        let panel = document.getElementById('feature-' + t);
        if (!btn || !panel) return;
        btn.classList.toggle('active', activeFeature === t);
        btn.textContent = (activeFeature === t ? '↑ ' : '↓ ') + labels[t];
        panel.classList.toggle('active', activeFeature === t);
    });

    if (type === 'dice' || activeFeature !== 'dice') {
        handleDiceScene(activeFeature === 'dice');
    }
}

function addItem(type) {
    let input = document.getElementById(type + '-input');
    let text = input.value.trim();
    if (!text) return;
    sideState[type].push({ id: type + '_' + Date.now(), text: text });
    input.value = '';
    saveSideData();
    renderFeatureList(type);
}

function deleteItem(type, id) {
    sideState[type] = sideState[type].filter(item => item.id !== id);
    saveSideData();
    if (type === 'ai' && currentAiChat.id === id) {
        currentAiChat = { id: null, messages: [] };
        renderAiChat();
    }
    renderFeatureList(type);
}

async function copyItem(type, id) {
    let item = sideState[type].find(entry => entry.id === id);
    if (!item) return;
    let text = item.text;
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return;
        }
        let textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    } catch (e) {
        alert('复制失败，请检查浏览器权限');
    }
}

function addCurrentPoem() {
    let poemText = document.getElementById('info-poem').textContent;
    if (!poemText || poemText === '诗词加载中...' || poemText === '今日诗词暂不可用' || poemText === '诗词: 获取失败') return;
    sideState.poem.unshift({ id: 'poem_' + Date.now(), text: poemText });
    saveSideData();
    renderFeatureList('poem');
}

function exportPoemsTxt() {
    if (!sideState.poem || sideState.poem.length === 0) {
        alert('没有可以导出的诗词。');
        return;
    }
    let content = sideState.poem.map(item => item.text).join('\n');
    let blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = 'poems.txt';
    a.click();
    URL.revokeObjectURL(url);
}

function renderFeatureList(type) {
    let listEl = document.getElementById(type + '-list');
    if (!listEl) return;
    
    let items = sideState[type];
    if (!items.length) {
        listEl.innerHTML = `<li class="item-empty">暂无内容</li>`;
        return;
    }

    listEl.innerHTML = items.map(item => {
        let copyBtn = (type === 'prompts' || type === 'poem')
            ? `<button class="item-btn" onclick="copyItem('${type}', '${item.id}')">复制</button>`
            : '';
        return `<li class="item" draggable="true"
            ondragstart="startDragItem(event, '${type}', '${item.id}')"
            ondragover="dragOverItem(event)"
            ondragenter="dragEnterItem(event)"
            ondragleave="dragLeaveItem(event)"
            ondrop="dropItem(event, '${type}', '${item.id}')"
            ondragend="dragEndItem(event)">
            <span style="color:#8ea6c0">☰</span>
            <span class="item-text" onclick="startEditItem('${type}', '${item.id}', this)">${escapeHtml(item.text)}</span>
            ${copyBtn}
            <button class="item-btn delete" onclick="deleteItem('${type}', '${item.id}')">删除</button>
        </li>`;
    }).join('');
}

function startEditItem(type, id, textEl) {
    if (!textEl || textEl.querySelector('input')) return;
    let item = sideState[type].find(entry => entry.id === id);
    if (!item) return;

    let original = item.text;
    let input = document.createElement('input');
    input.type = 'text';
    input.value = original;
    input.style.width = '100%';

    input.addEventListener('click', function(event) {
        event.stopPropagation();
    });

    input.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            input.blur();
        } else if (event.key === 'Escape') {
            input.value = original;
            input.blur();
        }
    });

    input.addEventListener('blur', function() {
        let nextText = input.value.trim();
        if (nextText) {
            item.text = nextText;
            saveSideData();
        }
        renderFeatureList(type);
    });

    textEl.innerHTML = '';
    textEl.appendChild(input);
    input.focus();
    input.select();
}

function escapeHtml(str) {
    return str.replace(/[&<>"]/g, function(c) {
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
}

function startDragItem(event, type, id) {
    draggedItem = { type: type, id: id };
    event.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
        event.target.style.opacity = '0.45';
    }, 0);
}

function dragOverItem(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
}

function dragEnterItem(event) {
    event.preventDefault();
    let row = event.target.closest('.item');
    if (row) row.classList.add('drag-over');
}

function dragLeaveItem(event) {
    let row = event.target.closest('.item');
    if (row) row.classList.remove('drag-over');
}

function dragEndItem(event) {
    event.target.style.opacity = '';
    document.querySelectorAll('.item.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function dropItem(event, type, targetId) {
    event.preventDefault();
    let row = event.target.closest('.item');
    if (row) row.classList.remove('drag-over');
    if (!draggedItem.id || draggedItem.type !== type || draggedItem.id === targetId) return;

    let arr = sideState[type];
    let fromIndex = arr.findIndex(item => item.id === draggedItem.id);
    let toIndex = arr.findIndex(item => item.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    let [moved] = arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, moved);
    saveSideData();
    renderFeatureList(type);
    draggedItem = { type: null, id: null };
}

function sortLinksByColumn() {
    let colOrder = {};
    state.columns.forEach((c, idx) => colOrder[c.id] = idx);
    state.links.sort((a, b) => {
        let orderA = colOrder[a.columnId] !== undefined ? colOrder[a.columnId] : 999;
        let orderB = colOrder[b.columnId] !== undefined ? colOrder[b.columnId] : 999;
        return orderA - orderB;
    });
}

function saveData(render = true) {
    ensurePoemStyle();
    sortLinksByColumn();
    localStorage.setItem('e-desktop-data', JSON.stringify(state));
    if(render) {
        renderLinks();
        applyPoemStyle();
        if(document.getElementById('settings-modal').style.display === 'flex') {
            renderEditor();
        }
    }
}

// 渲染主页按钮标签
function renderLinks() {
    const container = document.getElementById('links-container');
    container.innerHTML = '';

    state.columns.forEach(col => {
        let visibleLinks = state.links.filter(l => l.columnId === col.id && l.visible);
        if (visibleLinks.length === 0) return; // 隐藏空栏目

        let colDiv = document.createElement('div');
        colDiv.className = 'wrap_col';

        visibleLinks.forEach(link => {
            let a = document.createElement('a');
            a.className = 'button-custom';
            a.textContent = link.text;
            a.onclick = () => window.open(link.url, '_blank');

            // 设置动态CSS变量给伪元素使用
            a.style.setProperty('--btn-color', link.color);
            const rgb = hexToRgb(link.color);
            a.style.setProperty('--btn-bg', `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.25)`);
            a.style.setProperty('--btn-hover', `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.75)`);

            colDiv.appendChild(a);
        });

        container.appendChild(colDiv);
    });
}

/* ----- 弹窗控制与编辑器 ----- */

function openSettings() {
    ensurePoemStyle();
    sortLinksByColumn();
    document.getElementById('settings-modal').style.display = 'flex';
    renderEditor();
}
function closeSettings() {
    document.getElementById('settings-modal').style.display = 'none';
}

window.collapsedTagCols = window.collapsedTagCols || {};
window.toggleTagGroup = function(colId) {
    if (colId === 'null') colId = null;
    window.collapsedTagCols[colId] = !window.collapsedTagCols[colId];
    renderEditor();
};

function renderEditor() {
    ensurePoemStyle();

    // 渲染颜色编辑器
    let colorHtml = `<div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">`;
    state.colors.forEach((c, idx) => {
        colorHtml += `<div style="display: flex; align-items: center; background: #333; padding: 5px 10px; border-radius: 20px;">
            <div style="width: 20px; height: 20px; border-radius: 50%; background-color: ${c}; margin-right: 10px; border: 1px solid #fff;"></div>
            <span style="margin-right: 10px;">${c}</span>
            <button class="btn-danger btn-action" style="padding: 2px 6px; border-radius: 50%; font-size: 12px;" onclick="deleteColor(${idx})">×</button>
        </div>`;
    });
    colorHtml += `<input type="color" id="new-color-input" value="#00ff00" style="width:40px;height:30px;padding:2px;border-radius:4px;">
    <button class="btn-success" onclick="addColor()">添加颜色</button></div>`;
    document.getElementById('color-editor').innerHTML = colorHtml;

    // 渲染页面可见性编辑器
    ensurePageVisibility();
    let visHtml = `<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;background:#2a2a2a;padding:12px 14px;border-radius:10px;">`;
    let visLabels = { todo: '待办事项', prompts: '提示词记录', poem: '诗词记录', dice: '骰子', ai: 'AI' };
    for (let [key, label] of Object.entries(visLabels)) {
        visHtml += `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
            <input type="checkbox" ${state.pageVisibility[key] ? 'checked' : ''} onchange="togglePageVisibility('${key}', this.checked)"> ${label}
        </label>`;
    }
    visHtml += `</div>`;
    document.getElementById('page-visibility-editor').innerHTML = visHtml;

    // 渲染 AI 配置编辑器
    if(!state.aiConfig) state.aiConfig = { baseUrl: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo', apiKey: '', systemPrompt: '' };
    if(state.aiConfig.systemPrompt === undefined) state.aiConfig.systemPrompt = '';
    let aiConfigHtml = `<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;background:#2a2a2a;padding:12px 14px;border-radius:10px;">
        <label style="display:flex;align-items:center;gap:8px;flex:1 1 100%;">API Base URL
            <input type="text" id="ai-baseUrl" placeholder="https://api.openai.com/v1" value="${escapeHtml(state.aiConfig.baseUrl)}" onchange="updateAiConfig('baseUrl', this.value)" style="flex:1;">
        </label>
        <label style="display:flex;align-items:center;gap:8px;flex:1 1 100%;">模型 (Model)
            <input type="text" id="ai-model" placeholder="gpt-3.5-turbo" value="${escapeHtml(state.aiConfig.model)}" onchange="updateAiConfig('model', this.value)" style="flex:1;">
        </label>
        <label style="display:flex;align-items:center;gap:8px;flex:1 1 100%;">API Key
            <input type="password" id="ai-apiKey" placeholder="sk-..." value="${escapeHtml(state.aiConfig.apiKey)}" onchange="updateAiConfig('apiKey', this.value)" style="flex:1;">
        </label>
        <label style="display:flex;align-items:center;gap:8px;flex:1 1 100%;">系统提示词 (System Prompt)
            <textarea id="ai-systemPrompt" placeholder="You are a helpful assistant." onchange="updateAiConfig('systemPrompt', this.value)" style="flex:1; height: 60px; font-family: inherit; padding: 4px; border-radius: 4px; border: 1px solid #555; background: #333; color: white;">${escapeHtml(state.aiConfig.systemPrompt)}</textarea>
        </label>
    </div>`;
    document.getElementById('ai-config-editor').innerHTML = aiConfigHtml;

    // 渲染骰子配置编辑器
    if(!state.diceConfig) state.diceConfig = { count: 1, type: 'd6' };
    let diceConfigHtml = `<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;background:#2a2a2a;padding:12px 14px;border-radius:10px;">
        <label style="display:flex;align-items:center;gap:8px;">骰子数量
            <input type="number" id="dice-count" min="1" max="20" placeholder="1" value="${state.diceConfig.count}" onchange="updateDiceConfig('count', this.value)" style="width:80px;">
        </label>
        <label style="display:flex;align-items:center;gap:8px;">骰子类型
            <select id="dice-type" onchange="updateDiceConfig('type', this.value)" style="padding:4px; border-radius:4px; border:1px solid #555; background:#333; color:white;">
                <option value="d4" ${state.diceConfig.type === 'd4' ? 'selected' : ''}>D4 (四面)</option>
                <option value="d6" ${state.diceConfig.type === 'd6' ? 'selected' : ''}>D6 (六面)</option>
                <option value="d8" ${state.diceConfig.type === 'd8' ? 'selected' : ''}>D8 (八面)</option>
                <option value="d10" ${state.diceConfig.type === 'd10' ? 'selected' : ''}>D10 (十面)</option>
                <option value="d12" ${state.diceConfig.type === 'd12' ? 'selected' : ''}>D12 (十二面)</option>
                <option value="d20" ${state.diceConfig.type === 'd20' ? 'selected' : ''}>D20 (二十面)</option>
            </select>
        </label>
    </div>`;
    document.getElementById('dice-config-editor').innerHTML = diceConfigHtml;

    // 渲染右侧面板宽度编辑器
    let panelWidthHtml = `<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;background:#2a2a2a;padding:12px 14px;border-radius:10px;">
        <label style="display:flex;align-items:center;gap:8px;">面板宽度
            <input type="range" id="panel-width-range" min="280" max="800" step="10" value="${state.panelWidth}" oninput="updatePanelWidth(this.value)" style="width:160px;">
            <input type="number" id="panel-width-input" min="280" max="800" step="10" value="${state.panelWidth}" onchange="updatePanelWidth(this.value)" style="width:80px;">
            <span>px</span>
        </label>
        <span style="color:#888;font-size:0.85em;">范围 280 ~ 800，也可直接拖拽面板左边缘</span>
    </div>`;
    document.getElementById('panel-width-editor').innerHTML = panelWidthHtml;

    // 渲染每日诗词样式编辑器
    let poemStyleHtml = `<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;background:#2a2a2a;padding:12px 14px;border-radius:10px;">
        <label style="display:flex;align-items:center;gap:8px;">字体颜色
            <input type="color" id="poem-color-input" value="${state.poemStyle.color}" onchange="updatePoemStyle('color', this.value)">
        </label>
        <label style="display:flex;align-items:center;gap:8px;">字体大小
            <input type="range" id="poem-font-size-range" min="14" max="48" step="1" value="${state.poemStyle.fontSize}" oninput="updatePoemStylePreview(this.value)">
            <input type="number" id="poem-font-size-input" min="14" max="48" step="1" value="${state.poemStyle.fontSize}" onchange="updatePoemStyle('fontSize', this.value)" style="width:80px;">
            <span>px</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;flex:1 1 380px;">字体网站链接
            <input type="text" id="poem-font-css-url" placeholder="https://.../style.css" value="${escapeHtml(state.poemStyle.fontCssUrl)}" onchange="updatePoemStyle('fontCssUrl', this.value)" style="width:100%;min-width:240px;">
        </label>
        <label style="display:flex;align-items:center;gap:8px;">字体名称
            <input type="text" id="poem-font-family" placeholder="LXGW WenKai" value="${escapeHtml(state.poemStyle.fontFamily)}" onchange="updatePoemStyle('fontFamily', this.value)" style="width:180px;">
        </label>
    </div>`;
    document.getElementById('poem-style-editor').innerHTML = poemStyleHtml;

    // 渲染栏目编辑器
    let colHtml = `<table><tr><th width="20%">栏目ID (不可改)</th><th width="30%">栏目名称</th><th width="30%">统一更改标签颜色</th><th width="20%">操作</th></tr>`;
    state.columns.forEach((c, idx) => {
        let colColorOpts = `<option value="">--选择颜色--</option>` + state.colors.map(color => `<option value="${color}">${color}</option>`).join('');
        colHtml += `<tr>
            <td style="color:#aaa">${c.id}</td>
            <td><input type="text" value="${c.name}" onchange="updateCol('${c.id}', this.value)"></td>
            <td>
                <select id="bulk-color-${c.id}" style="width: 100px;">${colColorOpts}</select>
                <button class="btn-action" onclick="bulkChangeColor('${c.id}')">应用</button>
            </td>
            <td>
                <button class="btn-action" title="向左移动" onclick="moveColUp('${c.id}')" ${idx === 0 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>↑</button>
                <button class="btn-action" title="向右移动" onclick="moveColDown('${c.id}')" ${idx === state.columns.length - 1 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>↓</button>
                <button class="btn-danger btn-action" onclick="deleteCol('${c.id}')">删除</button>
            </td>
        </tr>`;
    });
    colHtml += `</table><button class="btn-success" onclick="addCol()" style="margin-top:10px;">+ 添加新栏目</button>`;
    document.getElementById('col-editor').innerHTML = colHtml;

    // 渲染标签编辑器
    let linkHtml = `<table><tr><th width="20%">文本名称</th><th width="25%">重定向链接URL</th><th width="15%">主题色</th><th width="5%">显示</th><th width="15%">所属栏目</th><th width="20%">操作</th></tr>`;
    
    let lastColumnId = '___INITIAL_NONE___';
    
    state.links.forEach((l, idx) => {
        if (l.columnId !== lastColumnId) {
            lastColumnId = l.columnId;
            let currentColumn = state.columns.find(c => c.id === lastColumnId);
            let colName = currentColumn ? currentColumn.name : '未分配栏目';
            let toggleId = lastColumnId === null ? 'null' : lastColumnId;
            let isCollapsed = window.collapsedTagCols && window.collapsedTagCols[toggleId];
            
            linkHtml += `<tr style="background:#444; border-top: 2px solid #555;">
                <td colspan="6" style="text-align:left; cursor:pointer; padding: 8px;" onclick="window.toggleTagGroup('${toggleId}')">
                    <span style="display:inline-block; width: 20px;">${isCollapsed ? '▶' : '▼'}</span>
                    <strong>${escapeHtml(colName)}</strong>
                </td>
            </tr>`;
        }
        
        let toggleIdCheck = l.columnId === null ? 'null' : l.columnId;
        if (window.collapsedTagCols && window.collapsedTagCols[toggleIdCheck]) return;

        let colOpts = state.columns.map(c => `<option value="${c.id}" ${l.columnId===c.id?'selected':''}>${c.name}</option>`).join('');
        let colorOpts = state.colors.map(color => `<option value="${color}" ${l.color===color?'selected':''} style="background-color:${color};color:${hexToBrightness(color)>128?'#000':'#fff'}">${color}</option>`).join('');

        // 如果标签颜色不在当前颜色列表中，添加一个临时选项
        if(!state.colors.includes(l.color)){
            colorOpts = `<option value="${l.color}" selected style="background-color:${l.color};color:${hexToBrightness(l.color)>128?'#000':'#fff'}">${l.color} (未保存)</option>` + colorOpts;
        }

        linkHtml += `<tr draggable="true" ondragstart="dragStartLink(event, '${l.id}')" ondragover="dragOverLink(event)" ondrop="dropLink(event, '${l.id}')" ondragenter="dragEnterLink(event)" ondragleave="dragLeaveLink(event)">
            <td><input type="text" value="${l.text}" onchange="updateLink('${l.id}', 'text', this.value)"></td>
            <td><input type="text" value="${l.url}" onchange="updateLink('${l.id}', 'url', this.value)"></td>
            <td><select onchange="updateLink('${l.id}', 'color', this.value)" style="width:100%; background-color:${l.color}; color:${hexToBrightness(l.color)>128?'#000':'#fff'};">${colorOpts}</select></td>
            <td><input type="checkbox" ${l.visible?'checked':''} onchange="updateLink('${l.id}', 'visible', this.checked)"></td>
            <td><select onchange="updateLink('${l.id}', 'columnId', this.value)" style="width:100%;">${colOpts}</select></td>
            <td>
                <span style="cursor: grab; font-size: 20px; vertical-align: middle; margin-right: 10px;" title="拖动排序">☰</span>
                <button onclick="deleteLink('${l.id}')" class="btn-danger btn-action">删除</button>
            </td>
        </tr>`;
    });
    linkHtml += `</table><button class="btn-success" onclick="addLink()" style="margin-top:10px;">+ 添加新标签</button>`;
    document.getElementById('link-editor').innerHTML = linkHtml;
}

function hexToBrightness(hex) {
    let rgb = hexToRgb(hex);
    return Math.round(((parseInt(rgb[0]) * 299) +
              (parseInt(rgb[1]) * 587) +
              (parseInt(rgb[2]) * 114)) / 1000);
}

function updateAiConfig(field, value) {
    if(!state.aiConfig) state.aiConfig = { baseUrl: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo', apiKey: '' };
    state.aiConfig[field] = value.trim();
    saveData(false);
}

function updateDiceConfig(field, value) {
    if(!state.diceConfig) state.diceConfig = { count: 1, type: 'd6' };
    if(field === 'count') {
        let count = parseInt(value, 10);
        if(isNaN(count) || count < 1) count = 1;
        state.diceConfig.count = count;
    } else {
        state.diceConfig.type = value;
    }
    saveData(false);
}

function updatePoemStylePreview(value) {
    let size = Math.max(14, Math.min(48, Number(value) || 21));
    let input = document.getElementById('poem-font-size-input');
    if (input) input.value = size;
    updatePoemStyle('fontSize', size);
}

function updatePoemStyle(field, value) {
    ensurePoemStyle();
    if (field === 'color') {
        state.poemStyle.color = value;
    } else if (field === 'fontSize') {
        state.poemStyle.fontSize = Math.max(14, Math.min(48, Number(value) || 21));
        let range = document.getElementById('poem-font-size-range');
        let input = document.getElementById('poem-font-size-input');
        if (range) range.value = state.poemStyle.fontSize;
        if (input) input.value = state.poemStyle.fontSize;
    } else if (field === 'fontCssUrl') {
        state.poemStyle.fontCssUrl = String(value || '').trim();
    } else if (field === 'fontFamily') {
        state.poemStyle.fontFamily = String(value || '').trim();
    }
    saveData();
}

// 颜色修改函数
function addColor() {
    let newColorInfo = document.getElementById('new-color-input').value;
    if(!state.colors.includes(newColorInfo)){
        state.colors.push(newColorInfo);
        saveData();
    }
}
function deleteColor(idx) {
    state.colors.splice(idx, 1);
    saveData();
}
function bulkChangeColor(columnId) {
    let selectElem = document.getElementById('bulk-color-' + columnId);
    let selectedColor = selectElem.value;
    if(selectedColor) {
        state.links.forEach(l => {
            if(l.columnId === columnId) {
                l.color = selectedColor;
            }
        });
        saveData();
    } else {
        alert("请先选择一个颜色");
    }
}

// 栏目修改函数
function updateCol(id, name) {
    let col = state.columns.find(c => c.id === id);
    if(col) { col.name = name; saveData(); }
}
function addCol() {
    state.columns.push({ id: 'col_' + Date.now(), name: '新栏目' });
    saveData();
}
function deleteCol(id) {
    if(confirm('警告：确定删除此栏目及内部包含的所有标签吗？')) {
        state.columns = state.columns.filter(c => c.id !== id);
        state.links = state.links.filter(l => l.columnId !== id);
        saveData();
    }
}
function moveColUp(id) {
    let idx = state.columns.findIndex(c => c.id === id);
    if(idx > 0) {
        let temp = state.columns[idx - 1];
        state.columns[idx - 1] = state.columns[idx];
        state.columns[idx] = temp;
        saveData();
    }
}
function moveColDown(id) {
    let idx = state.columns.findIndex(c => c.id === id);
    if(idx < state.columns.length - 1 && idx !== -1) {
        let temp = state.columns[idx + 1];
        state.columns[idx + 1] = state.columns[idx];
        state.columns[idx] = temp;
        saveData();
    }
}

// 标签修改函数
function updateLink(id, field, value) {
    let link = state.links.find(l => l.id === id);
    if(link) { link[field] = value; saveData(); }
}
function addLink() {
    let targetColId = state.columns.length > 0 ? state.columns[0].id : '';
    state.links.push({
        id: 'l_' + Date.now(),
        text: '新标签',
        url: 'https://',
        color: '#ffffff',
        visible: true,
        columnId: targetColId
    });
    saveData();
}
function deleteLink(id) {
    state.links = state.links.filter(l => l.id !== id);
    saveData();
}

// 拖拽排序逻辑
let draggedLinkId = null;

function dragStartLink(event, id) {
    draggedLinkId = id;
    event.dataTransfer.effectAllowed = 'move';
    // 添加透明度以表示正在拖拽
    setTimeout(() => {
        event.target.style.opacity = '0.5';
    }, 0);
}

function dragOverLink(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
}

function dragEnterLink(event) {
    event.preventDefault();
    let tr = event.target.closest('tr');
    if (tr) tr.style.borderTop = '2px solid #fff'; // 提示放置位置
}

function dragLeaveLink(event) {
    let tr = event.target.closest('tr');
    if (tr) tr.style.borderTop = '';
}

function dropLink(event, id) {
    event.preventDefault();
    let tr = event.target.closest('tr');
    if (tr) tr.style.borderTop = ''; // 恢复样式

    if (draggedLinkId && draggedLinkId !== id) {
        let draggedIndex = state.links.findIndex(l => l.id === draggedLinkId);
        let targetIndex = state.links.findIndex(l => l.id === id);

        if (draggedIndex !== -1 && targetIndex !== -1) {
            let [movedLink] = state.links.splice(draggedIndex, 1);
            state.links.splice(targetIndex, 0, movedLink);
            saveData();
        }
    }
    draggedLinkId = null;
}

// 导入与导出JSON功能
function exportJson() {
    let exportData = Object.assign({}, state, { sideState: sideState });
    let dataStr = JSON.stringify(exportData, null, 2);
    let blob = new Blob([dataStr], {type: "application/json"});
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = 'link.json'; // 导出的名字
    a.click();
    URL.revokeObjectURL(url);
}
function importJson(event) {
    let file = event.target.files[0];
    if(!file) return;
    let reader = new FileReader();
    reader.onload = e => {
        try {
            let data = JSON.parse(e.target.result);
            if(data.columns && data.links) {
                if (data.sideState) {
                    sideState = data.sideState;
                    saveSideData();
                    delete data.sideState;
                    ['todo', 'prompts', 'poem', 'dice', 'ai'].forEach(renderFeatureList);
                    currentAiChat = { id: null, messages: [] };
                    if (typeof renderAiChat === 'function') renderAiChat();
                }
                state = data;
                ensurePoemStyle();
                ensurePageVisibility();
                if(!state.aiConfig) state.aiConfig = { baseUrl: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo', apiKey: '' };
                saveData();
                alert('JSON 导入加载成功！');
            } else {
                alert('JSON 格式不匹配，缺少 columns 或 links 字段，导入失败。');
            }
        } catch(err) {
            alert('解析 JSON 文件出错！');
        }
        event.target.value = ''; // 重置文件输入
    };
    reader.readAsText(file);
}

// ============== AI Chat 功能 ==============
function initAiInput() {
    let aiInput = document.getElementById('ai-input');
    if (!aiInput) return;
    aiInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendAiMessage();
        }
    });
}

function processAiCommand(text) {
    let cmd = text.trim();
    if (cmd === '/new') {
        currentAiChat = { id: null, messages: [] };
        renderAiChat();
        return true;
    }
    if (cmd === '/save') {
        if (currentAiChat.messages.length === 0) {
            alert('当前对话为空，无法保存');
            return true;
        }
        if (!currentAiChat.id) {
            currentAiChat.id = 'ai_' + Date.now();
            let title = currentAiChat.messages.find(m => m.role === 'user')?.content || '新对话';
            title = title.substring(0, 15) + (title.length > 15 ? '...' : '');
            sideState.ai.unshift({ id: currentAiChat.id, text: title, messages: JSON.parse(JSON.stringify(currentAiChat.messages)) });
        } else {
            let existing = sideState.ai.find(c => c.id === currentAiChat.id);
            if (existing) {
                existing.messages = JSON.parse(JSON.stringify(currentAiChat.messages));
            }
        }
        saveSideData();
        renderFeatureList('ai');
        renderAiChat();
        return true;
    }
    if (cmd === '/delete') {
        if (currentAiChat.id) {
            deleteItem('ai', currentAiChat.id);
        }
        currentAiChat = { id: null, messages: [] };
        renderAiChat();
        return true;
    }
    return false;
}

function appendAiMessage(role, content) {
    currentAiChat.messages.push({ role, content });
    renderAiChat();
}

async function sendAiMessage() {
    let input = document.getElementById('ai-input');
    let text = input.value.trim();
    if (!text) return;
    
    input.value = '';
    
    if (processAiCommand(text)) {
        return;
    }

    appendAiMessage('user', text);
    
    if (!state.aiConfig || !state.aiConfig.apiKey) {
        appendAiMessage('system', '未配置 API Key，请点击 ⚙️ 进入设置进行配置。');
        return;
    }
    
    let loadingIndex = currentAiChat.messages.length;
    currentAiChat.messages.push({ role: 'ai', content: '...', loading: true });
    renderAiChat();

    let baseUrl = state.aiConfig.baseUrl || 'https://api.openai.com/v1';
    if (!baseUrl.endsWith('/')) baseUrl += '/';
    let url = baseUrl + 'chat/completions';
    
    let apiMessages = currentAiChat.messages
        .filter(m => m.role === 'user' || m.role === 'ai')
        .filter(m => !m.loading)
        .map(m => ({ role: m.role === 'ai' ? 'assistant' : m.role, content: m.content }));

    if (state.aiConfig.systemPrompt) {
        apiMessages.unshift({ role: 'system', content: state.aiConfig.systemPrompt });
    }

    try {
        let response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.aiConfig.apiKey}`
            },
            body: JSON.stringify({
                model: state.aiConfig.model || 'gpt-3.5-turbo',
                messages: apiMessages
            })
        });
        
        let result = await response.json();
        currentAiChat.messages[loadingIndex].loading = false;
        
        if (response.ok && result.choices && result.choices.length > 0) {
            currentAiChat.messages[loadingIndex].content = result.choices[0].message.content;
        } else {
            currentAiChat.messages[loadingIndex].content = `错误: ${result.error?.message || '未知错误'}`;
        }
    } catch (e) {
        currentAiChat.messages[loadingIndex].loading = false;
        currentAiChat.messages[loadingIndex].content = `请求失败: ${e.message}`;
    }
    renderAiChat();
}

function renderAiChat() {
    let chatContainer = document.getElementById('ai-chat-container');
    if (!chatContainer) return;
    
    let statusEl = document.getElementById('ai-chat-status');
    if (statusEl) {
        statusEl.textContent = currentAiChat.id ? '当前: 已保存' : '当前: 未保存';
    }

    if (currentAiChat.messages.length === 0) {
        chatContainer.innerHTML = `<div class="chat-message system">提示：输入 /new 开新对话，/save 保存，/delete 删除。</div>`;
        return;
    }
    
    let html = '';
    currentAiChat.messages.forEach(m => {
        let cls = m.role === 'user' ? 'user' : (m.role === 'system' ? 'system' : 'ai');
        let content = escapeHtml(m.content).replace(/\n/g, '<br>');
        html += `<div class="chat-message ${cls}">${content}</div>`;
    });
    chatContainer.innerHTML = html;
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function loadSavedAiChat(id) {
    let chat = sideState.ai.find(c => c.id === id);
    if (chat) {
        currentAiChat = {
            id: chat.id,
            messages: JSON.parse(JSON.stringify(chat.messages || []))
        };
        renderAiChat();
    }
}

// 覆写原版的 renderFeatureList 对 ai 特殊处理
let originalRenderFeatureList = renderFeatureList;
renderFeatureList = function(type) {
    if (type === 'ai') {
        let listEl = document.getElementById('ai-list');
        if (!listEl) return;
        let items = sideState[type];
        if (!items.length) {
            listEl.innerHTML = `<li class="item-empty">暂无保存的对话</li>`;
            return;
        }
        listEl.innerHTML = items.map(item => {
            return `<li class="item" draggable="true"
                ondragstart="startDragItem(event, '${type}', '${item.id}')"
                ondragover="dragOverItem(event)"
                ondragenter="dragEnterItem(event)"
                ondragleave="dragLeaveItem(event)"
                ondrop="dropItem(event, '${type}', '${item.id}')"
                ondragend="dragEndItem(event)">
                <span style="color:#8ea6c0">☰</span>
                <span class="item-text" style="cursor:pointer; color:#7ec1f1;" title="点击加载此对话" onclick="loadSavedAiChat('${item.id}')">${escapeHtml(item.text)}</span>
                <button class="item-btn delete" onclick="deleteItem('${type}', '${item.id}')">删除</button>
            </li>`;
        }).join('');
    } else {
        originalRenderFeatureList(type);
    }
}

// --- 骰子 3D 场景控制 ---
let diceBoxInstance = null;
let isDiceLoading = false;

async function handleDiceScene(isActive) {
    const container = document.getElementById('dice-container');
    const resultDiv = document.getElementById('dice-result');
    if (!container) return;

    if (!isActive) {
        if (diceBoxInstance) {
            try { diceBoxInstance.clear(); } catch (e) {}
        }
        if (resultDiv) resultDiv.style.display = 'none';
        return;
    }

    if (resultDiv) resultDiv.style.display = 'none';

    if (!diceBoxInstance && !isDiceLoading) {
        isDiceLoading = true;
        try {
            const { default: DiceBox } = await import('https://unpkg.com/@3d-dice/dice-box@1.1.4/dist/dice-box.es.min.js');
            diceBoxInstance = new DiceBox({
                container: "#dice-container",
                assetPath: new URL('public/assets/', document.baseURI).href, // 用绝对 URL，兼容 GitHub Pages 子路径部署
                theme: 'default',
                scale: 6,
                gravity: 2,
                friction: 0.8
            });
            diceBoxInstance.onRollComplete = (results) => {
                if (!resultDiv) return;
                if (results && results.length > 0) {
                    const total = results.reduce((sum, d) => sum + (d.value || 0), 0);
                    resultDiv.textContent = '总计: ' + total;
                    resultDiv.style.display = 'block';
                }
            };
            await diceBoxInstance.init();
        } catch (err) {
            console.error("DiceBox load error:", err);
            container.innerHTML = '<p style="color:#ff8a8a; text-align:center; padding: 20px; line-height:1.6;">无法加载 3D 骰子。<br>请用本地服务器打开（如 <code>npx http-server</code> 或 <code>python -m http.server</code>），<br>并确认 <code>public/assets/</code> 目录存在。</p>';
            isDiceLoading = false;
            return;
        }
        isDiceLoading = false;
    }

    if (diceBoxInstance) rollDice();
}

function rollDice() {
    if (!diceBoxInstance || isDiceLoading) return;
    const resultDiv = document.getElementById('dice-result');
    if (resultDiv) resultDiv.style.display = 'none';
    try { diceBoxInstance.clear(); } catch (e) {}
    const count = state.diceConfig?.count || 1;
    const type = state.diceConfig?.type || 'd6';
    diceBoxInstance.roll(`${count}${type}`);
}

// 页面启动
window.onload = async function() {
    await init();
    initRightPanel();
    initAiInput();
};
