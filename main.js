import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- CONSTANTS ---
const SUN_POSITION = new THREE.Vector3(-8200, 20, 0);
const MIN_SPEED = 5e4;
const MAX_SPEED = 5e8;
const GALAXY_ANGULAR_VELOCITY = 1.5e-7; 

// --- STATE MANAGEMENT ---
const starState = {
    fullStarData: null,
    starPoints: null,
    lastStarCount: -1,
    maxStarsForLOD: 0,
};

const animationState = {
    timeScale: 5e4,
};

// --- SCENE OBJECTS ---
let galaxyPlaneMesh = null;
let sunSprite = null; 
const sunRadius = Math.sqrt(SUN_POSITION.x**2 + SUN_POSITION.z**2);
const sunInitialAngle = Math.atan2(SUN_POSITION.z, SUN_POSITION.x);

// --- Basic Scene Setup ---
const scene = new THREE.Scene();
const loaderContainer = document.getElementById('loader-container');
const loaderText = document.getElementById('loader-text');

// MODIFICATION 1: Set a more reasonable 'near' value to fix depth precision
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 50, 100000);
camera.position.set(0, 25000, 0); // Default to a top-down view
camera.lookAt(0, 0, 0); // Ensure it looks at the center

const renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector('#bg'),
    antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// MODIFICATION 2: Match minDistance to the camera's near plane
controls.minDistance = 50; 
controls.maxDistance = 50000; 

controls.panSpeed = 2.0;
controls.rotateSpeed = 2.0;
controls.zoomSpeed = 2.0;


function logSlider(position) {
    const minLog = Math.log(MIN_SPEED);
    const maxLog = Math.log(MAX_SPEED);
    const scale = (maxLog - minLog) / 100;
    return Math.exp(minLog + scale * position);
}

/**
 * Sets up event listeners for all UI controls in the control panel.
 * @returns {void}
 */
function setupControls() {
    const speedSlider = document.getElementById('speed-slider');
    const opacitySlider = document.getElementById('opacity-slider');
    const densitySlider = document.getElementById('density-slider');
    const resetViewButton = document.getElementById('reset-view-button');

    speedSlider.addEventListener('input', (event) => {
        const sliderPosition = parseFloat(event.target.value);
        animationState.timeScale = logSlider(sliderPosition);
        if (starState.starPoints && starState.starPoints.material.uniforms) starState.starPoints.material.uniforms.u_time_scale.value = animationState.timeScale;
    });

    densitySlider.addEventListener('input', (event) => {
        if (!starState.fullStarData) return;
        const percentage = parseFloat(event.target.value) / 100;
        starState.maxStarsForLOD = Math.floor(starState.fullStarData.length * percentage);
        
        starState.lastStarCount = -1; 
        updateStarLOD();
    });

    opacitySlider.addEventListener('input', (event) => {
        if (galaxyPlaneMesh && galaxyPlaneMesh.material) {
            galaxyPlaneMesh.material.opacity = parseFloat(event.target.value);
        }
    });

    resetViewButton.addEventListener('click', resetCameraView);
}

/**
 * Resets the camera to the default top-down view.
 */
function resetCameraView() {
    // Move camera to top-down position
    camera.position.set(0, 25000, 0);
    // Set the orbit controls target to the center
    controls.target.set(0, 0, 0);
}

function addSunMarker() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width / 2
    );
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(255,255,255,1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.SpriteMaterial({
        map: texture,
        color: 0x00ff00, // Green color
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true
    });
    
    sunSprite = new THREE.Sprite(material);
    sunSprite.position.copy(SUN_POSITION);
    sunSprite.scale.set(400, 400, 1.0);

    scene.add(sunSprite);
}

// --- Add a Marker for the Galactic Center ---
function addGalacticCenter() {
    const ringGeometry = new THREE.RingGeometry(250, 400, 64);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffe680, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const accretionDisk = new THREE.Mesh(ringGeometry, ringMaterial);
    accretionDisk.rotation.x = Math.PI / 2;
    accretionDisk.position.set(0, 0, 0);
    scene.add(accretionDisk);
}

// --- Add the Galaxy Map Image ---
function addGalaxyImage() {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
        'milky_way_map.jpg', 
        (texture) => {
            const planeSize = 43000;
            const geometry = new THREE.PlaneGeometry(planeSize, planeSize);
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                opacity: 0.6,
                blending: THREE.AdditiveBlending, 
                depthWrite: false 
            });

            galaxyPlaneMesh = new THREE.Mesh(geometry, material);
            
            galaxyPlaneMesh.rotation.x = -Math.PI / 2;
            galaxyPlaneMesh.rotation.z = -90 * (Math.PI/180);
            
            scene.add(galaxyPlaneMesh);
        },
        undefined, 
        (error) => {
            console.error('An error happened loading the galaxy texture.', error);
            alert('Could not load milky_way_map.jpg. Please make sure it is in the correct folder.');
        }
    );
}

// --- Coordinate Transformation Function ---
function equatorialToGalactic(x_eq, y_eq, z_eq) {
    const m = [[-0.0548755604165866, -0.8734370902348850, -0.4838350155487132], [0.4941094278751219, -0.4448296299600112, 0.7469822444972189], [-0.8676661489829874, -0.1980763734312015, 0.4559837761750669]];
    const x_gal = m[0][0] * x_eq + m[0][1] * y_eq + m[0][2] * z_eq;
    const y_gal = m[1][0] * x_eq + m[1][1] * y_eq + m[1][2] * z_eq;
    const z_gal = m[2][0] * x_eq + m[2][1] * y_eq + m[2][2] * z_eq;
    return { x: x_gal, y: z_gal, z: y_gal };
}

// --- REALISTIC STAR COLOR FUNCTION ---
// This function maps the Gaia 'bp_rp' color index to a more realistic RGB color.
// It uses a lookup table representing the black-body radiation color sequence
// for stars: from hot blue/white stars to cool red stars.
const starColorMap = [
    { bp_rp: -0.4, color: new THREE.Color(0x9bb2ff) }, // O-type (hot, blue-white)
    { bp_rp:  0.0, color: new THREE.Color(0xaabfff) }, // B-type
    { bp_rp:  0.5, color: new THREE.Color(0xfff8f2) }, // A/F-type (white)
    { bp_rp:  0.8, color: new THREE.Color(0xfff4e8) }, // G-type (yellow-white, like the Sun)
    { bp_rp:  1.4, color: new THREE.Color(0xffddb4) }, // K-type (orange)
    { bp_rp:  2.5, color: new THREE.Color(0xffa25a) }, // M-type (red)
];

function getStarColorFromBpRp(bp_rp) {
    // Find the two points in the map that the bp_rp value falls between.
    for (let i = 0; i < starColorMap.length - 1; i++) {
        const lower = starColorMap[i];
        const upper = starColorMap[i + 1];
        if (bp_rp >= lower.bp_rp && bp_rp <= upper.bp_rp) {
            // Interpolate between the two colors
            const t = (bp_rp - lower.bp_rp) / (upper.bp_rp - lower.bp_rp);
            return new THREE.Color().lerpColors(lower.color, upper.color, t);
        }
    }

    // If the value is outside our map's range, clamp to the nearest color.
    if (bp_rp < starColorMap[0].bp_rp) {
        return starColorMap[0].color;
    } else {
        return starColorMap[starColorMap.length - 1].color;
    }
}

// --- Data Loading and Processing ---
async function loadStarData() {
    try {
        const response = await fetch('stars.csv');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        
        const data = await response.text();
        loaderText.innerText = 'Processing Star Data...';

        const rows = data.trim().split('\n').slice(1);
        if (rows.length === 0) throw new Error("No data rows found in CSV file.");

        const allStars = [];
        rows.forEach((row) => {
            if (row.length < 10) return;
            const values = row.split(',');
            if (values.length < 5) return;

            const [ra, dec, parallax, g_mag, bp_rp] = values.map(parseFloat);

            if (isNaN(parallax) || parallax <= 0 || isNaN(g_mag) || isNaN(bp_rp) || isNaN(ra) || isNaN(dec)) {
                return;
            }

            const distance = 1 / (parallax / 1000); 
            const raRad = ra * (Math.PI / 180);
            const decRad = dec * (Math.PI / 180);

            const x_eq = distance * Math.cos(decRad) * Math.cos(raRad);
            const y_eq = distance * Math.cos(decRad) * Math.sin(raRad);
            const z_eq = distance * Math.sin(decRad);
            
            const gal_coords = equatorialToGalactic(x_eq, y_eq, z_eq);
            
            const absolute_x = gal_coords.x + SUN_POSITION.x;
            const absolute_y = gal_coords.y + SUN_POSITION.y;
            const absolute_z = gal_coords.z + SUN_POSITION.z;
            
            allStars.push({
                x: absolute_x,
                y: absolute_y,
                z: absolute_z,
                color: getStarColorFromBpRp(bp_rp),
                size: Math.max(0.1, (18 - g_mag) * 0.5),
                g_mag: g_mag,
                radius: Math.sqrt(absolute_x**2 + absolute_z**2),
                initialAngle: Math.atan2(absolute_z, absolute_x),
                angularVelocity: GALAXY_ANGULAR_VELOCITY,
            });
        });
        
        if (allStars.length === 0) throw new Error("No valid stars were processed.");

        // Sort stars by brightness (lower g_mag is brighter)
        allStars.sort((a, b) => a.g_mag - b.g_mag);
        
        loaderContainer.style.display = 'none';

        // Store all star data. We won't create the Float32Arrays here anymore.
        // Instead, we'll do it in createStarField and update them in the LOD function.
        starState.fullStarData = allStars;

        // Initialize the max stars for LOD with the full dataset
        starState.maxStarsForLOD = starState.fullStarData.length;

        return true; // Indicate success

    } catch (error) {
        console.error("Failed to load or process star data:", error);
        loaderText.innerText = `Error: ${error.message}`;
        return null;
    }
}

// --- Create the Star Field Object ---
/**
 * Creates the THREE.Points object for the stars and pre-populates its buffers.
 * @returns {void}
 */
function createStarField() {
    if (!starState.fullStarData) return;

    const maxStars = starState.fullStarData.length;
    const geometry = new THREE.BufferGeometry();

    // Buffers are populated once and used many times. StaticDrawUsage is the correct hint.
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxStars * 3), 3).setUsage(THREE.StaticDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(maxStars * 3), 3).setUsage(THREE.StaticDrawUsage));
    geometry.setAttribute('size', new THREE.BufferAttribute(new Float32Array(maxStars), 1).setUsage(THREE.StaticDrawUsage));

    // --- OPTIMIZATION: Add attributes for GPU animation ---
    geometry.setAttribute('radius', new THREE.BufferAttribute(new Float32Array(maxStars), 1).setUsage(THREE.StaticDrawUsage));
    geometry.setAttribute('initialAngle', new THREE.BufferAttribute(new Float32Array(maxStars), 1).setUsage(THREE.StaticDrawUsage));
    geometry.setAttribute('angularVelocity', new THREE.BufferAttribute(new Float32Array(maxStars), 1).setUsage(THREE.StaticDrawUsage));

    const material = new THREE.ShaderMaterial({
        // --- OPTIMIZATION: Add uniforms for time and speed ---
        uniforms: {
            u_time: { value: 0.0 },
            u_time_scale: { value: animationState.timeScale }
        },
        blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true,
        // --- OPTIMIZATION: Updated vertex shader for GPU animation ---
        vertexShader: `
            attribute float size;
            attribute float radius;
            attribute float initialAngle;
            attribute float angularVelocity;
            uniform float u_time;
            uniform float u_time_scale;
            varying vec3 vColor;
            void main() {
                vColor = color;
                float newAngle = initialAngle + angularVelocity * u_time_scale * u_time;
                vec3 newPosition = vec3(radius * cos(newAngle), position.y, radius * sin(newAngle));
                vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
                gl_PointSize = size * (4000.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }`,
        fragmentShader: `
            varying vec3 vColor;
            void main() { if (length(gl_PointCoord - vec2(0.5, 0.5)) > 0.475) discard;
                gl_FragColor = vec4(vColor, 1.0); }`
    });
    
    starState.starPoints = new THREE.Points(geometry, material);
    scene.add(starState.starPoints);

    // --- Pre-populate buffers with static data ---
    // This is the key optimization. We copy all static data (color, size)
    // to the GPU buffers only ONCE at the beginning.
    const positions = starState.starPoints.geometry.attributes.position.array;
    const colors = starState.starPoints.geometry.attributes.color.array;
    const sizes = starState.starPoints.geometry.attributes.size.array;
    // --- OPTIMIZATION: Get attribute arrays for GPU animation ---
    const radii = starState.starPoints.geometry.attributes.radius.array;
    const initialAngles = starState.starPoints.geometry.attributes.initialAngle.array;
    const angularVelocities = starState.starPoints.geometry.attributes.angularVelocity.array;

    for (let i = 0; i < starState.fullStarData.length; i++) {
        const star = starState.fullStarData[i];
        const i3 = i * 3;
        // We only need the initial Y position now. X and Z are calculated on the GPU.
        positions[i3] = 0; // Not used for calculation, but good to initialize
        positions[i3 + 1] = star.y;
        positions[i3 + 2] = 0; // Not used for calculation
        star.color.toArray(colors, i3);
        sizes[i] = star.size;
        radii[i] = star.radius;
        initialAngles[i] = star.initialAngle;
        angularVelocities[i] = star.angularVelocity;
    }
}

/**
 * Adjusts the number of visible stars based on camera distance from the origin.
 * @returns {void}
 */
function updateStarLOD() {
    if (!starState.starPoints || !starState.fullStarData) return;

    // Use camera distance from origin (0,0,0) for LOD, which works in both modes.
    const distance = camera.position.length();
    const maxDistance = controls.maxDistance;
    
    const starCount = Math.floor(
        THREE.MathUtils.lerp(
            starState.maxStarsForLOD, // Max stars when zoomed in (controlled by slider)
            starState.maxStarsForLOD * 0.02, // Min stars (2% of the slider-controlled max) 
            distance / maxDistance
        )
    );
    
    if (starCount === starState.lastStarCount) return;
    starState.lastStarCount = starCount;
    starState.starPoints.geometry.setDrawRange(0, starCount);
}

// --- Main execution ---
async function main() {
    setupControls(); 
    addGalacticCenter();
    addSunMarker(); 
    addGalaxyImage(); 
    const success = await loadStarData();
    if (success) {
        createStarField();
    }
}

main();

// --- Handle Window Resize ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // --- OPTIMIZATION: Update shader resolution uniform on resize ---
    if (starState.starPoints) {
        // This is a good practice if you add resolution-dependent effects later
    }
});

// --- Animation Loop ---
const clock = new THREE.Clock();
function animate() {
    const animationTime = clock.getElapsedTime();

    // Always update OrbitControls
    controls.update();

    // Update star LOD (this is now very fast, and does nothing in explore mode)
    updateStarLOD();

    // --- OPTIMIZATION: Update shader uniforms instead of CPU loop ---
    if (starState.starPoints) {
        starState.starPoints.material.uniforms.u_time.value = animationTime; // Use adjusted time for stars
        starState.starPoints.material.uniforms.u_time_scale.value = animationState.timeScale;
    }

    const initialRotationOffset = -90 * (Math.PI / 180);

    if (galaxyPlaneMesh) {
        galaxyPlaneMesh.rotation.z = -(GALAXY_ANGULAR_VELOCITY * animationState.timeScale * animationTime) + initialRotationOffset; // Use animationTime
    }

    if (sunSprite) {
        const newSunAngle = sunInitialAngle + GALAXY_ANGULAR_VELOCITY * animationState.timeScale * animationTime;
        const newSunX = sunRadius * Math.cos(newSunAngle);
        const newSunZ = sunRadius * Math.sin(newSunAngle);
        sunSprite.position.set(newSunX, SUN_POSITION.y, newSunZ);
    }

    renderer.render(scene, camera);
    window.requestAnimationFrame(animate);
}

animate();