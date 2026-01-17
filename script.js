// --- 1. INITIAL SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

// ENABLE SHADOWS: This makes light look "real" and smooth
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; 

document.body.appendChild(renderer.domElement);

// --- 2. 15-MINUTE DAY/NIGHT CYCLE ---
const dayDurationSeconds = 15 * 60; 
const daySpeed = (Math.PI * 2) / (dayDurationSeconds * 60); 
let time = 0; 

const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.castShadow = true; // Sun casts shadows
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
    
    const lerpFactor = THREE.MathUtils.clamp((sunY + 50) / 150, 0, 1);
    const currentColor = new THREE.Color().lerpColors(nightColor, dayColor, lerpFactor);
    
    scene.background = currentColor;
    scene.fog = new THREE.FogExp2(currentColor, 0.015);
    sun.intensity = lerpFactor;
    ambient.intensity = Math.max(0.02, lerpFactor * 0.4);
}

// --- 3. PLAYER, SMOOTH FLASHLIGHT & MOUSE CONTROL ---
const player = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshLambertMaterial({ color: 0xe63946 }));
player.castShadow = true; 
scene.add(player);

/** * SMOOTH FLASHLIGHT CONFIG:
 * SpotLight(color, intensity, distance, angle, penumbra, decay)
 * penumbra: 0.8 creates very soft, blurry edges.
 * decay: 2 mimics real-world physics of light fading.
 */
const flashlight = new THREE.SpotLight(0xfff9d4, 12, 80, Math.PI / 6, 0.8, 2);
flashlight.position.set(0, 0.5, 0); 
flashlight.castShadow = true;

// Improve shadow quality for the smooth look
flashlight.shadow.mapSize.width = 1024;
flashlight.shadow.mapSize.height = 1024;

const lightTarget = new THREE.Object3D();
lightTarget.position.set(0, 0.5, -10); 

player.add(flashlight);
player.add(lightTarget);
flashlight.target = lightTarget;
flashlight.visible = false;

// Mouse Look Logic
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
    const geo = new THREE.PlaneGeometry(chunkSize, chunkSize, 20, 20);
    const v = geo.attributes.position.array;
    for (let i = 0; i < v.length; i += 3) {
        v[i + 2] = getHeight(v[i] + (x * chunkSize), -(v[i + 1] - (z * chunkSize)));
    }
    geo.computeVertexNormals();
    
    // Using MeshStandardMaterial for better lighting interaction
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ 
        color: 0x348C31, 
        roughness: 0.8,
        metalness: 0.1 
    }));
    
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x * chunkSize, 0, z * chunkSize);
    mesh.receiveShadow = true; // Allow terrain to show shadows
    
    terrainGroup.add(mesh);
    chunks.set(key, mesh);
}

// --- 5. CONTROLS & ANIMATION ---
const keys = { w: false, a: false, s: false, d: false };
window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'f') flashlight.visible = !flashlight.visible;
    keys[e.key.toLowerCase()] = true;
});
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

const raycaster = new THREE.Raycaster();

function animate() {
    requestAnimationFrame(animate);

    const speed = 0.6;
    if (keys.w) {
        player.position.x -= Math.sin(player.rotation.y) * speed;
        player.position.z -= Math.cos(player.rotation.y) * speed;
    }
    if (keys.s) {
        player.position.x += Math.sin(player.rotation.y) * speed;
        player.position.z += Math.cos(player.rotation.y) * speed;
    }
    if (keys.a) {
        player.position.x -= Math.cos(player.rotation.y) * speed;
        player.position.z += Math.sin(player.rotation.y) * speed;
    }
    if (keys.d) {
        player.position.x += Math.cos(player.rotation.y) * speed;
        player.position.z -= Math.sin(player.rotation.y) * speed;
    }

    updateLighting();
    
    const pX = Math.round(player.position.x / chunkSize);
    const pZ = Math.round(player.position.z / chunkSize);
    for (let x = pX - renderDist; x <= pX + renderDist; x++) {
        for (let z = pZ - renderDist; z <= pZ + renderDist; z++) createChunk(x, z);
    }

    raycaster.set(new THREE.Vector3(player.position.x, 100, player.position.z), new THREE.Vector3(0, -1, 0));
    const hit = raycaster.intersectObjects(terrainGroup.children);
    if (hit.length > 0) player.position.y = hit[0].point.y + 1;

    const camOffset = new THREE.Vector3(0, 5, 12).applyQuaternion(player.quaternion);
    camera.position.copy(player.position).add(camOffset);
    camera.lookAt(player.position.x, player.position.y + pitch * 5, player.position.z);

    renderer.render(scene, camera);
}
animate();
