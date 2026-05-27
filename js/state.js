// ===== State & Utilities =====

// 内置默认数据
window.DEFAULT_DATA = JSON.parse(JSON.stringify({
    columns: [],
    links: [],
    colors: ["#0000ff", "#800080", "#ff0000", "#000000", "#ffffff"],
    panelWidth: 800,
    theme: 'default',
    poemStyle: {
        color: '#e8e1c8',
        fontSize: 21,
        fontCssUrl: 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&display=swap',
        fontFamily: "'Noto Serif SC', 'STSong', 'SimSun', serif"
    },
    pageVisibility: { todo: true, prompts: true, poem: true, dice: true, ai: true },
    aiConfig: {
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-3.5-turbo',
        apiKey: '',
        systemPrompt: '',
        modelPresets: [
            { label: 'OpenAI', model: 'gpt-4o', baseUrl: 'https://api.openai.com/v1', apiKey: '' },
            { label: 'DeepSeek', model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com', apiKey: '' },
            { label: 'GPT-3.5 Turbo', model: 'gpt-3.5-turbo', baseUrl: 'https://api.openai.com/v1', apiKey: '' }
        ],
        activePresetLabel: 'OpenAI'
    },
    diceConfig: { formula: '3D6' },
    featureStyle: {
        todo: { fontSize: 15 },
        prompts: { fontSize: 15 },
        poem: { fontSize: 15 },
        ai: { fontSize: 15 }
    }
}));

// 全局状态
let state = {
    columns: [],
    links: [],
    colors: ["#0000ff", "#800080", "#ff0000", "#000000", "#ffffff"],
    panelWidth: 800,
    theme: 'default',
    poemStyle: {
        color: '#e8e1c8',
        fontSize: 21,
        fontCssUrl: 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&display=swap',
        fontFamily: "'Noto Serif SC', 'STSong', 'SimSun', serif"
    },
    pageVisibility: { todo: true, prompts: true, poem: true, dice: true, ai: true },
    aiConfig: {
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-3.5-turbo',
        apiKey: '',
        systemPrompt: '',
        modelPresets: [
            { label: 'OpenAI', model: 'gpt-4o', baseUrl: 'https://api.openai.com/v1', apiKey: '' },
            { label: 'DeepSeek', model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com', apiKey: '' },
            { label: 'GPT-3.5 Turbo', model: 'gpt-3.5-turbo', baseUrl: 'https://api.openai.com/v1', apiKey: '' }
        ],
        activePresetLabel: 'OpenAI'
    },
    diceConfig: { formula: '3D6' },
    featureStyle: {
        todo: { fontSize: 15 },
        prompts: { fontSize: 15 },
        poem: { fontSize: 15 },
        ai: { fontSize: 15 }
    }
};
let sideState = { todo: [], prompts: [], poem: [], dice: [], ai: [] };
let currentAiChat = { id: null, messages: [] };
let draggedItem = { type: null, id: null };
let activeFeature = null;
let isResizingPanel = false;
let resizeStartX = 0;
let resizeStartWidth = 800;

// 工具函数
function hexToRgb(hex) {
    let m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [255, 255, 255];
}

function hexToBrightness(hex) {
    let rgb = hexToRgb(hex);
    return Math.round(((parseInt(rgb[0]) * 299) +
              (parseInt(rgb[1]) * 587) +
              (parseInt(rgb[2]) * 114)) / 1000);
}

function escapeHtml(str) {
    return str.replace(/[&<>"]/g, function(c) {
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
}

// 状态保证函数
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
            fontCssUrl: 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&display=swap',
            fontFamily: "'Noto Serif SC', 'STSong', 'SimSun', serif"
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
    if (typeof state.poemStyle.fontCssUrl !== 'string') state.poemStyle.fontCssUrl = 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&display=swap';
    if (typeof state.poemStyle.fontFamily !== 'string') state.poemStyle.fontFamily = "'Noto Serif SC', 'STSong', 'SimSun', serif";
    state.poemStyle.fontCssUrl = state.poemStyle.fontCssUrl.trim();
    state.poemStyle.fontFamily = state.poemStyle.fontFamily.trim();
    if (!state.poemStyle.fontFamily) {
        state.poemStyle.fontFamily = "'Noto Serif SC', 'STSong', 'SimSun', serif";
    }
}

function ensureFeatureStyle() {
    const defaults = {
        todo: { fontSize: 15 },
        prompts: { fontSize: 15 },
        poem: { fontSize: 15 },
        ai: { fontSize: 15 }
    };
    if (!state.featureStyle || typeof state.featureStyle !== 'object') {
        state.featureStyle = JSON.parse(JSON.stringify(defaults));
        return;
    }
    for (let key of Object.keys(defaults)) {
        let obj = state.featureStyle[key];
        if (!obj || typeof obj !== 'object') {
            state.featureStyle[key] = { fontSize: defaults[key].fontSize };
            continue;
        }
        let fs = Number(obj.fontSize);
        if (Number.isNaN(fs)) {
            state.featureStyle[key].fontSize = defaults[key].fontSize;
        } else {
            state.featureStyle[key].fontSize = Math.max(10, Math.min(36, fs));
        }
    }
}

function ensureTheme() {
    if (!state.theme || !['default', 'ios26'].includes(state.theme)) {
        state.theme = 'default';
    }
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

// 持久化
function saveData(render = true) {
    ensurePoemStyle();
    sortLinksByColumn();
    localStorage.setItem('e-desktop-data', JSON.stringify(state));
    if (render) {
        renderLinks();
        applyPoemStyle();
        if (document.getElementById('settings-modal').style.display === 'flex') {
            renderEditor();
        }
    }
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