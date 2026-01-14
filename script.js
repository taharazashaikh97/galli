// --- 1. INITIAL SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.FogExp2(0x87ceeb, 0.015);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(50, 100, 50);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040, 0.7));

// --- 2. TERRAIN & ROAD ---
const worldSize = 500;
const segments = 100;
const terrainGeo = new THREE.PlaneGeometry(worldSize, worldSize, segments, segments);

// Height function for consistency between terrain and road
const getHeight = (x, y) => {
    return Math.sin(x * 0.04) * Math.cos(y * 0.04) * 7 + Math.sin(x * 0.1) * 2;
};

const vertices = terrainGeo.attributes.position.array;
for (let i = 0; i < vertices.length; i += 3) {
    vertices[i + 2] = getHeight(vertices[i], vertices[i + 1]);
}
terrainGeo.computeVertexNormals();

const terrain = new THREE.Mesh(
    terrainGeo, 
    new THREE.MeshLambertMaterial({ color: 0x348C31, flatShading: true })
);
terrain.rotation.x = -Math.PI / 2;
scene.add(terrain);

// Road following the terrain height
const roadGeo = new THREE.PlaneGeometry(12, worldSize, 1, segments);
const roadV = roadGeo.attributes.position.array;
for (let i = 0; i < roadV.length; i += 3) {
    roadV[i + 2] = getHeight(0, roadV[i + 1]) + 0.1; // Stay on X=0 line
}
const road = new THREE.Mesh(roadGeo, new THREE.MeshLambertMaterial({ color: 0x444444 }));
road.rotation.x = -Math.PI / 2;
scene.add(road);

// --- 3. OBJECTS (Trees) ---
function addTree(x, z) {
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3, 0.5), new THREE.MeshLambertMaterial({color: 0x4b3621}));
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(2, 5, 8), new THREE.MeshLambertMaterial({color: 0x134d13}));
    leaves.position.y = 3;
    const tree = new THREE.Group();
    tree.add(trunk, leaves);
    
    // Position tree on the ground
    tree.position.set(x, getHeight(x, -z), z); 
    scene.add(tree);
}

for(let i = 0; i < 100; i++) {
    const rx = (Math.random() - 0.5) * 400;
    const rz = (Math.random() - 0.5) * 400;
    if (Math.abs(rx) > 10) addTree(rx, rz);
}

// --- 4. PLAYER & INTERACTION ---
const player = new THREE.Mesh(
    new THREE.BoxGeometry(1, 2, 1), 
    new THREE.MeshLambertMaterial({ color: 0xe63946 })
);
scene.add(player);

const keys = { w: false, a: false, s: false, d: false };
window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

const raycaster = new THREE.Raycaster();
const downVector = new THREE.Vector3(0, -1, 0);

// --- 5. ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);

    if (keys.w) {
        player.position.x -= Math.sin(player.rotation.y) * 0.4;
        player.position.z -= Math.cos(player.rotation.y) * 0.4;
    }
    if (keys.s) {
        player.position.x += Math.sin(player.rotation.y) * 0.4;
        player.position.z += Math.cos(player.rotation.y) * 0.4;
    }
    if (keys.a) player.rotation.y += 0.05;
    if (keys.d) player.rotation.y -= 0.05;

    // Raycast to find floor height
    raycaster.set(new THREE.Vector3(player.position.x, 100, player.position.z), downVector);
    const intersect = raycaster.intersectObject(terrain);
    if (intersect.length > 0) player.position.y = intersect[0].point.y + 1;

    // Third-person Camera
    const camOffset = new THREE.Vector3(0, 10, 20).applyQuaternion(player.quaternion);
    camera.position.copy(player.position).add(camOffset);
    camera.lookAt(player.position);

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
