// ===== 初始化 & 导入导出 =====

function migrateAiConfig() {
    if (!state.aiConfig) {
        state.aiConfig = { baseUrl: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo', apiKey: '', systemPrompt: '', modelPresets: [], activePresetLabel: '' };
    }
    if (!state.aiConfig.modelPresets) {
        let existingModel = state.aiConfig.model || 'gpt-3.5-turbo';
        let labelMap = { 'gpt-3.5-turbo': 'GPT-3.5 Turbo', 'gpt-4': 'GPT-4', 'gpt-4o': 'GPT-4o', 'deepseek-chat': 'DeepSeek Chat', 'deepseek-coder': 'DeepSeek Coder' };
        let existingLabel = labelMap[existingModel] || existingModel;
        state.aiConfig.modelPresets = [
            { label: existingLabel, model: existingModel, baseUrl: state.aiConfig.baseUrl || 'https://api.openai.com/v1', apiKey: state.aiConfig.apiKey || '' },
            { label: 'GPT-4o', model: 'gpt-4o', baseUrl: 'https://api.openai.com/v1', apiKey: '' },
            { label: 'DeepSeek Chat', model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com', apiKey: '' }
        ];
        state.aiConfig.activePresetLabel = existingLabel;
    }
    // 兼容旧预设：缺少 baseUrl/apiKey 则补上
    state.aiConfig.modelPresets.forEach(p => {
        if (!p.baseUrl) p.baseUrl = state.aiConfig.baseUrl || 'https://api.openai.com/v1';
        if (!p.apiKey) p.apiKey = state.aiConfig.apiKey || '';
    });
}

async function init() {
    let saved = localStorage.getItem('e-desktop-data');
    if (saved) {
        try {
            state = JSON.parse(saved);
            if (!state.colors) state.colors = ["#0000ff", "#800080", "#ff0000", "#000000", "#ffffff"];
            if (!state.aiConfig) state.aiConfig = { baseUrl: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo', apiKey: '' };
            migrateAiConfig();
            if (!state.diceConfig) state.diceConfig = { formula: '3D6' };
            ensurePageVisibility();
            ensureTheme();
            if (typeof state.panelWidth !== 'number' || Number.isNaN(state.panelWidth)) state.panelWidth = 900;
        } catch (e) {
            state = JSON.parse(JSON.stringify(window.DEFAULT_DATA));
        }
        applyTheme();
        applyPoemStyle();
        applyFeatureStyles();
        renderLinks();
    } else {
        try {
            let res = await fetch('link.json');
            if (res.ok) {
                state = await res.json();
                if (!state.colors) state.colors = ["#0000ff", "#800080", "#ff0000", "#000000", "#ffffff"];
                migrateAiConfig();
                ensurePageVisibility();
                ensureTheme();
                if (typeof state.panelWidth !== 'number' || Number.isNaN(state.panelWidth)) state.panelWidth = 900;
                saveData(false);
            } else {
                throw new Error();
            }
        } catch (e) {
            state = JSON.parse(JSON.stringify(window.DEFAULT_DATA));
            saveData(false);
        }
        applyTheme();
        applyPoemStyle();
        applyFeatureStyles();
        renderLinks();
    }
}

function initRightPanel() {
    loadSideData();
    updateTime();
    setInterval(updateTime, 1000);
    applyPoemStyle();
    applyFeatureStyles();
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
    applyChatBubbleWidth();
    initRightPanelResize();
}

function getExportData() {
    let exportData = Object.assign({}, state, { sideState: sideState });
    return JSON.stringify(exportData, null, 2);
}

function exportJson() {
    let dataStr = getExportData();
    let blob = new Blob([dataStr], { type: "application/json" });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = 'link.json';
    a.click();
    URL.revokeObjectURL(url);
}

function applyImportedJsonText(jsonText, successMessage) {
    try {
        let data = JSON.parse(jsonText);
        if (data.columns && data.links) {
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
            ensureFeatureStyle();
            ensurePageVisibility();
            ensureTheme();
            if (!state.aiConfig) state.aiConfig = { baseUrl: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo', apiKey: '' };
            migrateAiConfig();
            saveData();
            applyTheme();
            applyFeatureStyles();
            applyPageVisibility();
            applyChatBubbleWidth();
            alert(successMessage);
            return true;
        }
        alert('JSON 格式不匹配，缺少 columns 或 links 字段，导入失败。');
    } catch (err) {
        alert('解析 JSON 出错！');
    }
    return false;
}

function importJson(event) {
    let file = event.target.files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = e => {
        applyImportedJsonText(e.target.result, 'JSON 导入加载成功！');
        event.target.value = '';
    };
    reader.readAsText(file);
}

function fallbackCopyText(text) {
    let textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        let copied = document.execCommand('copy');
        document.body.removeChild(textarea);
        return copied;
    } catch (err) {
        document.body.removeChild(textarea);
        return false;
    }
}

async function copyJson() {
    let dataStr = getExportData();
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(dataStr);
        } else if (!fallbackCopyText(dataStr)) {
            throw new Error('Clipboard write is unavailable');
        }
        alert('JSON 已复制到剪贴板！');
    } catch (err) {
        if (fallbackCopyText(dataStr)) {
            alert('JSON 已复制到剪贴板！');
        } else {
            alert('复制 JSON 失败，浏览器未允许访问剪贴板。');
        }
    }
}

async function pasteJson() {
    let jsonText = '';
    try {
        if (!navigator.clipboard || !navigator.clipboard.readText) {
            throw new Error('Clipboard read is unavailable');
        }
        jsonText = await navigator.clipboard.readText();
    } catch (err) {
        jsonText = prompt('浏览器未允许直接读取剪贴板，请在这里粘贴 JSON：') || '';
    }
    if (!jsonText.trim()) {
        alert('剪贴板中没有可导入的 JSON。');
        return;
    }
    applyImportedJsonText(jsonText, '剪贴板 JSON 粘贴导入成功！');
}

window.onload = async function() {
    await init();
    initRightPanel();
    initAiInput();
};
