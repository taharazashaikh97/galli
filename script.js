const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.FogExp2(0x87ceeb, 0.01);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(50, 100, 50);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040, 0.7));

// --- CONFIGURATION ---
const chunkSize = 100;      // Size of one terrain square
const renderDistance = 3;   // How many chunks to show around player
const chunks = new Map();   // To store loaded chunks
const terrainGroup = new THREE.Group();
scene.add(terrainGroup);

// Consistent Height Logic
const getHeight = (x, z) => {
    // Using sine waves for procedural hills
    return Math.sin(x * 0.04) * Math.cos(z * 0.04) * 8 + Math.sin(x * 0.1) * 2;
};

// --- CHUNK GENERATOR ---
function createChunk(x, z) {
    const key = `${x},${z}`;
    if (chunks.has(key)) return;

    const geo = new THREE.PlaneGeometry(chunkSize, chunkSize, 20, 20);
    const v = geo.attributes.position.array;
    for (let i = 0; i < v.length; i += 3) {
        // Calculate world-space coordinates
        const worldX = v[i] + (x * chunkSize);
        const worldZ = v[i + 1] - (z * chunkSize);
        v[i + 2] = getHeight(worldX, -worldZ);
    }
    geo.computeVertexNormals();
    
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x348C31, flatShading: true }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x * chunkSize, 0, z * chunkSize);
    
    // Add road if chunk is in the center (X=0)
    if (x === 0) {
        const road = new THREE.Mesh(
            new THREE.PlaneGeometry(12, chunkSize, 1, 10),
            new THREE.MeshLambertMaterial({ color: 0x333333 })
        );
        road.position.z = 0.1; // elevation
        mesh.add(road);
    }

    // Add random trees
    for(let i=0; i<5; i++) {
        const tx = (Math.random() - 0.5) * chunkSize;
        const tz = (Math.random() - 0.5) * chunkSize;
        if (Math.abs(tx + (x * chunkSize)) > 10) {
            const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3, 0.5), new THREE.MeshLambertMaterial({color: 0x4b3621}));
            trunk.position.set(tx, tz, getHeight(tx + (x * chunkSize), -(tz + (z * chunkSize))) + 1.5);
            trunk.rotation.x = Math.PI / 2;
            mesh.add(trunk);
        }
    }

    terrainGroup.add(mesh);
    chunks.set(key, mesh);
}

function updateChunks() {
    const playerChunkX = Math.round(player.position.x / chunkSize);
    const playerChunkZ = Math.round(player.position.z / chunkSize);

    for (let x = playerChunkX - renderDistance; x <= playerChunkX + renderDistance; x++) {
        for (let z = playerChunkZ - renderDistance; z <= playerChunkZ + renderDistance; z++) {
            createChunk(x, z);
        }
    }
    
    // Optional: Cleanup distant chunks to save memory
    chunks.forEach((mesh, key) => {
        const [cx, cz] = key.split(',').map(Number);
        if (Math.abs(cx - playerChunkX) > renderDistance + 1 || Math.abs(cz - playerChunkZ) > renderDistance + 1) {
            terrainGroup.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
            chunks.delete(key);
        }
    });
}

// --- PLAYER & CONTROLS ---
const player = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshLambertMaterial({ color: 0xe63946 }));
player.position.y = 10;
scene.add(player);

const keys = { w: false, a: false, s: false, d: false };
window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

const raycaster = new THREE.Raycaster();

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

    updateChunks();

    // Stick to ground
    raycaster.set(new THREE.Vector3(player.position.x, 100, player.position.z), new THREE.Vector3(0, -1, 0));
    const intersect = raycaster.intersectObjects(terrainGroup.children);
    if (intersect.length > 0) player.position.y = intersect[0].point.y + 1;

    const camOffset = new THREE.Vector3(0, 10, 20).applyQuaternion(player.quaternion);
    camera.position.copy(player.position).add(camOffset);
    camera.lookAt(player.position);

    renderer.render(scene, camera);
}
animate();
