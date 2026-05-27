// ===== AI 对话 =====

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

    let msgIndex = currentAiChat.messages.length;
    currentAiChat.messages.push({ role: 'ai', content: '', loading: true });
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
                model: getActiveModel(),
                messages: apiMessages,
                stream: true
            })
        });

        if (!response.ok) {
            let errData = {};
            try { errData = await response.json(); } catch (_) {}
            currentAiChat.messages[msgIndex].loading = false;
            currentAiChat.messages[msgIndex].content = `错误: ${errData.error?.message || `HTTP ${response.status}`}`;
            renderAiChat();
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            let lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (let line of lines) {
                let trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;
                let data = trimmed.slice(6);
                if (data === '[DONE]') continue;
                try {
                    let parsed = JSON.parse(data);
                    let delta = parsed.choices?.[0]?.delta?.content || '';
                    if (delta) {
                        currentAiChat.messages[msgIndex].content += delta;
                        renderAiChat();
                    }
                } catch (_) {}
            }
        }

        // process remaining buffer
        if (buffer.trim()) {
            let line = buffer.trim();
            if (line.startsWith('data: ')) {
                let data = line.slice(6);
                if (data !== '[DONE]') {
                    try {
                        let parsed = JSON.parse(data);
                        let delta = parsed.choices?.[0]?.delta?.content || '';
                        if (delta) currentAiChat.messages[msgIndex].content += delta;
                    } catch (_) {}
                }
            }
        }

        currentAiChat.messages[msgIndex].loading = false;
        if (!currentAiChat.messages[msgIndex].content) {
            currentAiChat.messages[msgIndex].content = '(空回复)';
        }
        renderAiChat();

    } catch (e) {
        currentAiChat.messages[msgIndex].loading = false;
        currentAiChat.messages[msgIndex].content = `请求失败: ${e.message}`;
        renderAiChat();
    }
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
    currentAiChat.messages.forEach((m, idx) => {
        let cls = m.role === 'user' ? 'user' : (m.role === 'system' ? 'system' : 'ai');
        let display = m.content;
        if (m.loading) {
            display = display || '...';
        }
        let content = escapeHtml(display).replace(/\n/g, '<br>');
        html += `<div class="chat-message ${cls}">${content}`;
        if (m.role === 'ai' && !m.loading && m.content) {
            html += `<button class="copy-btn" onclick="copyAiMessage(${idx})" title="复制回答">📋</button>`;
        }
        html += `</div>`;
    });
    chatContainer.innerHTML = html;
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function copyAiMessage(index) {
    let msg = currentAiChat.messages[index];
    if (!msg || !msg.content) return;
    let text = msg.content;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    let ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
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

function updateAiConfig(field, value) {
    if (!state.aiConfig) state.aiConfig = { baseUrl: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo', apiKey: '' };
    state.aiConfig[field] = value.trim();
    saveData(false);
}

function getActiveModel() {
    let config = state.aiConfig;
    if (!config) return 'gpt-3.5-turbo';
    if (config.modelPresets && config.activePresetLabel) {
        let preset = config.modelPresets.find(p => p.label === config.activePresetLabel);
        if (preset) return preset.model;
    }
    return config.model || 'gpt-3.5-turbo';
}

function selectAiPreset(index) {
    if (!state.aiConfig.modelPresets || !state.aiConfig.modelPresets[index]) return;
    let preset = state.aiConfig.modelPresets[index];
    state.aiConfig.activePresetLabel = preset.label;
    state.aiConfig.model = preset.model;
    if (preset.baseUrl) state.aiConfig.baseUrl = preset.baseUrl;
    if (preset.apiKey !== undefined) state.aiConfig.apiKey = preset.apiKey;
    saveData(false);
    if (document.getElementById('settings-modal').style.display === 'flex') {
        renderEditor();
    }
}

function addAiPreset() {
    let labelInput = document.getElementById('new-preset-label');
    let modelInput = document.getElementById('new-preset-model');
    let urlInput = document.getElementById('new-preset-url');
    let keyInput = document.getElementById('new-preset-key');
    let label = labelInput.value.trim();
    let model = modelInput.value.trim();
    let baseUrl = urlInput.value.trim();
    let apiKey = keyInput.value.trim();
    if (!label || !model || !baseUrl) {
        alert('请至少填写配置名称、模型 ID 和 Base URL');
        return;
    }
    if (!state.aiConfig.modelPresets) state.aiConfig.modelPresets = [];
    if (state.aiConfig.modelPresets.some(p => p.label === label)) {
        alert('配置名称已存在');
        return;
    }
    let preset = { label, model, baseUrl, apiKey };
    state.aiConfig.modelPresets.push(preset);
    state.aiConfig.activePresetLabel = label;
    state.aiConfig.model = model;
    state.aiConfig.baseUrl = baseUrl;
    state.aiConfig.apiKey = apiKey;
    labelInput.value = '';
    modelInput.value = '';
    urlInput.value = '';
    keyInput.value = '';
    saveData(false);
    renderEditor();
}

function deleteAiPreset(index) {
    if (!state.aiConfig.modelPresets || !state.aiConfig.modelPresets[index]) return;
    let preset = state.aiConfig.modelPresets[index];
    if (state.aiConfig.modelPresets.length <= 1) {
        alert('至少保留一个模型配置');
        return;
    }
    state.aiConfig.modelPresets.splice(index, 1);
    if (state.aiConfig.activePresetLabel === preset.label) {
        let first = state.aiConfig.modelPresets[0];
        state.aiConfig.activePresetLabel = first.label;
        state.aiConfig.model = first.model;
        if (first.baseUrl) state.aiConfig.baseUrl = first.baseUrl;
        if (first.apiKey !== undefined) state.aiConfig.apiKey = first.apiKey;
    }
    saveData(false);
    renderEditor();
}

// AI 专用列表渲染（覆盖基础 renderFeatureList 的 ai 分支）
(function() {
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
    };
})();