/**
 * INFINITE OPEN WORLD - FULL ENGINE
 * Controls: WASD to Move, Mouse to Look, F for Flashlight, Space to Jump
 */

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

// Sun Setup
const sunDisk = new THREE.Mesh(
    new THREE.SphereGeometry(15, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xffdf00 })
);
const sunLight = new THREE.DirectionalLight(0xffffff, 1);
sunLight.castShadow = true;
// Configure Sun Shadows for large scale
sunLight.shadow.camera.left = -100;
sunLight.shadow.camera.right = 100;
sunLight.shadow.camera.top = 100;
sunLight.shadow.camera.bottom = -100;
sunDisk.add(sunLight);
celestialGroup.add(sunDisk);

// Moon Setup
const moonDisk = new THREE.Mesh(
    new THREE.SphereGeometry(10, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xeeeeee })
);
const moonLight = new THREE.PointLight(0x4444ff, 0.8, 500);
moonDisk.add(moonLight);
celestialGroup.add(moonDisk);

const ambient = new THREE.AmbientLight(0x404040, 0.5);
scene.add(ambient);

// --- 3. TIME & LIGHTING LOGIC ---
const dayDurationSeconds = 15 * 60; 
const daySpeed = (Math.PI * 2) / (dayDurationSeconds * 60); 
let time = 0; // Starts at 0 (Morning/Sunrise)
const orbitRadius = 900;

function updateLighting() {
    time += daySpeed;
    
    // Orbit math
    sunDisk.position.set(Math.cos(time) * orbitRadius, Math.sin(time) * orbitRadius, -100);
    moonDisk.position.set(Math.cos(time + Math.PI) * orbitRadius, Math.sin(time + Math.PI) * orbitRadius, -100);

    const sunY = sunDisk.position.y;
    const dayColor = new THREE.Color(0x87ceeb);
    const nightColor = new THREE.Color(0x020205);
    
    // Calculate intensity and background blend
    const lerpFactor = THREE.MathUtils.clamp((sunY + 100) / 400, 0, 1);
    scene.background = new THREE.Color().lerpColors(nightColor, dayColor, lerpFactor);
    
    sunLight.intensity = lerpFactor;
    ambient.intensity = Math.max(0.1, lerpFactor * 0.5);
    
    return sunY > 0; // Returns true if daytime
}

// --- 4. PLAYER & SMOOTH FLASHLIGHT ---
const player = new THREE.Mesh(
    new THREE.BoxGeometry(1, 2, 1), 
    new THREE.MeshLambertMaterial({ color: 0xe63946 })
);
player.castShadow = true;
scene.add(player);

// Smooth Edged Flashlight
const flashlight = new THREE.SpotLight(0xfff9d4, 15, 100, Math.PI / 6, 0.8, 2);
flashlight.position.set(0, 0.5, 0); 
flashlight.castShadow = true;
flashlight.shadow.mapSize.width = 1024;
flashlight.shadow.mapSize.height = 1024;

const lightTarget = new THREE.Object3D();
lightTarget.position.set(0, 0.5, -10); 
player.add(flashlight);
player.add(lightTarget);
flashlight.target = lightTarget;
flashlight.visible = false;

// --- 5. SYSTEMS (Battery, FPS, Physics) ---
let batteryLevel = 100;
let lastTime = performance.now();
let frameCount = 0;
let velocityY = 0;
let canJump = false;
let pitch = 0, yaw = 0;

const fpsDisplay = document.getElementById('fps-counter');
const batteryBar = document.getElementById('battery-bar');
const batteryText = document.getElementById('battery-text');

function updateSystems(isDaytime) {
    // FPS
    frameCount++;
    const now = performance.now();
    if (now >= lastTime + 1000) {
        if(fpsDisplay) fpsDisplay.innerText = `FPS: ${frameCount}`;
        frameCount = 0;
        lastTime = now;
    }

    // Battery Logic (Drain vs Solar Recharge)
    if (flashlight.visible) {
        batteryLevel -= 0.08;
    } else if (isDaytime && batteryLevel < 100) {
        batteryLevel += 0.04;
    }
    
    batteryLevel = Math.max(0, Math.min(100, batteryLevel));
    if (batteryLevel <= 0) flashlight.visible = false;

    if(batteryBar) {
        batteryBar.style.width = batteryLevel + '%';
        batteryText.innerText = `Battery: ${Math.floor(batteryLevel)}%`;
        batteryBar.style.background = batteryLevel < 25 ? "#ff4d4d" : (batteryLevel < 60 ? "#ffd11a" : "#00ff88");
    }
}

// --- 6. INFINITE TERRAIN ENGINE ---
const terrainGroup = new THREE.Group();
scene.add(terrainGroup);
const chunks = new Map();
const chunkSize = 100;
const renderDist = 2;

const getHeight = (x, z) => Math.sin(x * 0.04) * Math.cos(z * 0.04) * 8 + Math.sin(x * 0.1) * 2;

function createChunk(x, z) {
    const key = `${x},${z}`;
    if (chunks.has(key)) return;
    const geo = new THREE.PlaneGeometry(chunkSize, chunkSize, 20, 20);
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

// --- 7. CONTROLS & MOVEMENT ---
const keys = { w: false, a: false, s: false, d: false };
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && canJump) velocityY = 0.5;
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

const raycaster = new THREE.Raycaster();

function animate() {
    requestAnimationFrame(animate);

    // Movement
    const speed = 0.7;
    const rot = player.rotation.y;
    if (keys.w) { player.position.x -= Math.sin(rot) * speed; player.position.z -= Math.cos(rot) * speed; }
    if (keys.s) { player.position.x += Math.sin(rot) * speed; player.position.z += Math.cos(rot) * speed; }
    if (keys.a) { player.position.x -= Math.cos(rot) * speed; player.position.z += Math.sin(rot) * speed; }
    if (keys.d) { player.position.x += Math.cos(rot) * speed; player.position.z -= Math.sin(rot) * speed; }

    // Physics
    velocityY -= 0.02;
    player.position.y += velocityY;

    // Grounding
    raycaster.set(new THREE.Vector3(player.position.x, player.position.y + 10, player.position.z), new THREE.Vector3(0, -1, 0));
    const hit = raycaster.intersectObjects(terrainGroup.children);
    if (hit.length > 0) {
        const ground = hit[0].point.y + 1.5;
        if (player.position.y <= ground) {
            player.position.y = ground;
            velocityY = 0;
            canJump = true;
        } else {
            canJump = false;
        }
    }

    // World & Systems
    const isDay = updateLighting();
    updateSystems(isDay);
    
    const pX = Math.round(player.position.x / chunkSize);
    const pZ = Math.round(player.position.z / chunkSize);
    for (let x = pX - renderDist; x <= pX + renderDist; x++) {
        for (let z = pZ - renderDist; z <= pZ + renderDist; z++) createChunk(x, z);
    }

    // Camera
    const camOffset = new THREE.Vector3(0, 5, 12).applyQuaternion(player.quaternion);
    camera.position.copy(player.position).add(camOffset);
    camera.lookAt(player.position.x, player.position.y + pitch * 5, player.position.z);

    renderer.render(scene, camera);
}

// Start
animate();
