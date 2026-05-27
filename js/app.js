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
            if (!state.diceConfig) state.diceConfig = { count: 1, type: 'd6' };
            ensurePageVisibility();
            if (typeof state.panelWidth !== 'number' || Number.isNaN(state.panelWidth)) state.panelWidth = 800;
        } catch (e) {
            state = JSON.parse(JSON.stringify(window.DEFAULT_DATA));
        }
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
                if (typeof state.panelWidth !== 'number' || Number.isNaN(state.panelWidth)) state.panelWidth = 800;
                saveData(false);
            } else {
                throw new Error();
            }
        } catch (e) {
            state = JSON.parse(JSON.stringify(window.DEFAULT_DATA));
            saveData(false);
        }
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
    initRightPanelResize();
}

function exportJson() {
    let exportData = Object.assign({}, state, { sideState: sideState });
    let dataStr = JSON.stringify(exportData, null, 2);
    let blob = new Blob([dataStr], { type: "application/json" });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = 'link.json';
    a.click();
    URL.revokeObjectURL(url);
}

function importJson(event) {
    let file = event.target.files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = e => {
        try {
            let data = JSON.parse(e.target.result);
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
                ensurePageVisibility();
                if (!state.aiConfig) state.aiConfig = { baseUrl: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo', apiKey: '' };
                migrateAiConfig();
                saveData();
                alert('JSON 导入加载成功！');
            } else {
                alert('JSON 格式不匹配，缺少 columns 或 links 字段，导入失败。');
            }
        } catch (err) {
            alert('解析 JSON 文件出错！');
        }
        event.target.value = '';
    };
    reader.readAsText(file);
}

window.onload = async function() {
    await init();
    initRightPanel();
    initAiInput();
};