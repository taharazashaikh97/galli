// --- 1. INITIAL SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
document.body.appendChild(renderer.domElement);

// --- 2. CELESTIAL BODIES (Sun & Moon) ---
const sunDisk = new THREE.Mesh(
    new THREE.SphereGeometry(15, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff000 })
);
const moonDisk = new THREE.Mesh(
    new THREE.SphereGeometry(10, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xeeeeee })
);
scene.add(sunDisk);
scene.add(moonDisk);

const sunLight = new THREE.DirectionalLight(0xffffff, 1);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
scene.add(sunLight);

const ambient = new THREE.AmbientLight(0x404040, 0.5);
scene.add(ambient);

// --- 3. GAME STATE & CONSTANTS ---
const dayDurationSeconds = 15 * 60; 
const daySpeed = (Math.PI * 2) / (dayDurationSeconds * 60); 
let time = 0; // Start at 0 (Morning)
const orbitRadius = 900;

let batteryLevel = 100;
let lastTime = performance.now();
let frameCount = 0;

// --- 4. PLAYER & FLASHLIGHT ---
const player = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshLambertMaterial({ color: 0xe63946 }));
player.castShadow = true;
scene.add(player);

const flashlight = new THREE.SpotLight(0xfff9d4, 15, 100, Math.PI / 6, 0.8, 2);
flashlight.castShadow = true;
flashlight.visible = false;
const lightTarget = new THREE.Object3D();
player.add(flashlight);
player.add(lightTarget);
lightTarget.position.set(0, 0, -10);
flashlight.target = lightTarget;

// --- 5. TERRAIN ENGINE ---
const terrainGroup = new THREE.Group();
scene.add(terrainGroup);
const chunks = new Map();
const chunkSize = 100;

const getHeight = (x, z) => Math.sin(x * 0.04) * Math.cos(z * 0.04) * 8 + Math.sin(x * 0.1) * 2;

function createChunk(x, z) {
    const key = `${x},${z}`;
    if (chunks.has(key)) return;
    const geo = new THREE.PlaneGeometry(chunkSize, chunkSize, 24, 24);
    const v = geo.attributes.position.array;
    for (let i = 0; i < v.length; i += 3) {
        v[i + 2] = getHeight(v[i] + (x * chunkSize), -(v[i + 1] - (z * chunkSize)));
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x348C31, roughness: 0.8 }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x * chunkSize, 0, z * chunkSize);
    mesh.receiveShadow = true;
    terrainGroup.add(mesh);
    chunks.set(key, mesh);
}

// --- 6. CONTROLS ---
const keys = { w: false, a: false, s: false, d: false };
let pitch = 0, yaw = 0;

window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'f' && batteryLevel > 0) flashlight.visible = !flashlight.visible;
    keys[e.key.toLowerCase()] = true;
});
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

document.addEventListener('click', () => renderer.domElement.requestPointerLock());
document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === renderer.domElement) {
        yaw -= e.movementX * 0.002;
        pitch -= e.movementY * 0.002;
        pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, pitch));
        player.rotation.y = yaw;
    }
});

// --- 7. CORE SYSTEMS ---
function updateEnvironment() {
    time += daySpeed;
    
    // Position Celestial Bodies
    sunDisk.position.set(Math.cos(time) * orbitRadius, Math.sin(time) * orbitRadius, 0);
    moonDisk.position.set(Math.cos(time + Math.PI) * orbitRadius, Math.sin(time + Math.PI) * orbitRadius, 0);
    sunLight.position.copy(sunDisk.position);

    const sunY = sunDisk.position.y;
    const lerpFactor = THREE.MathUtils.clamp((sunY + 100) / 300, 0, 1);
    
    scene.background = new THREE.Color().lerpColors(new THREE.Color(0x020205), new THREE.Color(0x87ceeb), lerpFactor);
    sunLight.intensity = lerpFactor;
    ambient.intensity = 0.1 + (lerpFactor * 0.4);

    // Battery Logic
    if (flashlight.visible) {
        batteryLevel -= 0.08;
        if (batteryLevel <= 0) { batteryLevel = 0; flashlight.visible = false; }
    } else if (sunY > 0 && batteryLevel < 100) {
        batteryLevel += 0.04; // Solar recharge
    }

    document.getElementById('battery-bar').style.width = batteryLevel + '%';
    document.getElementById('battery-text').innerText = `BATTERY: ${Math.floor(batteryLevel)}%`;
}

const raycaster = new THREE.Raycaster();

function animate() {
    requestAnimationFrame(animate);

    // FPS
    frameCount++;
    const now = performance.now();
    if (now >= lastTime + 1000) {
        document.getElementById('fps-counter').innerText = `FPS: ${frameCount}`;
        frameCount = 0; lastTime = now;
    }

    // Movement (Fixed Strafe)
    const speed = 0.7;
    const rot = player.rotation.y;
    if (keys.w) { player.position.x -= Math.sin(rot) * speed; player.position.z -= Math.cos(rot) * speed; }
    if (keys.s) { player.position.x += Math.sin(rot) * speed; player.position.z += Math.cos(rot) * speed; }
    if (keys.a) { player.position.x -= Math.cos(rot) * speed; player.position.z += Math.sin(rot) * speed; }
    if (keys.d) { player.position.x += Math.cos(rot) * speed; player.position.z -= Math.sin(rot) * speed; }

    updateEnvironment();

    // Chunking & Grounding
    const pX = Math.round(player.position.x / chunkSize);
    const pZ = Math.round(player.position.z / chunkSize);
    for (let x = pX - 2; x <= pX + 2; x++) {
        for (let z = pZ - 2; z <= pZ + 2; z++) createChunk(x, z);
    }

    raycaster.set(new THREE.Vector3(player.position.x, 100, player.position.z), new THREE.Vector3(0, -1, 0));
    const hit = raycaster.intersectObjects(terrainGroup.children);
    if (hit.length > 0) player.position.y = hit[0].point.y + 1;

    // Camera
    const camOffset = new THREE.Vector3(0, 5, 12).applyQuaternion(player.quaternion);
    camera.position.copy(player.position).add(camOffset);
    camera.lookAt(player.position.x, player.position.y + pitch * 5, player.position.z);

    renderer.render(scene, camera);
}

animate();
