// --- 1. INITIAL SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
document.body.appendChild(renderer.domElement);

// --- 2. CELESTIAL SYSTEM (Sun & Moon) ---
const celestialGroup = new THREE.Group();
scene.add(celestialGroup);

const sunDisk = new THREE.Mesh(new THREE.SphereGeometry(15, 32, 32), new THREE.MeshBasicMaterial({ color: 0xffdf00 }));
const sunLight = new THREE.DirectionalLight(0xffffff, 1);
sunLight.castShadow = true;
sunLight.shadow.camera.left = -150; sunLight.shadow.camera.right = 150;
sunLight.shadow.camera.top = 150; sunLight.shadow.camera.bottom = -150;
sunDisk.add(sunLight);
celestialGroup.add(sunDisk);

const moonDisk = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 32), new THREE.MeshBasicMaterial({ color: 0xeeeeee }));
const moonLight = new THREE.PointLight(0x4444ff, 0.8, 500);
moonDisk.add(moonLight);
celestialGroup.add(moonDisk);

const ambient = new THREE.AmbientLight(0x404040, 0.5);
scene.add(ambient);

// --- 3. TIME & LIGHTING ---
const dayDurationSeconds = 15 * 60; 
const daySpeed = (Math.PI * 2) / (dayDurationSeconds * 60); 
let time = 0; 
const orbitRadius = 900;

function updateLighting() {
    time += daySpeed;
    sunDisk.position.set(Math.cos(time) * orbitRadius, Math.sin(time) * orbitRadius, -100);
    moonDisk.position.set(Math.cos(time + Math.PI) * orbitRadius, Math.sin(time + Math.PI) * orbitRadius, -100);
    const sunY = sunDisk.position.y;
    const lerpFactor = THREE.MathUtils.clamp((sunY + 100) / 400, 0, 1);
    scene.background = new THREE.Color().lerpColors(new THREE.Color(0x020205), new THREE.Color(0x87ceeb), lerpFactor);
    sunLight.intensity = lerpFactor;
    return sunY > 0;
}

// --- 4. PLAYER & STABLE FLASHLIGHT ---
const player = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshLambertMaterial({ color: 0xe63946 }));
player.castShadow = true;
scene.add(player);

const flashlight = new THREE.SpotLight(0xfff9d4, 15, 100, Math.PI / 6, 0.8, 2);
flashlight.position.set(0, 0.5, 0); 
flashlight.castShadow = true;
const lightTarget = new THREE.Object3D();
lightTarget.position.set(0, 0.5, -10); 
player.add(flashlight); player.add(lightTarget);
flashlight.target = lightTarget;
flashlight.visible = false;

// --- 5. FORESTS & WATER ASSETS ---
const waterLevel = -1.5;
const waterMat = new THREE.MeshStandardMaterial({ 
    color: 0x0077be, transparent: true, opacity: 0.6, roughness: 0.1, metalness: 0.5 
});

function createTree(x, y, z) {
    const treeGroup = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.5), new THREE.MeshStandardMaterial({ color: 0x4b3621 }));
    trunk.position.y = 0.75; trunk.castShadow = true;
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3, 8), new THREE.MeshStandardMaterial({ color: 0x0b5345 }));
    leaves.position.y = 2.5; leaves.castShadow = true;
    treeGroup.add(trunk); treeGroup.add(leaves);
    treeGroup.position.set(x, y, z);
    return treeGroup;
}

// --- 6. INFINITE TERRAIN ENGINE ---
const terrainGroup = new THREE.Group();
scene.add(terrainGroup);
const chunks = new Map();
const chunkSize = 100;
const getHeight = (x, z) => Math.sin(x * 0.04) * Math.cos(z * 0.04) * 8 + Math.sin(x * 0.1) * 2;

function createChunk(x, z) {
    const key = `${x},${z}`;
    if (chunks.has(key)) return;
    const chunkGroup = new THREE.Group();
    
    const geo = new THREE.PlaneGeometry(chunkSize, chunkSize, 20, 20);
    const v = geo.attributes.position.array;
    for (let i = 0; i < v.length; i += 3) {
        v[i + 2] = getHeight(v[i] + (x * chunkSize), -(v[i + 1] - (z * chunkSize)));
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x348C31, roughness: 0.8 }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    chunkGroup.add(mesh);

    const water = new THREE.Mesh(new THREE.PlaneGeometry(chunkSize, chunkSize), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = waterLevel;
    chunkGroup.add(water);

    for (let i = 0; i < 12; i++) {
        const tx = (Math.random() - 0.5) * chunkSize;
        const tz = (Math.random() - 0.5) * chunkSize;
        const ty = getHeight(tx + (x * chunkSize), tz + (z * chunkSize));
        if (ty > waterLevel + 0.5) chunkGroup.add(createTree(tx, ty, tz));
    }

    chunkGroup.position.set(x * chunkSize, 0, z * chunkSize);
    terrainGroup.add(chunkGroup);
    chunks.set(key, chunkGroup);
}

// --- 7. SYSTEMS & CONTROLS ---
let batteryLevel = 100, lastTime = performance.now(), frameCount = 0;
let velocityY = 0, canJump = false, pitch = 0, yaw = 0;
const keys = { w: false, a: false, s: false, d: false, space: false };

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') keys.space = true;
    if (e.key.toLowerCase() === 'f' && batteryLevel > 0) flashlight.visible = !flashlight.visible;
    keys[e.key.toLowerCase()] = true;
});
window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') keys.space = false;
    keys[e.key.toLowerCase()] = false;
});

document.addEventListener('click', () => renderer.domElement.requestPointerLock());
document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === renderer.domElement) {
        yaw -= e.movementX * 0.002; pitch -= e.movementY * 0.002;
        pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, pitch)); 
        player.rotation.y = yaw;
    }
});

const raycaster = new THREE.Raycaster();

function animate() {
    requestAnimationFrame(animate);

    // FPS & Battery
    frameCount++;
    const now = performance.now();
    if (now >= lastTime + 1000) {
        const fpsElem = document.getElementById('fps-counter');
        if(fpsElem) fpsElem.innerText = `FPS: ${frameCount}`;
        frameCount = 0; lastTime = now;
    }
    const isDay = updateLighting();
    if (flashlight.visible) batteryLevel -= 0.08;
    else if (isDay && batteryLevel < 100) batteryLevel += 0.04;
    
    batteryLevel = Math.max(0, Math.min(100, batteryLevel));
    const barElem = document.getElementById('battery-bar');
    if(barElem) barElem.style.width = batteryLevel + '%';
    if (batteryLevel <= 0) flashlight.visible = false;

    // Movement & Swimming
    const isSwimming = player.position.y < waterLevel + 1.2;
    const speed = isSwimming ? 0.3 : 0.7;
    if (keys.w) { player.position.x -= Math.sin(yaw) * speed; player.position.z -= Math.cos(yaw) * speed; }
    if (keys.s) { player.position.x += Math.sin(yaw) * speed; player.position.z += Math.cos(yaw) * speed; }
    if (keys.a) { player.position.x -= Math.cos(yaw) * speed; player.position.z += Math.sin(yaw) * speed; }
    if (keys.d) { player.position.x += Math.cos(yaw) * speed; player.position.z -= Math.sin(yaw) * speed; }

    // FIXED JUMP: Only jump if Space is pressed AND player is on ground
    if (keys.space && canJump) {
        velocityY = 0.5;
        canJump = false; // Disable jumping until we hit ground again
    }

    velocityY -= 0.02; // Gravity
    player.position.y += velocityY;

    // Grounding Collision
    raycaster.set(new THREE.Vector3(player.position.x, player.position.y + 5, player.position.z), new THREE.Vector3(0, -1, 0));
    const hits = raycaster.intersectObjects(terrainGroup.children, true);
    
    // Find the actual terrain surface
    const groundHit = hits.find(h => h.object.material.color && h.object.material.color.getHex() === 0x348C31);
    
    if (groundHit) {
        const groundY = groundHit.point.y + 1.5;
        if (player.position.y <= groundY) {
            player.position.y = groundY;
            velocityY = 0;
            canJump = true; // Landed, can jump again
        }
    }

    // Load Chunks
    const pX = Math.round(player.position.x / chunkSize), pZ = Math.round(player.position.z / chunkSize);
    for (let x = pX - 2; x <= pX + 2; x++) for (let z = pZ - 2; z <= pZ + 2; z++) createChunk(x, z);

    // Camera follow
    const camOffset = new THREE.Vector3(0, 5, 12).applyQuaternion(player.quaternion);
    camera.position.copy(player.position).add(camOffset);
    camera.lookAt(player.position.x, player.position.y + pitch * 5, player.position.z);

    renderer.render(scene, camera);
}
animate();
