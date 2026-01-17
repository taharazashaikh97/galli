// --- 1. INITIAL SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// --- 2. 15-MINUTE DAY/NIGHT CYCLE ---
const dayDurationSeconds = 15 * 60; 
const daySpeed = (Math.PI * 2) / (dayDurationSeconds * 60);
let time = 0; 

const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.castShadow = true;
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

// --- 3. PLAYER & BETTER FLASHLIGHT ---
const player = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshLambertMaterial({ color: 0xe63946 }));
player.castShadow = true;
scene.add(player);

// Flashlight setup
const flashlight = new THREE.SpotLight(0xfff9d4, 12, 100, Math.PI / 5, 0.3, 1);
flashlight.castShadow = true;
flashlight.shadow.mapSize.width = 2048; // Higher res shadows
flashlight.shadow.mapSize.height = 2048;

const lightTarget = new THREE.Object3D();
lightTarget.position.set(0, 0, -10); // Pointing forward
player.add(flashlight);
player.add(lightTarget);
flashlight.target = lightTarget;
flashlight.visible = false;

// --- 4. MOVEMENT & PHYSICS ---
let velocityY = 0;
const gravity = -0.02;
const jumpStrength = 0.5;
let canJump = false;
let pitch = 0, yaw = 0;

const keys = { w: false, a: false, s: false, d: false };
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && canJump) velocityY = jumpStrength;
    if (e.key.toLowerCase() === 'f') flashlight.visible = !flashlight.visible;
    keys[e.key.toLowerCase()] = true;
});
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

document.addEventListener('click', () => renderer.domElement.requestPointerLock());
document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === renderer.domElement) {
        yaw -= e.movementX * 0.003;
        pitch -= e.movementY * 0.003;
        pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, pitch));
        player.rotation.y = yaw;
    }
});

// --- 5. INFINITE TERRAIN ---
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
    mesh.receiveShadow = true;
    terrainGroup.add(mesh);
    chunks.set(key, mesh);
}

const raycaster = new THREE.Raycaster();

// --- 6. CORE LOOP ---
function animate() {
    requestAnimationFrame(animate);

    // FIXED MOVEMENT SYSTEM
    const moveSpeed = 0.8; // Fast movement
    const dirX = Math.sin(player.rotation.y);
    const dirZ = Math.cos(player.rotation.y);

    if (keys.w) {
        player.position.x -= dirX * moveSpeed;
        player.position.z -= dirZ * moveSpeed;
    }
    if (keys.s) {
        player.position.x += dirX * moveSpeed;
        player.position.z += dirZ * moveSpeed;
    }
    // STRAFING (A & D Fixed)
    if (keys.a) {
        player.position.x -= Math.sin(player.rotation.y + Math.PI / 2) * moveSpeed;
        player.position.z -= Math.cos(player.rotation.y + Math.PI / 2) * moveSpeed;
    }
    if (keys.d) {
        player.position.x += Math.sin(player.rotation.y + Math.PI / 2) * moveSpeed;
        player.position.z += Math.cos(player.rotation.y + Math.PI / 2) * moveSpeed;
    }

    // Gravity and Grounding
    velocityY += gravity;
    player.position.y += velocityY;

    raycaster.set(new THREE.Vector3(player.position.x, player.position.y + 10, player.position.z), new THREE.Vector3(0, -1, 0));
    const hit = raycaster.intersectObjects(terrainGroup.children);
    if (hit.length > 0) {
        const groundHeight = hit[0].point.y + 1.5;
        if (player.position.y <= groundHeight) {
            player.position.y = groundHeight;
            velocityY = 0;
            canJump = true;
        }
    }

    updateLighting();
    
    // Endless World Management
    const pX = Math.round(player.position.x / chunkSize);
    const pZ = Math.round(player.position.z / chunkSize);
    for (let x = pX - 2; x <= pX + 2; x++) {
        for (let z = pZ - 2; z <= pZ + 2; z++) createChunk(x, z);
    }

    // Third-person camera positioning
    const camOffset = new THREE.Vector3(0, 5, 12).applyQuaternion(player.quaternion);
    camera.position.copy(player.position).add(camOffset);
    camera.lookAt(player.position.x, player.position.y + pitch * 5, player.position.z);

    renderer.render(scene, camera);
}
animate();
