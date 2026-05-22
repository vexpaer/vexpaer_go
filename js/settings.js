// ===== 设置弹窗 & 编辑器 =====

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

    // 颜色编辑器
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

    // 页面可见性编辑器
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

    // AI 配置编辑器
    if (!state.aiConfig) state.aiConfig = { baseUrl: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo', apiKey: '', systemPrompt: '' };
    if (state.aiConfig.systemPrompt === undefined) state.aiConfig.systemPrompt = '';
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

    // 骰子配置编辑器
    if (!state.diceConfig) state.diceConfig = { count: 1, type: 'd6' };
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

    // 面板宽度编辑器
    let panelWidthHtml = `<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;background:#2a2a2a;padding:12px 14px;border-radius:10px;">
        <label style="display:flex;align-items:center;gap:8px;">面板宽度
            <input type="range" id="panel-width-range" min="280" max="800" step="10" value="${state.panelWidth}" oninput="updatePanelWidth(this.value)" style="width:160px;">
            <input type="number" id="panel-width-input" min="280" max="800" step="10" value="${state.panelWidth}" onchange="updatePanelWidth(this.value)" style="width:80px;">
            <span>px</span>
        </label>
        <span style="color:#888;font-size:0.85em;">范围 280 ~ 800，也可直接拖拽面板左边缘</span>
    </div>`;
    document.getElementById('panel-width-editor').innerHTML = panelWidthHtml;

    // 诗词样式编辑器
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
        <button onclick="refreshPoemFont()" style="background:#555;color:#fff;border:1px solid #888;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:13px;">🔄 刷新字体</button>
        <span id="poem-font-status" style="font-size:12px;color:#999;display:none;"></span>
    </div>`;
    document.getElementById('poem-style-editor').innerHTML = poemStyleHtml;

    // 内容字体大小编辑器
    ensureFeatureStyle();
    let fsLabels = { todo: '待办', prompts: '提示词', poem: '诗词', ai: 'AI' };
    let featureStyleHtml = `<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;background:#2a2a2a;padding:12px 14px;border-radius:10px;">`;
    for (let [type, label] of Object.entries(fsLabels)) {
        let fs = state.featureStyle[type]?.fontSize || 15;
        featureStyleHtml += `<label style="display:flex;align-items:center;gap:8px;min-width:140px;">
            <span style="min-width:40px;">${label}</span>
            <input type="range" id="fs-range-${type}" min="10" max="36" step="1" value="${fs}" oninput="updateFeatureStyle('${type}', this.value)" style="width:100px;">
            <input type="number" id="fs-input-${type}" min="10" max="36" step="1" value="${fs}" onchange="updateFeatureStyle('${type}', this.value)" style="width:64px;">
            <span>px</span>
        </label>`;
    }
    featureStyleHtml += `</div>`;
    document.getElementById('feature-style-editor').innerHTML = featureStyleHtml;

    // 栏目编辑器
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

    // 标签编辑器
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

        if (!state.colors.includes(l.color)) {
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