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
scene.add(new THREE.AmbientLight(0x404040, 0.5));

// --- 3. TIME CONTROL ---
const dayDurationSeconds = 15 * 60; 
const daySpeed = (Math.PI * 2) / (dayDurationSeconds * 60); 
let time = Math.PI / 2; // Start Mid-day
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
    scene.background = new THREE.Color().lerpColors(new THREE.Color(0x020205), new THREE.Color(0x87ceeb), lerpFactor);
    sunLight.intensity = lerpFactor;
    return sunDisk.position.y > 0;
}

// --- 4. BIOME LOGIC ---
// We use a simple grid: 
// X > 200: Snowy Mountains | X < -200: Hilly Highlands | Center: Plains
function getBiome(x, z) {
    if (x > 300) return { name: "SNOW", color: 0xffffff, heightMult: 4.0, noise: 0.02 };
    if (x < -300) return { name: "HILLS", color: 0x5a7d5a, heightMult: 2.5, noise: 0.05 };
    return { name: "PLAINS", color: 0x348C31, heightMult: 0.5, noise: 0.03 };
}

function getHeight(x, z) {
    const biome = getBiome(x, z);
    const base = Math.sin(x * biome.noise) * Math.cos(z * biome.noise) * 10 * biome.heightMult;
    const detail = Math.sin(x * 0.1) * 2;
    return base + detail;
}

// --- 5. ASSETS (Trees & Ponds) ---
const waterMat = new THREE.MeshStandardMaterial({ color: 0x0077be, transparent: true, opacity: 0.7 });

function createTree(x, y, z, biomeName) {
    const treeGroup = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.5), new THREE.MeshStandardMaterial({ color: 0x4b3621 }));
    trunk.position.y = 0.75;
    
    // Snowy trees are white/light green
    const leafColor = biomeName === "SNOW" ? 0xdae0e2 : 0x0b5345;
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3, 8), new THREE.MeshStandardMaterial({ color: leafColor }));
    leaves.position.y = 2.5;
    
    treeGroup.add(trunk); treeGroup.add(leaves);
    treeGroup.position.set(x, y, z);
    return treeGroup;
}

// --- 6. TERRAIN ENGINE ---
const terrainGroup = new THREE.Group();
scene.add(terrainGroup);
const chunks = new Map();
const chunkSize = 100;

function createChunk(cx, cz) {
    const key = `${cx},${cz}`;
    if (chunks.has(key)) return;
    const chunkGroup = new THREE.Group();
    const biome = getBiome(cx * chunkSize, cz * chunkSize);

    // Terrain
    const geo = new THREE.PlaneGeometry(chunkSize, chunkSize, 15, 15);
    const v = geo.attributes.position.array;
    for (let i = 0; i < v.length; i += 3) {
        v[i + 2] = getHeight(v[i] + (cx * chunkSize), -(v[i + 1] - (cz * chunkSize)));
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: biome.color, roughness: 0.8 }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    chunkGroup.add(mesh);

    // Ponds: ONLY in Plains, if height is very low
    if (biome.name === "PLAINS") {
        const pondGeo = new THREE.CircleGeometry(15, 16);
        const pond = new THREE.Mesh(pondGeo, waterMat);
        pond.rotation.x = -Math.PI / 2;
        pond.position.set(0, -2.5, 0); // Placed slightly below average ground
        chunkGroup.add(pond);
    }

    // Trees
    const treeCount = biome.name === "SNOW" ? 4 : 10;
    for (let i = 0; i < treeCount; i++) {
        const tx = (Math.random() - 0.5) * chunkSize;
        const tz = (Math.random() - 0.5) * chunkSize;
        const ty = getHeight(tx + (cx * chunkSize), tz + (cz * chunkSize));
        chunkGroup.add(createTree(tx, ty, tz, biome.name));
    }

    chunkGroup.position.set(cx * chunkSize, 0, cz * chunkSize);
    terrainGroup.add(chunkGroup);
    chunks.set(key, chunkGroup);
}

// --- 7. PLAYER, CONTROLS & PHYSICS ---
const player = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshLambertMaterial({ color: 0xe63946 }));
player.position.y = 20;
scene.add(player);

const flashlight = new THREE.SpotLight(0xfff9d4, 15, 100, Math.PI / 6, 0.8, 2);
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
    
    // FPS & Battery
    frameCount++;
    const now = performance.now();
    if (now >= lastTime + 1000) { document.getElementById('fps-counter').innerText = `FPS: ${frameCount}`; frameCount = 0; lastTime = now; }
    const isDay = updateLighting();
    if (flashlight.visible) batteryLevel -= 0.08;
    else if (isDay && batteryLevel < 100) batteryLevel += 0.04;
    document.getElementById('battery-bar').style.width = batteryLevel + '%';

    // Movement
    const speed = 0.8;
    if (keys.w) { player.position.x -= Math.sin(yaw) * speed; player.position.z -= Math.cos(yaw) * speed; }
    if (keys.s) { player.position.x += Math.sin(yaw) * speed; player.position.z += Math.cos(yaw) * speed; }
    if (keys.a) { player.position.x -= Math.cos(yaw) * speed; player.position.z += Math.sin(yaw) * speed; }
    if (keys.d) { player.position.x += Math.cos(yaw) * speed; player.position.z -= Math.sin(yaw) * speed; }

    if (keys.space && canJump) { velocityY = 0.5; canJump = false; }
    velocityY -= 0.02; player.position.y += velocityY;

    // Grounding
    raycaster.set(new THREE.Vector3(player.position.x, player.position.y + 10, player.position.z), new THREE.Vector3(0, -1, 0));
    const hits = raycaster.intersectObjects(terrainGroup.children, true);
    const groundHit = hits.find(h => h.object.geometry.type === "PlaneGeometry");
    if (groundHit) {
        const gY = groundHit.point.y + 1.5;
        if (player.position.y <= gY) { player.position.y = gY; velocityY = 0; canJump = true; }
    }

    // Load Chunks
    const pX = Math.round(player.position.x / chunkSize), pZ = Math.round(player.position.z / chunkSize);
    for (let x = pX - 2; x <= pX + 2; x++) for (let z = pZ - 2; z <= pZ + 2; z++) createChunk(x, z);

    // Camera
    const camOffset = new THREE.Vector3(0, 5, 12).applyQuaternion(player.quaternion);
    camera.position.copy(player.position).add(camOffset);
    camera.lookAt(player.position.x, player.position.y + pitch * 5, player.position.z);

    renderer.render(scene, camera);
}
animate();
