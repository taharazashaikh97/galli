/**
 * NATURAL WORLD ENGINE
 * Features: Biome Blending (Plains -> Snow), Infinite Terrain, No Water
 */

// --- 1. INITIAL SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
document.body.appendChild(renderer.domElement);

// --- 2. CELESTIAL SYSTEM ---
const celestialGroup = new THREE.Group();
scene.add(celestialGroup);
const sunDisk = new THREE.Mesh(new THREE.SphereGeometry(15, 32, 32), new THREE.MeshBasicMaterial({ color: 0xffdf00 }));
const sunLight = new THREE.DirectionalLight(0xffffff, 1);
sunLight.castShadow = true;
sunDisk.add(sunLight);
celestialGroup.add(sunDisk);

const moonDisk = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 32), new THREE.MeshBasicMaterial({ color: 0xeeeeee }));
const moonLight = new THREE.PointLight(0x4444ff, 0.8, 500);
moonDisk.add(moonLight);
celestialGroup.add(moonDisk);
scene.add(new THREE.AmbientLight(0x404040, 0.4));

// --- 3. TIME CONTROL ---
const dayDurationSeconds = 15 * 60; 
const daySpeed = (Math.PI * 2) / (dayDurationSeconds * 60); 
let time = Math.PI / 2; // Mid-day Start
const orbitRadius = 900;
const timeSlider = document.getElementById('time-slider');

function updateLighting() {
    if (document.activeElement === timeSlider) {
        time = parseFloat(timeSlider.value);
    } else {
        time += daySpeed;
        timeSlider.value = time;
    }
    sunDisk.position.set(Math.cos(time) * orbitRadius, Math.sin(time) * orbitRadius, -100);
    moonDisk.position.set(Math.cos(time + Math.PI) * orbitRadius, Math.sin(time + Math.PI) * orbitRadius, -100);
    const lerpFactor = THREE.MathUtils.clamp((sunDisk.position.y + 100) / 400, 0, 1);
    scene.background = new THREE.Color().lerpColors(new THREE.Color(0x050508), new THREE.Color(0x87ceeb), lerpFactor);
    sunLight.intensity = lerpFactor;
    return sunDisk.position.y > 0;
}

// --- 4. NATURAL BIOME & NOISE LOGIC ---
function getBiomeData(x, z) {
    // Determine snow "influence" based on Z position (North is snowy)
    const snowWeight = THREE.MathUtils.clamp(z / 500, 0, 1); 
    const hillWeight = THREE.MathUtils.clamp(Math.abs(x) / 600, 0.2, 1.5);

    return {
        snow: snowWeight,
        heightFactor: hillWeight,
        color: new THREE.Color(0x348C31).lerp(new THREE.Color(0xffffff), snowWeight)
    };
}

function getHeight(x, z) {
    const data = getBiomeData(x, z);
    // Layered Noise for natural feel
    const base = Math.sin(x * 0.02) * Math.cos(z * 0.02) * 15 * data.heightFactor;
    const bumps = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2;
    return base + bumps;
}

// --- 5. NATURAL ASSETS ---
function createTree(x, y, z, isSnowy) {
    const treeGroup = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.5), new THREE.MeshStandardMaterial({ color: 0x4b3621 }));
    trunk.position.y = 0.75;
    
    const leafColor = isSnowy > 0.5 ? 0xf0f0f0 : 0x1a4a1a;
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.5, 4, 6), new THREE.MeshStandardMaterial({ color: leafColor }));
    leaves.position.y = 2.5;
    
    treeGroup.add(trunk); treeGroup.add(leaves);
    treeGroup.position.set(x, y, z);
    treeGroup.rotation.y = Math.random() * Math.PI; // Random rotation for natural look
    return treeGroup;
}

// --- 6. TERRAIN ENGINE ---
const terrainGroup = new THREE.Group();
scene.add(terrainGroup);
const chunks = new Map();
const chunkSize = 120;

function createChunk(cx, cz) {
    const key = `${cx},${cz}`;
    if (chunks.has(key)) return;
    const chunkGroup = new THREE.Group();
    const data = getBiomeData(cx * chunkSize, cz * chunkSize);

    const geo = new THREE.PlaneGeometry(chunkSize, chunkSize, 12, 12);
    const v = geo.attributes.position.array;
    for (let i = 0; i < v.length; i += 3) {
        v[i + 2] = getHeight(v[i] + (cx * chunkSize), -(v[i + 1] - (cz * chunkSize)));
    }
    geo.computeVertexNormals();
    
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: data.color, roughness: 0.9 }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    chunkGroup.add(mesh);

    // Random Trees based on "lushness"
    const density = data.snow > 0.7 ? 3 : 8;
    for (let i = 0; i < density; i++) {
        const tx = (Math.random() - 0.5) * chunkSize;
        const tz = (Math.random() - 0.5) * chunkSize;
        const ty = getHeight(tx + (cx * chunkSize), tz + (cz * chunkSize));
        chunkGroup.add(createTree(tx, ty, tz, data.snow));
    }

    chunkGroup.position.set(cx * chunkSize, 0, cz * chunkSize);
    terrainGroup.add(chunkGroup);
    chunks.set(key, chunkGroup);
}

// --- 7. PLAYER & STABLE PHYSICS ---
const player = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshLambertMaterial({ visible: false })); // Invisible body
player.position.y = 20;
scene.add(player);

const flashlight = new THREE.SpotLight(0xfff9d4, 15, 120, Math.PI / 6, 0.8, 2);
flashlight.position.set(0, 0.5, 0); 
flashlight.target = new THREE.Object3D();
player.add(flashlight); player.add(flashlight.target);
flashlight.target.position.set(0, 0.5, -10);
flashlight.visible = false;

let batteryLevel = 100, lastTime = performance.now(), frameCount = 0;
let velocityY = 0, canJump = false, pitch = 0, yaw = 0;
const keys = { w: false, a: false, s: false, d: false, space: false };

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') keys.space = true;
    if (e.key.toLowerCase() === 'f' && batteryLevel > 0) flashlight.visible = !flashlight.visible;
    keys[e.key.toLowerCase()] = true;
});
window.addEventListener('keyup', (e) => { if (e.code === 'Space') keys.space = false; keys[e.key.toLowerCase()] = false; });
document.addEventListener('click', (e) => { if (e.target.tagName !== 'INPUT') renderer.domElement.requestPointerLock(); });
document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === renderer.domElement) {
        yaw -= e.movementX * 0.002; pitch = THREE.MathUtils.clamp(pitch - e.movementY * 0.002, -Math.PI/3, Math.PI/3);
        player.rotation.y = yaw;
    }
});

const raycaster = new THREE.Raycaster();

function animate() {
    requestAnimationFrame(animate);
    
    // Systems
    frameCount++;
    const now = performance.now();
    if (now >= lastTime + 1000) { document.getElementById('fps-counter').innerText = `FPS: ${frameCount}`; frameCount = 0; lastTime = now; }
    const isDay = updateLighting();
    if (flashlight.visible) batteryLevel -= 0.07;
    else if (isDay && batteryLevel < 100) batteryLevel += 0.05;
    document.getElementById('battery-bar').style.width = batteryLevel + '%';

    // Natural Movement
    const speed = 0.8;
    if (keys.w) { player.position.x -= Math.sin(yaw) * speed; player.position.z -= Math.cos(yaw) * speed; }
    if (keys.s) { player.position.x += Math.sin(yaw) * speed; player.position.z += Math.cos(yaw) * speed; }
    if (keys.a) { player.position.x -= Math.cos(yaw) * speed; player.position.z += Math.sin(yaw) * speed; }
    if (keys.d) { player.position.x += Math.cos(yaw) * speed; player.position.z -= Math.sin(yaw) * speed; }

    if (keys.space && canJump) { velocityY = 0.45; canJump = false; }
    velocityY -= 0.02; player.position.y += velocityY;

    // Stable Grounding
    raycaster.set(new THREE.Vector3(player.position.x, player.position.y + 5, player.position.z), new THREE.Vector3(0, -1, 0));
    const hits = raycaster.intersectObjects(terrainGroup.children, true);
    const groundHit = hits.find(h => h.object.geometry.type === "PlaneGeometry");
    if (groundHit) {
        const gY = groundHit.point.y + 1.6;
        if (player.position.y <= gY) { player.position.y = gY; velocityY = 0; canJump = true; }
    }

    // Infinite World Loader
    const pX = Math.round(player.position.x / chunkSize), pZ = Math.round(player.position.z / chunkSize);
    for (let x = pX - 2; x <= pX + 2; x++) for (let z = pZ - 2; z <= pZ + 2; z++) createChunk(x, z);

    // Camera (Smooth follow)
    const camOffset = new THREE.Vector3(0, 4.5, 10).applyQuaternion(player.quaternion);
    camera.position.copy(player.position).add(camOffset);
    camera.lookAt(player.position.x, player.position.y + pitch * 5, player.position.z);

    renderer.render(scene, camera);
}
animate();
