// ===== 右侧面板拖拽缩放 =====

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

function initRightPanelResize() {
    let panel = document.querySelector('.right-panel');
    if (!panel) return;

    if (typeof state.panelWidth !== 'number' || Number.isNaN(state.panelWidth)) {
        state.panelWidth = 900;
    }
    state.panelWidth = Math.max(280, state.panelWidth);
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

function applyChatBubbleWidth() {
    let w = Math.max(50, Math.min(100, Number(state.chatBubbleWidth) || 85));
    let container = document.querySelector('.chat-container');
    if (container) {
        container.style.setProperty('--chat-bubble-width', w + '%');
    }
}

function updateChatBubbleWidth(value) {
    let w = Math.max(50, Math.min(100, Number(value) || 85));
    state.chatBubbleWidth = w;
    applyChatBubbleWidth();
    let range = document.getElementById('chat-bubble-width-range');
    let input = document.getElementById('chat-bubble-width-input');
    if (range) range.value = w;
    if (input) input.value = w;
    saveData(false);
}