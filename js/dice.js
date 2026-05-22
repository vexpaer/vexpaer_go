// ===== 骰子系统 =====

const DICE_FACES_UNI = ['', '\u2680', '\u2681', '\u2682', '\u2683', '\u2684', '\u2685'];

function buildDiceUI() {
    const container = document.getElementById('dice-container');
    if (!container) return;
    container.innerHTML = '';
    container.style.cssText = 'width:100%;height:100%;background:#1a1a2e;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;';

    const count = state.diceConfig?.count || 1;
    const type = state.diceConfig?.type || 'd6';
    const faces = parseInt(type.slice(1)) || 6;

    const wrap = document.createElement('div');
    wrap.id = 'dice-wrapper';
    wrap.style.cssText = 'display:flex;gap:14px;flex-wrap:wrap;justify-content:center;align-items:center;';

    for (let i = 0; i < count; i++) {
        const die = document.createElement('div');
        die.className = 'dice-die';
        die.style.cssText = `width:64px;height:64px;display:flex;align-items:center;justify-content:center;
background:linear-gradient(145deg,#3a3a5c,#2a2a44);border-radius:12px;
border:2px solid #5a5a8c;color:#eee;font-size:${faces === 6 ? 44 : 26}px;
font-weight:bold;box-shadow:0 4px 12px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.1);
transition:transform 0.08s;user-select:none;text-shadow:0 2px 4px rgba(0,0,0,0.5);`;
        die.textContent = faces === 6 ? DICE_FACES_UNI[1] : '?';
        wrap.appendChild(die);
    }
    container.appendChild(wrap);
}

function handleDiceScene(isActive) {
    const container = document.getElementById('dice-container');
    const resultDiv = document.getElementById('dice-result');
    if (!container) return;

    if (!isActive) {
        if (resultDiv) resultDiv.style.display = 'none';
        return;
    }

    if (resultDiv) resultDiv.style.display = 'none';
    buildDiceUI();
    rollDice();
}

function rollDice() {
    const container = document.getElementById('dice-container');
    const resultDiv = document.getElementById('dice-result');
    if (!container) return;

    let wrap = document.getElementById('dice-wrapper');
    if (!wrap) { buildDiceUI(); wrap = document.getElementById('dice-wrapper'); }
    if (!wrap) return;

    if (resultDiv) resultDiv.style.display = 'none';

    const count = state.diceConfig?.count || 1;
    const type = state.diceConfig?.type || 'd6';
    const faces = parseInt(type.slice(1)) || 6;
    const dice = wrap.querySelectorAll('.dice-die');
    const final = [];

    let tick = 0;
    const timer = setInterval(() => {
        for (let i = 0; i < dice.length && i < count; i++) {
            const v = Math.floor(Math.random() * faces) + 1;
            dice[i].textContent = faces === 6 ? DICE_FACES_UNI[v] : v;
            dice[i].style.transform = `rotate(${Math.random() * 360}deg) scale(${1 + Math.random() * 0.2})`;
        }
        tick++;
        if (tick >= 12) {
            clearInterval(timer);
            for (let i = 0; i < dice.length && i < count; i++) {
                const v = Math.floor(Math.random() * faces) + 1;
                final.push(v);
                dice[i].textContent = faces === 6 ? DICE_FACES_UNI[v] : v;
                dice[i].style.transform = 'rotate(0deg) scale(1)';
                dice[i].style.borderColor = '#8aff8a';
                dice[i].style.boxShadow = '0 0 20px rgba(100,255,100,0.4), 0 4px 12px rgba(0,0,0,0.5)';
            }
            if (resultDiv && final.length) {
                resultDiv.textContent = '总计: ' + final.reduce((a, b) => a + b, 0);
                resultDiv.style.display = 'block';
            }
        }
    }, 75);
}

function updateDiceConfig(field, value) {
    if (!state.diceConfig) state.diceConfig = { count: 1, type: 'd6' };
    if (field === 'count') {
        let count = parseInt(value, 10);
        if (isNaN(count) || count < 1) count = 1;
        state.diceConfig.count = count;
    } else {
        state.diceConfig.type = value;
    }
    saveData(false);
}