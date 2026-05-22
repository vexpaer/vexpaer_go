// ===== 诗词系统 =====

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

function refreshPoemFont() {
    let urlInput = document.getElementById('poem-font-css-url');
    let familyInput = document.getElementById('poem-font-family');
    if (urlInput) {
        state.poemStyle.fontCssUrl = urlInput.value.trim();
    }
    if (familyInput) {
        state.poemStyle.fontFamily = familyInput.value.trim();
    }
    saveData(false);

    ensurePoemStyle();
    let oldLink = document.getElementById('poem-font-link');
    if (oldLink) oldLink.remove();
    applyPoemFontSource();
    applyPoemStyle();

    let statusEl = document.getElementById('poem-font-status');
    if (!statusEl) return;
    statusEl.style.display = 'inline';
    statusEl.style.color = '#8bc34a';
    statusEl.textContent = '✓ 字体已刷新';

    try {
        if (document.fonts && typeof document.fonts.ready === 'object') {
            let fontFamily = state.poemStyle.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
            document.fonts.ready.then(() => {
                try {
                    if (document.fonts.check('1em "' + fontFamily + '"')) {
                        statusEl.textContent = '✓ 字体已加载';
                        statusEl.style.color = '#8bc34a';
                    } else {
                        statusEl.textContent = '⚠ 字体可能未加载，检查链接是否可访问';
                        statusEl.style.color = '#ffa726';
                    }
                } catch(e) {
                    statusEl.textContent = '✓ 已刷新（字体检测不可用）';
                }
            }).catch(() => {
                statusEl.textContent = '✓ 已刷新';
            });
        }
    } catch(e) {}

    clearTimeout(window._fontStatusTimer);
    window._fontStatusTimer = setTimeout(() => {
        statusEl.style.display = 'none';
    }, 3000);
}