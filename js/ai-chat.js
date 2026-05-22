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

function updateAiConfig(field, value) {
    if (!state.aiConfig) state.aiConfig = { baseUrl: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo', apiKey: '' };
    state.aiConfig[field] = value.trim();
    saveData(false);
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