// ===== 3D 物理骰子系统 =====

// 全局变量
let diceScene, diceCamera, diceRenderer, diceWorld;
let diceObjects = [];
let diceBodies = [];
let isDiceRolling = false;
let diceAnimFrameId = null;
let diceDepsLoaded = false;
let diceDepsLoading = false;

// 骰子点数纹理
const DICE_DOT_POSITIONS = {
    1: [[0, 0]],
    2: [[-0.25, 0.25], [0.25, -0.25]],
    3: [[-0.25, 0.25], [0, 0], [0.25, -0.25]],
    4: [[-0.25, 0.25], [0.25, 0.25], [-0.25, -0.25], [0.25, -0.25]],
    5: [[-0.25, 0.25], [0.25, 0.25], [0, 0], [-0.25, -0.25], [0.25, -0.25]],
    6: [[-0.25, 0.25], [0.25, 0.25], [-0.25, 0], [0.25, 0], [-0.25, -0.25], [0.25, -0.25]]
};

// 动态加载依赖
function loadDiceDependencies(callback) {
    if (diceDepsLoaded) {
        callback();
        return;
    }
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
                function() {
                    diceDepsLoading = false;
                    showDiceFallback('Cannon.js 加载失败');
                }
            );
        },
        function() {
            diceDepsLoading = false;
            showDiceFallback('Three.js 加载失败');
        }
    );
}

function showDiceFallback(msg) {
    const container = document.getElementById('dice-container');
    if (container) {
        container.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#888;font-size:14px;gap:8px;"><span>' + msg + '</span><span style="font-size:12px;">请检查网络连接或刷新页面</span></div>';
    }
}

// 创建骰子面纹理
function createDiceFaceTexture(number) {
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

// 创建 3D 骰子
function createDiceMesh() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const materials = [
        new THREE.MeshStandardMaterial({ map: createDiceFaceTexture(3) }),
        new THREE.MeshStandardMaterial({ map: createDiceFaceTexture(4) }),
        new THREE.MeshStandardMaterial({ map: createDiceFaceTexture(1) }),
        new THREE.MeshStandardMaterial({ map: createDiceFaceTexture(6) }),
        new THREE.MeshStandardMaterial({ map: createDiceFaceTexture(2) }),
        new THREE.MeshStandardMaterial({ map: createDiceFaceTexture(5) })
    ];

    const mesh = new THREE.Mesh(geometry, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

// 创建物理骰子体
function createDiceBody() {
    const shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
    const body = new CANNON.Body({
        mass: 1,
        shape: shape
    });
    body.material = new CANNON.Material('dice');
    body.material.friction = 0.3;
    body.material.restitution = 0.3;
    return body;
}

// 初始化 3D 场景
function initDiceScene() {
    const container = document.getElementById('dice-container');
    if (!container) return;

    // 清除加载提示等旧内容
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

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    diceScene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    diceScene.add(directionalLight);

    const groundGeometry = new THREE.PlaneGeometry(10, 10);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a2a44,
        roughness: 0.8,
        metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    diceScene.add(ground);

    diceWorld = new CANNON.World();
    diceWorld.gravity.set(0, -9.82, 0);
    diceWorld.broadphase = new CANNON.NaiveBroadphase();
    diceWorld.solver.iterations = 10;

    const groundBody = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Plane()
    });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    diceWorld.addBody(groundBody);

    const wallShape = new CANNON.Plane();
    const wallPositions = [
        { pos: [0, 0, -5], rot: [0, 0, 0] },
        { pos: [0, 0, 5], rot: [0, Math.PI, 0] },
        { pos: [-5, 0, 0], rot: [0, Math.PI / 2, 0] },
        { pos: [5, 0, 0], rot: [0, -Math.PI / 2, 0] }
    ];

    wallPositions.forEach(({ pos, rot }) => {
        const wallBody = new CANNON.Body({ mass: 0, shape: wallShape });
        wallBody.position.set(...pos);
        wallBody.quaternion.setFromEuler(...rot);
        diceWorld.addBody(wallBody);
    });
}

// 获取骰子朝上的点数
function getDiceTopFace(body) {
    const up = new CANNON.Vec3(0, 1, 0);
    const faceNormals = [
        new CANNON.Vec3(1, 0, 0),
        new CANNON.Vec3(-1, 0, 0),
        new CANNON.Vec3(0, 1, 0),
        new CANNON.Vec3(0, -1, 0),
        new CANNON.Vec3(0, 0, 1),
        new CANNON.Vec3(0, 0, -1)
    ];
    const faceValues = [3, 4, 1, 6, 2, 5];

    let maxDot = -1;
    let topFace = 1;

    faceNormals.forEach((normal, i) => {
        const worldNormal = body.quaternion.vmult(normal);
        const dot = worldNormal.dot(up);
        if (dot > maxDot) {
            maxDot = dot;
            topFace = faceValues[i];
        }
    });

    return topFace;
}

// 检查骰子是否静止
function isDiceStopped(body) {
    const vel = body.velocity;
    const angVel = body.angularVelocity;
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
    const angSpeed = Math.sqrt(angVel.x * angVel.x + angVel.y * angVel.y + angVel.z * angVel.z);
    return speed < 0.1 && angSpeed < 0.1;
}

// 投掷骰子
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

    const container = document.getElementById('dice-container');
    const resultDiv = document.getElementById('dice-result');
    if (resultDiv) resultDiv.style.display = 'none';

    diceObjects.forEach(obj => diceScene.remove(obj));
    diceBodies.forEach(body => diceWorld.removeBody(body));
    diceObjects = [];
    diceBodies = [];

    const count = state.diceConfig?.count || 1;
    const spacing = 1.5;

    for (let i = 0; i < count; i++) {
        const mesh = createDiceMesh();
        const offsetX = (i - (count - 1) / 2) * spacing;
        mesh.position.set(offsetX, 3 + Math.random() * 2, 0);
        diceScene.add(mesh);
        diceObjects.push(mesh);

        const body = createDiceBody();
        body.position.set(offsetX, 3 + Math.random() * 2, 0);

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
    }

    let stoppedCount = 0;
    const stopStatus = new Array(count).fill(false);

    function animate() {
        diceWorld.step(1 / 60);

        for (let i = 0; i < diceObjects.length; i++) {
            diceObjects[i].position.copy(diceBodies[i].position);
            diceObjects[i].quaternion.copy(diceBodies[i].quaternion);
        }

        diceRenderer.render(diceScene, diceCamera);

        stoppedCount = 0;
        for (let i = 0; i < diceBodies.length; i++) {
            if (!stopStatus[i] && isDiceStopped(diceBodies[i])) {
                stopStatus[i] = true;
            }
            if (stopStatus[i]) stoppedCount++;
        }

        if (stoppedCount < count) {
            diceAnimFrameId = requestAnimationFrame(animate);
        } else {
            const results = diceBodies.map(body => getDiceTopFace(body));
            const total = results.reduce((a, b) => a + b, 0);

            if (resultDiv) {
                resultDiv.textContent = '总计: ' + total;
                resultDiv.style.display = 'block';
            }

            isDiceRolling = false;
        }
    }

    animate();
}

// 构建骰子 UI
function buildDiceUI() {
    if (!diceDepsLoaded) return;
    initDiceScene();
}

// 处理骰子场景激活
function handleDiceScene(isActive) {
    const container = document.getElementById('dice-container');
    const resultDiv = document.getElementById('dice-result');
    if (!container) return;

    if (!isActive) {
        if (resultDiv) resultDiv.style.display = 'none';
        if (diceAnimFrameId) {
            cancelAnimationFrame(diceAnimFrameId);
            diceAnimFrameId = null;
        }
        return;
    }

    if (resultDiv) resultDiv.style.display = 'none';

    if (!diceDepsLoaded) {
        loadDiceDependencies(function() {
            buildDiceUI();
            rollDice3D();
        });
    } else {
        buildDiceUI();
        rollDice3D();
    }
}

// 重掷骰子（兼容旧接口）
function rollDice() {
    rollDice3D();
}

// 更新骰子配置
function updateDiceConfig(field, value) {
    if (!state.diceConfig) state.diceConfig = { count: 1, type: 'd6' };
    if (field === 'count') {
        let count = parseInt(value, 10);
        if (isNaN(count) || count < 1) count = 1;
        if (count > 10) count = 10;
        state.diceConfig.count = count;
    } else {
        state.diceConfig.type = value;
    }
    saveData(false);
}

// 窗口大小调整
window.addEventListener('resize', () => {
    const container = document.getElementById('dice-container');
    if (!container || !diceRenderer) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    diceCamera.aspect = width / height;
    diceCamera.updateProjectionMatrix();
    diceRenderer.setSize(width, height);
});