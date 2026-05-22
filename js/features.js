// ===== 侧边功能 (待办/提示词/诗词记录) =====

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

function updateTime() {
    let now = new Date();
    let date = now.toLocaleDateString('zh-CN', { weekday: 'long', month: '2-digit', day: '2-digit' });
    let time = now.toLocaleTimeString('zh-CN', { hour12: false });
    document.getElementById('info-time').textContent = `${date} ${time}`;
}

function bindFeatureInputEnter(inputId, type) {
    let input = document.getElementById(inputId);
    input.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') addItem(type);
    });
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

function applyFeatureStyles() {
    ensureFeatureStyle();
    let oldStyle = document.getElementById('feature-font-style');
    if (oldStyle) oldStyle.remove();

    let css = '';
    let types = ['todo', 'prompts', 'poem', 'ai'];
    types.forEach(type => {
        let fs = state.featureStyle[type]?.fontSize || 15;
        let listId = type + '-list';
        css += `#${listId} .item-text { font-size: ${fs}px; }\n`;
        css += `#${listId} .item-btn { font-size: ${fs}px; }\n`;
        if (type === 'ai') {
            css += `.chat-message { font-size: ${fs}px; }\n`;
            css += `#ai-list .item-text { font-size: ${fs}px; }\n`;
            css += `#ai-list .item-btn { font-size: ${fs}px; }\n`;
        }
    });

    let style = document.createElement('style');
    style.id = 'feature-font-style';
    style.textContent = css;
    document.head.appendChild(style);
}

function updateFeatureStyle(type, value) {
    ensureFeatureStyle();
    let fs = Math.max(10, Math.min(36, Number(value) || 15));
    if (!state.featureStyle[type]) state.featureStyle[type] = { fontSize: 15 };
    state.featureStyle[type].fontSize = fs;
    let range = document.getElementById('fs-range-' + type);
    let input = document.getElementById('fs-input-' + type);
    if (range) range.value = fs;
    if (input) input.value = fs;
    applyFeatureStyles();
    saveData(false);
}

// 基础 renderFeatureList
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