// --- 1. INITIAL SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- 2. DAY/NIGHT & LIGHTING ---
const sun = new THREE.DirectionalLight(0xffffff, 1);
scene.add(sun);
const ambient = new THREE.AmbientLight(0x404040, 0.5);
scene.add(ambient);

let time = Math.PI; // Start at dusk
const daySpeed = 0.002;

function updateLighting() {
    time += daySpeed;
    const sunX = Math.cos(time) * 200;
    const sunY = Math.sin(time) * 200;
    sun.position.set(sunX, sunY, 50);

    const isDay = sunY > 0;
    const dayColor = new THREE.Color(0x87ceeb);
    const nightColor = new THREE.Color(0x050510); // Darker night
    
    const lerpFactor = THREE.MathUtils.clamp((sunY + 20) / 100, 0, 1);
    const currentColor = new THREE.Color().lerpColors(nightColor, dayColor, lerpFactor);
    
    scene.background = currentColor;
    scene.fog = new THREE.FogExp2(currentColor, 0.015);
    sun.intensity = Math.max(0, lerpFactor);
    ambient.intensity = Math.max(0.05, lerpFactor * 0.5);
}

// --- 3. CLOUDS & TERRAIN ---
const cloudGroup = new THREE.Group();
scene.add(cloudGroup);
const terrainGroup = new THREE.Group();
scene.add(terrainGroup);

const chunkSize = 100;
const renderDistance = 3;
const chunks = new Map();
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
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x348C31, flatShading: true }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x * chunkSize, 0, z * chunkSize);
    terrainGroup.add(mesh);
    chunks.set(key, mesh);
}

// --- 4. PLAYER & FLASHLIGHT ---
const player = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshLambertMaterial({ color: 0xe63946 }));
scene.add(player);

// Create the Flashlight
const flashlight = new THREE.SpotLight(0xfff9d4, 2, 40, Math.PI / 6, 0.5);
flashlight.position.set(0, 0.5, -0.5); // Position relative to player's "eyes"
flashlight.target.position.set(0, 0.5, -10); // Points forward
player.add(flashlight); // Attach to player
player.add(flashlight.target); // Attach target so it moves with player
flashlight.visible = false; // Start with light off

// --- 5. CONTROLS ---
const keys = { w: false, a: false, s: false, d: false };
window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'f') flashlight.visible = !flashlight.visible;
    keys[e.key.toLowerCase()] = true;
});
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

const raycaster = new THREE.Raycaster();

// --- 6. ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);

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
    
    // Terrain height check
    raycaster.set(new THREE.Vector3(player.position.x, 100, player.position.z), new THREE.Vector3(0, -1, 0));
    const hit = raycaster.intersectObjects(terrainGroup.children);
    if (hit.length > 0) player.position.y = hit[0].point.y + 1;

    // Manage Chunks
    const pX = Math.round(player.position.x / chunkSize);
    const pZ = Math.round(player.position.z / chunkSize);
    for (let x = pX - renderDistance; x <= pX + renderDistance; x++) {
        for (let z = pZ - renderDistance; z <= pZ + renderDistance; z++) createChunk(x, z);
    }

    // Camera follow
    const camOffset = new THREE.Vector3(0, 8, 15).applyQuaternion(player.quaternion);
    camera.position.copy(player.position).add(camOffset);
    camera.lookAt(player.position);

    renderer.render(scene, camera);
}
animate();
