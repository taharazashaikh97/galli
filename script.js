// --- 1. INITIAL SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
document.body.appendChild(renderer.domElement);

// FOG REMOVED: scene.fog is no longer defined here.

// --- 2. CELESTIAL OBJECTS (Sun & Moon) ---
const celestialGroup = new THREE.Group();
scene.add(celestialGroup);

// The Sun
const sunGeo = new THREE.SphereGeometry(10, 32, 32);
const sunMat = new THREE.MeshBasicMaterial({ color: 0xffdf00 });
const sunDisk = new THREE.Mesh(sunGeo, sunMat);
celestialGroup.add(sunDisk);

const sunLight = new THREE.DirectionalLight(0xffffff, 1);
sunLight.castShadow = true;
sunDisk.add(sunLight); // Light moves with the sun disk

// The Moon
const moonGeo = new THREE.SphereGeometry(6, 32, 32);
const moonMat = new THREE.MeshBasicMaterial({ color: 0xdddddd });
const moonDisk = new THREE.Mesh(moonGeo, moonMat);
celestialGroup.add(moonDisk);

const moonLight = new THREE.PointLight(0x4444ff, 0.5, 500);
moonDisk.add(moonLight); // Dim blue light for the moon

// --- 3. 15-MINUTE CYCLE LOGIC ---
const dayDurationSeconds = 15 * 60; 
const daySpeed = (Math.PI * 2) / (dayDurationSeconds * 60); 
let time = 0; 
const orbitRadius = 800; // Far away so they stay in the sky

function updateLighting() {
    time += daySpeed;
    
    // Position Sun
    sunDisk.position.set(
        Math.cos(time) * orbitRadius,
        Math.sin(time) * orbitRadius,
        0
    );

    // Position Moon (Opposite to Sun)
    moonDisk.position.set(
        Math.cos(time + Math.PI) * orbitRadius,
        Math.sin(time + Math.PI) * orbitRadius,
        0
    );

    const sunY = sunDisk.position.y;
    const dayColor = new THREE.Color(0x87ceeb);
    const nightColor = new THREE.Color(0x020205);
    const lerpFactor = THREE.MathUtils.clamp((sunY + 100) / 300, 0, 1);
    
    scene.background = new THREE.Color().lerpColors(nightColor, dayColor, lerpFactor);
    
    sunLight.intensity = lerpFactor;
    moonLight.intensity = (1 - lerpFactor) * 0.5;

    return sunY > 0;
}

// --- 4. REMAINING LOGIC (FPS, Battery, Player, Terrain) ---
let lastTime = performance.now();
let frameCount = 0;
const fpsDisplay = document.getElementById('fps-counter');

// ... [Keep your existing Player, Terrain, and Battery code here] ...

function animate() {
    requestAnimationFrame(animate);

    // FPS Counter
    frameCount++;
    const currentTime = performance.now();
    if (currentTime >= lastTime + 1000) {
        if(fpsDisplay) fpsDisplay.innerText = `FPS: ${frameCount}`;
        frameCount = 0;
        lastTime = currentTime;
    }

    // Update Systems
    const isDay = updateLighting();
    updateBattery(isDay);
    
    // ... [Keep your movement and raycasting logic here] ...

    renderer.render(scene, camera);
}
animate();
