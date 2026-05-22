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