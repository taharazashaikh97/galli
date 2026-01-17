// --- 1. INITIAL SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; // Enable shadows for the flashlight
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// --- 2. 15-MINUTE DAY/NIGHT CYCLE ---
const dayDurationSeconds = 15 * 60; 
const daySpeed = (Math.PI * 2) / (dayDurationSeconds * 60);
let time = 0; 

const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.castShadow = true; // Sun creates shadows during day
scene.add(sun);
const ambient = new THREE.AmbientLight(0x404040, 0.2);
scene.add(ambient);

function updateLighting() {
    time += daySpeed;
    const sunY = Math.sin(time) * 300;
    sun.position.set(Math.cos(time) * 300, sunY, 50);

    const dayColor = new THREE.Color(0x87ceeb);
    const nightColor = new THREE.Color(0x010103);
    const lerpFactor = THREE.MathUtils.clamp((sunY + 50) / 150, 0, 1);
    const currentColor = new THREE.Color().lerpColors(nightColor, dayColor, lerpFactor);
    
    scene.background = currentColor;
    scene.fog = new THREE.FogExp2(currentColor, 0.015);
    sun.intensity = lerpFactor;
}

// --- 3. THE "PERFECT" FLASHLIGHT & PLAYER ---
const player = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshLambertMaterial({ color: 0xe63946 }));
player.castShadow = true;
scene.add(player);

// Enhanced Spotlight: Added penumbra (soft edges) and decay
const flashlight = new THREE.SpotLight(0xfff9d4, 10, 80, Math.PI / 5, 0.4, 1.5);
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

// --- 4. PHYSICS & JUMP CONSTANTS ---
let velocityY = 0;
const gravity = -0.015;
const jumpStrength = 0.4;
let canJump = false;

// Mouse Look
let pitch = 0, yaw = 0;
document.addEventListener('click', () => renderer.domElement.requestPointerLock());
document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === renderer.domElement) {
        yaw -= e.movementX * 0.002;
        pitch -= e.movementY * 0.002;
        pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, pitch));
        player.rotation.y = yaw;
    }
});

// --- 5. TERRAIN ENGINE ---
const terrainGroup = new THREE.Group();
scene.add(terrainGroup);
const chunks = new Map();
const chunkSize = 100;
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
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x348C31 }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x * chunkSize, 0, z * chunkSize);
    mesh.receiveShadow = true; // Chunks show shadows
    terrainGroup.add(mesh);
    chunks.set(key, mesh);
}

// --- 6. CONTROLS ---
const keys = { w: false, a: false, s: false, d: false };
window.addEventListener('keydown', (e) => {
    if (e.key === ' ') { if(canJump) velocityY = jumpStrength; }
    if (e.key.toLowerCase() === 'f') flashlight.visible = !flashlight.visible;
    keys[e.key.toLowerCase()] = true;
});
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

const raycaster = new THREE.Raycaster();

function animate() {
    requestAnimationFrame(animate);

    // Movement Logic
    const speed = 0.6;
    if (keys.w) {
        player.position.x -= Math.sin(player.rotation.y) * speed;
        player.position.z -= Math.cos(player.rotation.y) * speed;
    }
    if (keys.s) {
        player.position.x += Math.sin(player.rotation.y) * speed;
        player.position.z += Math.cos(player.rotation.y) * speed;
    }

    // --- JUMP & GRAVITY PHYSICS ---
    velocityY += gravity;
    player.position.y += velocityY;

    // Ground Collision
    raycaster.set(new THREE.Vector3(player.position.x, player.position.y + 5, player.position.z), new THREE.Vector3(0, -1, 0));
    const hit = raycaster.intersectObjects(terrainGroup.children);
    if (hit.length > 0) {
        const groundHeight = hit[0].point.y + 1.5; // Offset for player height
        if (player.position.y <= groundHeight) {
            player.position.y = groundHeight;
            velocityY = 0;
            canJump = true;
        } else {
            canJump = false;
        }
    }

    updateLighting();
    
    // Chunk Management
    const pX = Math.round(player.position.x / chunkSize);
    const pZ = Math.round(player.position.z / chunkSize);
    for (let x = pX - 2; x <= pX + 2; x++) {
        for (let z = pZ - 2; z <= pZ + 2; z++) createChunk(x, z);
    }

    // Camera follow (Smoothed looking)
    const camOffset = new THREE.Vector3(0, 5, 12).applyQuaternion(player.quaternion);
    camera.position.copy(player.position).add(camOffset);
    camera.lookAt(player.position.x, player.position.y + pitch * 5, player.position.z);

    renderer.render(scene, camera);
}
animate();
