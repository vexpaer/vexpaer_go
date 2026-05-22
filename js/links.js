// ===== 链接 / 栏目管理 =====

function renderLinks() {
    const container = document.getElementById('links-container');
    container.innerHTML = '';

    state.columns.forEach(col => {
        let visibleLinks = state.links.filter(l => l.columnId === col.id && l.visible);
        if (visibleLinks.length === 0) return;

        let colDiv = document.createElement('div');
        colDiv.className = 'wrap_col';

        visibleLinks.forEach(link => {
            let a = document.createElement('a');
            a.className = 'button-custom';
            a.textContent = link.text;
            a.onclick = () => window.open(link.url, '_blank');

            a.style.setProperty('--btn-color', link.color);
            const rgb = hexToRgb(link.color);
            a.style.setProperty('--btn-bg', `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.25)`);
            a.style.setProperty('--btn-hover', `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.75)`);

            colDiv.appendChild(a);
        });

        container.appendChild(colDiv);
    });
}

// 栏目 CRUD
function updateCol(id, name) {
    let col = state.columns.find(c => c.id === id);
    if (col) { col.name = name; saveData(); }
}

function addCol() {
    state.columns.push({ id: 'col_' + Date.now(), name: '新栏目' });
    saveData();
}

function deleteCol(id) {
    if (confirm('警告：确定删除此栏目及内部包含的所有标签吗？')) {
        state.columns = state.columns.filter(c => c.id !== id);
        state.links = state.links.filter(l => l.columnId !== id);
        saveData();
    }
}

function moveColUp(id) {
    let idx = state.columns.findIndex(c => c.id === id);
    if (idx > 0) {
        let temp = state.columns[idx - 1];
        state.columns[idx - 1] = state.columns[idx];
        state.columns[idx] = temp;
        saveData();
    }
}

function moveColDown(id) {
    let idx = state.columns.findIndex(c => c.id === id);
    if (idx < state.columns.length - 1 && idx !== -1) {
        let temp = state.columns[idx + 1];
        state.columns[idx + 1] = state.columns[idx];
        state.columns[idx] = temp;
        saveData();
    }
}

// 标签 CRUD
function updateLink(id, field, value) {
    let link = state.links.find(l => l.id === id);
    if (link) { link[field] = value; saveData(); }
}

function addLink() {
    let targetColId = state.columns.length > 0 ? state.columns[0].id : '';
    state.links.push({
        id: 'l_' + Date.now(),
        text: '新标签',
        url: 'https://',
        color: '#ffffff',
        visible: true,
        columnId: targetColId
    });
    saveData();
}

function deleteLink(id) {
    state.links = state.links.filter(l => l.id !== id);
    saveData();
}

// 颜色批量操作
function addColor() {
    let newColorInfo = document.getElementById('new-color-input').value;
    if (!state.colors.includes(newColorInfo)) {
        state.colors.push(newColorInfo);
        saveData();
    }
}

function deleteColor(idx) {
    state.colors.splice(idx, 1);
    saveData();
}

function bulkChangeColor(columnId) {
    let selectElem = document.getElementById('bulk-color-' + columnId);
    let selectedColor = selectElem.value;
    if (selectedColor) {
        state.links.forEach(l => {
            if (l.columnId === columnId) {
                l.color = selectedColor;
            }
        });
        saveData();
    } else {
        alert("请先选择一个颜色");
    }
}

// 标签拖拽排序
let draggedLinkId = null;

function dragStartLink(event, id) {
    draggedLinkId = id;
    event.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
        event.target.style.opacity = '0.5';
    }, 0);
}

function dragOverLink(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
}

function dragEnterLink(event) {
    event.preventDefault();
    let tr = event.target.closest('tr');
    if (tr) tr.style.borderTop = '2px solid #fff';
}

function dragLeaveLink(event) {
    let tr = event.target.closest('tr');
    if (tr) tr.style.borderTop = '';
}

function dropLink(event, id) {
    event.preventDefault();
    let tr = event.target.closest('tr');
    if (tr) tr.style.borderTop = '';

    if (draggedLinkId && draggedLinkId !== id) {
        let draggedIndex = state.links.findIndex(l => l.id === draggedLinkId);
        let targetIndex = state.links.findIndex(l => l.id === id);

        if (draggedIndex !== -1 && targetIndex !== -1) {
            let [movedLink] = state.links.splice(draggedIndex, 1);
            state.links.splice(targetIndex, 0, movedLink);
            saveData();
        }
    }
    draggedLinkId = null;
}