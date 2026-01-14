// --- 1. INITIAL SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- 2. 7-MINUTE DAY/NIGHT CYCLE ---
// 7 minutes = 420 seconds. 
// At 60fps, total frames = 420 * 60 = 25,200.
// Increment per frame = (2 * Math.PI) / 25200
const daySpeed = (Math.PI * 2) / (7 * 60 * 60); 
let time = 0; 

const sun = new THREE.DirectionalLight(0xffffff, 1);
scene.add(sun);
const ambient = new THREE.AmbientLight(0x404040, 0.5);
scene.add(ambient);

function updateLighting() {
    time += daySpeed;
    
    const sunX = Math.cos(time) * 300;
    const sunY = Math.sin(time) * 300;
    sun.position.set(sunX, sunY, 50);

    const dayColor = new THREE.Color(0x87ceeb);
    const nightColor = new THREE.Color(0x020205);
    
    // Transition factor based on sun height
    const lerpFactor = THREE.MathUtils.clamp((sunY + 50) / 150, 0, 1);
    const currentColor = new THREE.Color().lerpColors(nightColor, dayColor, lerpFactor);
    
    scene.background = currentColor;
    scene.fog = new THREE.FogExp2(currentColor, 0.015);
    sun.intensity = lerpFactor;
    ambient.intensity = Math.max(0.02, lerpFactor * 0.4);
}

// --- 3. THE FIXED FLASHLIGHT ---
const player = new THREE.Mesh(
    new THREE.BoxGeometry(1, 2, 1), 
    new THREE.MeshLambertMaterial({ color: 0xe63946 })
);
scene.add(player);

// High intensity (5) to cut through the fog
const flashlight = new THREE.SpotLight(0xfff9d4, 5, 60, Math.PI / 6, 0.3, 1);
flashlight.position.set(0, 0.5, 0); 
player.add(flashlight);

// The Target is the secret: it must be added to the scene/player to work
const lightTarget = new THREE.Object3D();
lightTarget.position.set(0, 0.5, -10); 
player.add(lightTarget);
flashlight.target = lightTarget;

flashlight.visible = false;

// --- 4. INFINITE TERRAIN ---
const terrainGroup = new THREE.Group();
scene.add(terrainGroup);
const chunks = new Map();
const chunkSize = 100;
const renderDist = 3;

const getHeight = (x, z) => Math.sin(x * 0.04) * Math.cos(z * 0.04) * 8 + Math.sin(x * 0.1) * 2;

function createChunk(x, z) {
    const key = `${x},${z}`;
    if (chunks.has(key)) return;
    const geo = new THREE.PlaneGeometry(chunkSize, chunkSize, 25, 25);
    const v = geo.attributes.position.array;
    for (let i = 0; i < v.length; i += 3) {
        v[i + 2] = getHeight(v[i] + (x * chunkSize), -(v[i + 1] - (z * chunkSize)));
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x348C31, flatShading: true }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x * chunkSize, 0, z * chunkSize);
    terrainGroup.add(mesh);
    chunks.set(key, mesh);
}

// --- 5. CONTROLS ---
const keys = { w: false, a: false, s: false, d: false };
window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'f') {
        flashlight.visible = !flashlight.visible;
        console.log("Flashlight is now:", flashlight.visible);
    }
    keys[e.key.toLowerCase()] = true;
});
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

const raycaster = new THREE.Raycaster();

function animate() {
    requestAnimationFrame(animate);

    // Player Movement
    if (keys.w) {
        player.position.x -= Math.sin(player.rotation.y) * 0.6;
        player.position.z -= Math.cos(player.rotation.y) * 0.6;
    }
    if (keys.s) {
        player.position.x += Math.sin(player.rotation.y) * 0.6;
        player.position.z += Math.cos(player.rotation.y) * 0.6;
    }
    if (keys.a) player.rotation.y += 0.04;
    if (keys.d) player.rotation.y -= 0.04;

    updateLighting();
    
    // Chunking Logic
    const pX = Math.round(player.position.x / chunkSize);
    const pZ = Math.round(player.position.z / chunkSize);
    for (let x = pX - renderDist; x <= pX + renderDist; x++) {
        for (let z = pZ - renderDist; z <= pZ + renderDist; z++) createChunk(x, z);
    }

    // Ground Alignment
    raycaster.set(new THREE.Vector3(player.position.x, 100, player.position.z), new THREE.Vector3(0, -1, 0));
    const hit = raycaster.intersectObjects(terrainGroup.children);
    if (hit.length > 0) player.position.y = hit[0].point.y + 1;

    // Camera
    const camOffset = new THREE.Vector3(0, 8, 15).applyQuaternion(player.quaternion);
    camera.position.copy(player.position).add(camOffset);
    camera.lookAt(player.position);

    renderer.render(scene, camera);
}
animate();
