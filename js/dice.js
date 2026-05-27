// ===== 3D 物理骰子系统 (支持多面数公式) =====

// 全局变量
let diceScene, diceCamera, diceRenderer, diceWorld;
let diceObjects = [];
let diceBodies = [];
let diceFaceNormals = []; // 每个骰子的面法线
let diceFaceCounts = [];  // 每个骰子的面数
let isDiceRolling = false;
let diceAnimFrameId = null;
let diceDepsLoaded = false;
let diceDepsLoading = false;

// 骰子颜色方案
const DICE_COLORS = {
    4:  { bg: '#e74c3c', text: '#fff', hex: 0xe74c3c },
    6:  { bg: '#ecf0f1', text: '#333', hex: 0xecf0f1 },
    8:  { bg: '#2ecc71', text: '#fff', hex: 0x2ecc71 },
    10: { bg: '#3498db', text: '#fff', hex: 0x3498db },
    12: { bg: '#9b59b6', text: '#fff', hex: 0x9b59b6 },
    20: { bg: '#f39c12', text: '#fff', hex: 0xf39c12 }
};

// D6 点数位置
const DICE_DOT_POSITIONS = {
    1: [[0, 0]],
    2: [[-0.25, 0.25], [0.25, -0.25]],
    3: [[-0.25, 0.25], [0, 0], [0.25, -0.25]],
    4: [[-0.25, 0.25], [0.25, 0.25], [-0.25, -0.25], [0.25, -0.25]],
    5: [[-0.25, 0.25], [0.25, 0.25], [0, 0], [-0.25, -0.25], [0.25, -0.25]],
    6: [[-0.25, 0.25], [0.25, 0.25], [-0.25, 0], [0.25, 0], [-0.25, -0.25], [0.25, -0.25]]
};

// ===== 依赖加载 =====

function loadDiceDependencies(callback) {
    if (diceDepsLoaded) { callback(); return; }
    if (diceDepsLoading) return;
    diceDepsLoading = true;

    const container = document.getElementById('dice-container');
    if (container) {
        container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#aaa;font-size:14px;">加载 3D 引擎中...</div>';
    }

    function loadScript(src, onload, onerror) {
        const s = document.createElement('script');
        s.src = src;
        s.onload = onload;
        s.onerror = onerror;
        document.head.appendChild(s);
    }

    loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
        function() {
            loadScript('https://cdnjs.cloudflare.com/ajax/libs/cannon.js/0.6.2/cannon.min.js',
                function() {
                    diceDepsLoaded = true;
                    diceDepsLoading = false;
                    callback();
                },
                function() { diceDepsLoading = false; showDiceFallback('Cannon.js 加载失败'); }
            );
        },
        function() { diceDepsLoading = false; showDiceFallback('Three.js 加载失败'); }
    );
}

function showDiceFallback(msg) {
    const container = document.getElementById('dice-container');
    if (container) {
        container.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#888;font-size:14px;gap:8px;"><span>'
            + msg + '</span><span style="font-size:12px;">请检查网络连接或刷新页面</span></div>';
    }
}

// ===== 公式解析 =====
// 解析 "3D6+2D8" -> [{count:3, faces:6}, {count:2, faces:8}]

function parseDiceFormula(formula) {
    if (!formula || typeof formula !== 'string') return [{ count: 3, faces: 6 }];
    const parts = formula.toUpperCase().replace(/\s/g, '').split('+');
    const result = [];
    for (const part of parts) {
        const match = part.match(/^(\d*)D(\d+)$/);
        if (match) {
            const count = Math.max(1, Math.min(20, parseInt(match[1]) || 1));
            const faces = parseInt(match[2]);
            if ([4, 6, 8, 10, 12, 20].includes(faces)) {
                result.push({ count, faces });
            }
        }
    }
    return result.length > 0 ? result : [{ count: 3, faces: 6 }];
}

function getTotalDiceCount(parsed) {
    return parsed.reduce((sum, g) => sum + g.count, 0);
}

// ===== 纹理创建 =====

function createNumberTexture(number, bgColor, textColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 128, 128);

    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 124, 124);

    ctx.fillStyle = textColor;
    ctx.font = 'bold 52px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(number), 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

function createD6DotTexture(number) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, 128, 128);

    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 124, 124);

    ctx.fillStyle = '#333';
    const dots = DICE_DOT_POSITIONS[number] || [];
    dots.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(64 + x * 100, 64 + y * 100, 12, 0, Math.PI * 2);
        ctx.fill();
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

// ===== 几何体 & 材质 =====

function getDiceGeometry(faces) {
    switch (faces) {
        case 4:  return new THREE.TetrahedronGeometry(0.6, 0);
        case 6:  return new THREE.BoxGeometry(1, 1, 1);
        case 8:  return new THREE.OctahedronGeometry(0.6, 0);
        case 10: return new THREE.BoxGeometry(1, 1, 1); // D10 近似为立方体
        case 12: return new THREE.DodecahedronGeometry(0.6, 0);
        case 20: return new THREE.IcosahedronGeometry(0.65, 0);
        default: return new THREE.BoxGeometry(1, 1, 1);
    }
}

// 获取每个骰子面包含的三角形数量
function getTrianglesPerFace(faces) {
    switch (faces) {
        case 4:  return 1;
        case 6:  return 2;
        case 8:  return 1;
        case 10: return 2;
        case 12: return 3;
        case 20: return 1;
        default: return 2;
    }
}

function createDiceMaterials(faces) {
    const color = DICE_COLORS[faces] || DICE_COLORS[6];
    const materials = [];

    if (faces === 6) {
        // D6 使用点数纹理
        for (let i = 1; i <= 6; i++) {
            materials.push(new THREE.MeshStandardMaterial({
                map: createD6DotTexture(i),
                roughness: 0.4,
                metalness: 0.1
            }));
        }
    } else {
        // 其他骰子使用数字纹理
        for (let i = 1; i <= faces; i++) {
            materials.push(new THREE.MeshStandardMaterial({
                map: createNumberTexture(i, color.bg, color.text),
                roughness: 0.4,
                metalness: 0.1
            }));
        }
    }
    return materials;
}

// 为几何体添加分组，使每个面可以使用不同材质
function addFaceGroups(geometry, numFaces, trianglesPerFace) {
    geometry.clearGroups();
    const vertsPerFace = trianglesPerFace * 3;
    for (let i = 0; i < numFaces; i++) {
        geometry.addGroup(i * vertsPerFace, vertsPerFace, i);
    }
}

// ===== 面法线计算 =====

function computeFaceNormals(geometry, numFaces, trianglesPerFace) {
    const pos = geometry.getAttribute('position');
    const normals = [];
    const vertsPerFace = trianglesPerFace * 3;

    for (let i = 0; i < numFaces; i++) {
        const base = i * vertsPerFace;
        const v0 = new THREE.Vector3().fromBufferAttribute(pos, base);
        const v1 = new THREE.Vector3().fromBufferAttribute(pos, base + 1);
        const v2 = new THREE.Vector3().fromBufferAttribute(pos, base + 2);

        const e1 = new THREE.Vector3().subVectors(v1, v0);
        const e2 = new THREE.Vector3().subVectors(v2, v0);
        const normal = new THREE.Vector3().crossVectors(e1, e2).normalize();
        normals.push(normal);
    }
    return normals;
}

// ===== 创建骰子 =====

function createDiceMesh(faces) {
    const geometry = getDiceGeometry(faces);
    const trianglesPerFace = getTrianglesPerFace(faces);

    // 非 BoxGeometry 需要手动添加分组
    if (faces !== 6 && faces !== 10) {
        addFaceGroups(geometry, faces, trianglesPerFace);
    }

    const materials = createDiceMaterials(faces);
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // 存储面信息
    mesh.userData.faces = faces;
    mesh.userData.faceNormals = computeFaceNormals(geometry, faces, trianglesPerFace);

    return mesh;
}

function createDiceBody() {
    const shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
    const body = new CANNON.Body({ mass: 1, shape: shape });
    body.material = new CANNON.Material('dice');
    body.material.friction = 0.3;
    body.material.restitution = 0.3;
    return body;
}

// ===== 场景初始化 =====

function initDiceScene() {
    const container = document.getElementById('dice-container');
    if (!container) return;

    container.innerHTML = '';

    if (diceRenderer) {
        diceRenderer.dispose();
    }

    const width = container.clientWidth;
    const height = container.clientHeight;

    diceScene = new THREE.Scene();
    diceScene.background = new THREE.Color(0x1a1a2e);

    diceCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    diceCamera.position.set(0, 8, 8);
    diceCamera.lookAt(0, 0, 0);

    diceRenderer = new THREE.WebGLRenderer({ antialias: true });
    diceRenderer.setSize(width, height);
    diceRenderer.setPixelRatio(window.devicePixelRatio);
    diceRenderer.shadowMap.enabled = true;
    diceRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(diceRenderer.domElement);

    // 灯光
    diceScene.add(new THREE.AmbientLight(0xffffff, 0.6));

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    diceScene.add(dirLight);

    // 地面
    const groundGeo = new THREE.PlaneGeometry(12, 12);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x2a2a44, roughness: 0.8, metalness: 0.2 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    diceScene.add(ground);

    // 物理世界
    diceWorld = new CANNON.World();
    diceWorld.gravity.set(0, -9.82, 0);
    diceWorld.broadphase = new CANNON.NaiveBroadphase();
    diceWorld.solver.iterations = 10;

    // 地面物理体
    const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    diceWorld.addBody(groundBody);

    // 围墙
    const wallShape = new CANNON.Plane();
    [
        { pos: [0, 0, -6], rot: [0, 0, 0] },
        { pos: [0, 0, 6],  rot: [0, Math.PI, 0] },
        { pos: [-6, 0, 0], rot: [0, Math.PI / 2, 0] },
        { pos: [6, 0, 0],  rot: [0, -Math.PI / 2, 0] }
    ].forEach(({ pos, rot }) => {
        const wb = new CANNON.Body({ mass: 0, shape: wallShape });
        wb.position.set(...pos);
        wb.quaternion.setFromEuler(...rot);
        diceWorld.addBody(wb);
    });
}

// ===== 结果计算 =====

function getDiceTopFace(mesh) {
    const up = new THREE.Vector3(0, 1, 0);
    const faceNormals = mesh.userData.faceNormals;
    const faces = mesh.userData.faces;

    let maxDot = -1;
    let topFace = 1;

    faceNormals.forEach((normal, i) => {
        const worldNormal = normal.clone().applyQuaternion(mesh.quaternion);
        const dot = worldNormal.dot(up);
        if (dot > maxDot) {
            maxDot = dot;
            topFace = i + 1;
        }
    });

    return Math.min(topFace, faces);
}

function isDiceStopped(body) {
    const v = body.velocity;
    const av = body.angularVelocity;
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) < 0.1 &&
           Math.sqrt(av.x * av.x + av.y * av.y + av.z * av.z) < 0.1;
}

// ===== 投掷 =====

function rollDice3D() {
    if (!diceDepsLoaded) {
        loadDiceDependencies(function() {
            buildDiceUI();
            rollDice3D();
        });
        return;
    }
    if (isDiceRolling) return;
    isDiceRolling = true;

    const resultDiv = document.getElementById('dice-result');
    if (resultDiv) resultDiv.style.display = 'none';

    // 清理旧骰子
    diceObjects.forEach(obj => diceScene.remove(obj));
    diceBodies.forEach(body => diceWorld.removeBody(body));
    diceObjects = [];
    diceBodies = [];
    diceFaceNormals = [];
    diceFaceCounts = [];

    // 解析公式
    const formula = state.diceConfig?.formula || '3D6';
    const parsed = parseDiceFormula(formula);
    const total = getTotalDiceCount(parsed);

    // 根据骰子数量动态调整相机和场地大小
    const spread = Math.max(2, Math.sqrt(total) * 1.8);
    diceCamera.position.set(0, spread * 2.5, spread * 2.5);
    diceCamera.lookAt(0, 0, 0);

    let globalIndex = 0;
    const cols = Math.ceil(Math.sqrt(total));

    for (const group of parsed) {
        for (let j = 0; j < group.count; j++) {
            const mesh = createDiceMesh(group.faces);
            const row = Math.floor(globalIndex / cols);
            const col = globalIndex % cols;
            const offsetX = (col - (cols - 1) / 2) * 1.6;
            const offsetZ = (row - (cols - 1) / 2) * 1.6;

            mesh.position.set(offsetX, 3 + Math.random() * 2, offsetZ);
            diceScene.add(mesh);
            diceObjects.push(mesh);
            diceFaceCounts.push(group.faces);

            const body = createDiceBody();
            body.position.set(offsetX, 3 + Math.random() * 2, offsetZ);
            body.velocity.set(
                (Math.random() - 0.5) * 5,
                -2 + Math.random() * 2,
                (Math.random() - 0.5) * 5
            );
            body.angularVelocity.set(
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20
            );

            diceWorld.addBody(body);
            diceBodies.push(body);
            globalIndex++;
        }
    }

    // 动画循环
    const stopStatus = new Array(total).fill(false);

    function animate() {
        diceWorld.step(1 / 60);

        for (let i = 0; i < diceObjects.length; i++) {
            diceObjects[i].position.copy(diceBodies[i].position);
            diceObjects[i].quaternion.copy(diceBodies[i].quaternion);
        }

        diceRenderer.render(diceScene, diceCamera);

        let stoppedCount = 0;
        for (let i = 0; i < diceBodies.length; i++) {
            if (!stopStatus[i] && isDiceStopped(diceBodies[i])) {
                stopStatus[i] = true;
            }
            if (stopStatus[i]) stoppedCount++;
        }

        if (stoppedCount < total) {
            diceAnimFrameId = requestAnimationFrame(animate);
        } else {
            // 计算结果
            const results = diceObjects.map((mesh, i) => ({
                faces: diceFaceCounts[i],
                value: getDiceTopFace(mesh)
            }));

            // 按类型分组显示
            const grouped = {};
            results.forEach(r => {
                if (!grouped[r.faces]) grouped[r.faces] = [];
                grouped[r.faces].push(r.value);
            });

            const grandTotal = results.reduce((s, r) => s + r.value, 0);
            let detailParts = [];
            for (const [faces, values] of Object.entries(grouped)) {
                detailParts.push(values.length + 'D' + faces + ': ' + values.join('+'));
            }

            if (resultDiv) {
                resultDiv.innerHTML = '<div style="line-height:1.6;">' +
                    '<div style="font-size:1.1em;">总计: <strong>' + grandTotal + '</strong></div>' +
                    '<div style="font-size:0.8em;color:#aaa;">' + detailParts.join(' | ') + '</div>' +
                    '</div>';
                resultDiv.style.display = 'block';
            }

            isDiceRolling = false;
        }
    }

    animate();
}

// ===== UI 集成 =====

function buildDiceUI() {
    if (!diceDepsLoaded) return;
    initDiceScene();
}

function handleDiceScene(isActive) {
    const container = document.getElementById('dice-container');
    const resultDiv = document.getElementById('dice-result');
    if (!container) return;

    if (!isActive) {
        if (resultDiv) resultDiv.style.display = 'none';
        if (diceAnimFrameId) { cancelAnimationFrame(diceAnimFrameId); diceAnimFrameId = null; }
        return;
    }

    if (resultDiv) resultDiv.style.display = 'none';

    if (!diceDepsLoaded) {
        loadDiceDependencies(function() { buildDiceUI(); rollDice3D(); });
    } else {
        buildDiceUI();
        rollDice3D();
    }
}

function rollDice() { rollDice3D(); }

// 更新骰子公式
function updateDiceFormula(value) {
    if (!state.diceConfig) state.diceConfig = { formula: '3D6' };
    state.diceConfig.formula = value.trim() || '3D6';
    saveData(false);
}

// 兼容旧接口
function updateDiceConfig(field, value) {
    if (!state.diceConfig) state.diceConfig = { formula: '3D6' };
    if (field === 'count') {
        let count = parseInt(value, 10);
        if (isNaN(count) || count < 1) count = 1;
        if (count > 20) count = 20;
        // 转换为新格式
        const oldFormula = state.diceConfig.formula || '3D6';
        const parsed = parseDiceFormula(oldFormula);
        if (parsed.length > 0) {
            parsed[0].count = count;
            state.diceConfig.formula = parsed.map(p => p.count + 'D' + p.faces).join('+');
        }
    } else if (field === 'type') {
        const oldFormula = state.diceConfig.formula || '3D6';
        const parsed = parseDiceFormula(oldFormula);
        const faces = parseInt(value.replace('d', ''), 10) || 6;
        if (parsed.length > 0) {
            parsed[0].faces = faces;
            state.diceConfig.formula = parsed.map(p => p.count + 'D' + p.faces).join('+');
        }
    }
    saveData(false);
}

// 窗口大小调整
window.addEventListener('resize', () => {
    const container = document.getElementById('dice-container');
    if (!container || !diceRenderer) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    diceCamera.aspect = w / h;
    diceCamera.updateProjectionMatrix();
    diceRenderer.setSize(w, h);
});