import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FlyControls } from 'three/addons/controls/FlyControls.js';
// Bloom imports removed

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
    timeScale: 0, // Start with 0 speed as slider default is 0
    simulationTime: 0,
    isPaused: false
};

// --- SCENE OBJECTS ---
let galaxyPlaneMesh = null;
let sunSprite = null;
const sunRadius = Math.sqrt(SUN_POSITION.x ** 2 + SUN_POSITION.z ** 2);
const sunInitialAngle = Math.atan2(SUN_POSITION.z, SUN_POSITION.x);

// --- Basic Scene Setup ---
const scene = new THREE.Scene();
const loaderContainer = document.getElementById('loader-container');
const loaderText = document.getElementById('loader-text');

// MODIFICATION 1: Set a more reasonable 'near' value to fix depth precision
// MODIFICATION 1: Set a more reasonable 'near' value to fix depth precision
// We use a tiny near plane to allow approaching 1 solar radius stars. 
// 1 Solar Radius ~ 10^-8, so we need 10^-9 near plane.
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1e-9, 100000);
camera.position.set(0, 25000, 0); // Default to a top-down view
camera.lookAt(0, 0, 0); // Ensure it looks at the center

const renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector('#bg'),
    antialias: true,
    logarithmicDepthBuffer: true // Essential for handling range from 1e-9 to 1e5
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Bloom pass and composer removed. We will use the renderer directly.

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// MODIFICATION 2: Match minDistance to the camera's near plane
controls.minDistance = 1e-9;
controls.maxDistance = 50000;

controls.panSpeed = 2.0;
controls.rotateSpeed = 2.0;
controls.rotateSpeed = 2.0;
controls.zoomSpeed = 2.0;

const flyControls = new FlyControls(camera, renderer.domElement);
flyControls.movementSpeed = 1000; // Default speed
flyControls.domElement = renderer.domElement;
flyControls.rollSpeed = Math.PI / 24;
flyControls.autoForward = false;
flyControls.dragToLook = true;
flyControls.enabled = false; // Initially disabled

// State to track current control mode
let isFlyMode = false;

function toggleControls(enableFly) {
    isFlyMode = enableFly;
    if (isFlyMode) {
        controls.enabled = false;
        flyControls.enabled = true;
        // Show Fly UI / Hide Orbit UI if needed
        document.querySelector('.explore-controls').style.display = 'flex';
    } else {
        controls.enabled = true;
        flyControls.enabled = false;
        // Reset camera or keep it? Let's keep it where it is.
        document.querySelector('.explore-controls').style.display = 'none';
        controls.target.set(0, 0, 0); // Optional: re-center target to origin or project forward
    }
}

// Expose toggle globally so buttons can call it
window.toggleControls = toggleControls;


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
    const exploreModeButton = document.getElementById('explore-mode-button');
    const pauseCheckbox = document.getElementById('pause-checkbox');

    // Initialize timeScale based on initial slider value
    animationState.timeScale = logSlider(parseFloat(speedSlider.value));

    speedSlider.addEventListener('input', (event) => {
        const sliderPosition = parseFloat(event.target.value);
        animationState.timeScale = logSlider(sliderPosition);
        // Removed direct uniform update here, handled in animate loop via simulationTime
    });

    pauseCheckbox.addEventListener('change', (event) => {
        animationState.isPaused = event.target.checked;
    });

    densitySlider.addEventListener('input', (event) => {
        if (!starState.fullStarData) return;
        const percentage = parseFloat(event.target.value) / 100;
        starState.maxStarsForLOD = Math.floor(starState.fullStarData.length * percentage);

        event.target.closest('div').style.display = 'none'; // Hide the density slider container
        // Density slider logic disabled as per previous request (removed LOD)
        // starState.maxStarsForLOD = Math.floor(starState.fullStarData.length * percentage);
        // starState.lastStarCount = -1;
        // updateStarLOD();
    });

    // Initialize Size Scale Slider
    const sizeScaleSlider = document.getElementById('size-scale-slider');
    const sizeScaleDisplay = document.getElementById('size-scale-display');

    // Use logarithmic slider for such a huge range (1 to 100,000,000)
    // We map slider 0-100 to log scale 1-10^8
    const minScaleLog = Math.log10(1);
    const maxScaleLog = Math.log10(100000000); // 10^8

    function setScaleFromSlider(val) {
        // Map 1-100000000 directly linear for now if the user used the HTML attributes directly
        // But the HTML input min/max I set to 1-100M. Linear is hard to control.
        // Let's assume the user drags it.
        const scale = parseFloat(val);

        if (starState.starPoints) {
            starState.starPoints.material.uniforms.u_size_scale.value = scale;
        }
        sizeScaleDisplay.innerText = `Multiplier: ${scale.toLocaleString()}x`;
    }

    sizeScaleSlider.addEventListener('input', (event) => {
        setScaleFromSlider(event.target.value);
    });

    opacitySlider.addEventListener('input', (event) => {
        if (galaxyPlaneMesh && galaxyPlaneMesh.material) {
            galaxyPlaneMesh.material.opacity = parseFloat(event.target.value);
        }
    });

    resetViewButton.addEventListener('click', () => {
        resetCameraView();
        if (isFlyMode) {
            toggleControls(false);
            exploreModeButton.innerText = "Explore Mode";
            exploreModeButton.style.backgroundColor = "#007bff";
        }
    });

    exploreModeButton.addEventListener('click', () => {
        toggleControls(!isFlyMode);
        if (isFlyMode) {
            exploreModeButton.innerText = "Exit Explore Mode";
            exploreModeButton.style.backgroundColor = "#dc3545"; // Red

            // Trigger an initial update of the speed display
            const flySpeedSlider = document.getElementById('fly-speed-slider');
            if (flySpeedSlider) {
                flySpeedSlider.dispatchEvent(new Event('input'));
            }

        } else {
            exploreModeButton.innerText = "Explore Mode";
            exploreModeButton.style.backgroundColor = "#007bff"; // Blue
        }
    });

    const flySpeedSlider = document.getElementById('fly-speed-slider');
    const flySpeedDisplay = document.getElementById('fly-speed-display');

    if (flySpeedSlider && flySpeedDisplay) {
        flySpeedSlider.addEventListener('input', (event) => {
            // Logarithmic scale for better control? Or linear?
            // User asked for "slider for the speed of movement".
            // Let's use a linear scale for simplicity, scaled up.
            // Map 0-100 to some reasonable range e.g. 0 to 5000 units/s
            // OR lets map it to a larger range since galaxy is huge.
            // 8200 units = 8200 pc.
            // Let's say max speed 10000 pc/s?

            const position = parseFloat(event.target.value);

            // Exponential curve for better control at low speeds
            // Slider 0-100 mapped to normalized 0-1
            const t = position / 100;
            // Curve: Speed = MaxSpeed * t^4 
            // Max speed ~10000 pc/s
            // At 1% (t=0.01): 10000 * 1e-8 = 0.0001 pc/s (Very slow)
            // At 10% (t=0.1): 10000 * 0.0001 = 1 pc/s
            // At 50% (t=0.5): 10000 * 0.0625 = 625 pc/s

            const maxSpeed = 10000;
            const speed = maxSpeed * Math.pow(t, 4);

            // Don't let it be exactly 0 unless slider is 0, to avoid getting stuck
            flyControls.movementSpeed = (position > 0 && speed < 0.0000001) ? 0.0000001 : speed;

            // 1 unit = 1 parsec
            let speedText = "";
            if (speed < 0.01) {
                // 1 Parsec = 206265 AU
                speedText = `${(speed * 206265).toFixed(1)} AU/s`;
            } else {
                speedText = `${speed.toFixed(3)} pc/s`;
            }
            flySpeedDisplay.innerText = `Speed: ${speedText}`;
        });

        // Initialize
        flySpeedSlider.dispatchEvent(new Event('input'));
    }
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

    // Draw a sharp circle for the "Star" look
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = canvas.width / 2 - 2; // Leave a small margin

    context.beginPath();
    context.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
    context.fillStyle = 'white'; // Color controlled by material
    context.fill();

    // Optional: Add a slight anti-aliased edge or simple glow if desired, 
    // but user asked for "star" vs "halo", implying sharpness.
    // Let's keep it simple and sharp.

    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.SpriteMaterial({
        map: texture,
        color: 0x00ff00, // Green color
        blending: THREE.NormalBlending, // Normal blending for solid look
        depthWrite: false,
        transparent: true
    });

    sunSprite = new THREE.Sprite(material);
    sunSprite.position.copy(SUN_POSITION);
    // Scale it down to look like a distinct star point, but visible. 
    // Previous was 400. Let's try something smaller but visible.
    sunSprite.scale.set(50, 50, 1.0);

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
                opacity: 0.5,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });

            galaxyPlaneMesh = new THREE.Mesh(geometry, material);

            galaxyPlaneMesh.rotation.x = -Math.PI / 2;
            galaxyPlaneMesh.rotation.z = -90 * (Math.PI / 180);

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
    { bp_rp: 0.0, color: new THREE.Color(0xaabfff) }, // B-type
    { bp_rp: 0.5, color: new THREE.Color(0xfff8f2) }, // A/F-type (white)
    { bp_rp: 0.8, color: new THREE.Color(0xfff4e8) }, // G-type (yellow-white, like the Sun)
    { bp_rp: 1.4, color: new THREE.Color(0xffddb4) }, // K-type (orange)
    { bp_rp: 2.5, color: new THREE.Color(0xffa25a) }, // M-type (red)
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

            // Calculate Absolute Magnitude (M)
            // M = m - 5 * (log10(d) - 1)
            const absMag = g_mag - 5 * (Math.log10(distance) - 1);

            allStars.push({
                x: absolute_x,
                y: absolute_y,
                z: absolute_z,
                color: getStarColorFromBpRp(bp_rp),
                absMag: absMag, // Store absolute magnitude instead of derived size
                g_mag: g_mag,
                radius: Math.sqrt(absolute_x ** 2 + absolute_z ** 2),
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
    // Replaced 'size' with 'absMag'
    geometry.setAttribute('absMag', new THREE.BufferAttribute(new Float32Array(maxStars), 1).setUsage(THREE.StaticDrawUsage));

    // --- OPTIMIZATION: Add attributes for GPU animation ---
    geometry.setAttribute('radius', new THREE.BufferAttribute(new Float32Array(maxStars), 1).setUsage(THREE.StaticDrawUsage));
    geometry.setAttribute('initialAngle', new THREE.BufferAttribute(new Float32Array(maxStars), 1).setUsage(THREE.StaticDrawUsage));
    geometry.setAttribute('angularVelocity', new THREE.BufferAttribute(new Float32Array(maxStars), 1).setUsage(THREE.StaticDrawUsage));

    const material = new THREE.ShaderMaterial({
        // --- OPTIMIZATION: Add uniforms for time and speed ---
        uniforms: {
            u_time: { value: 0.0 },
            u_time_scale: { value: 1.0 }, // Set to 1.0 because we pre-multiply execution time in CPU
            u_solar_radius_pc: { value: 2.25461e-8 }, // 1 Solar Radius in parsecs
            u_size_scale: { value: 1.0 }, // Multiplier for size
            u_viewport_height: { value: window.innerHeight }, // For perspective calc
            u_brightness_scale: { value: 120000.0 } // Scale factor for visibility
        },
        blending: THREE.NormalBlending, depthWrite: false, vertexColors: true,
        // --- OPTIMIZATION: Updated vertex shader for GPU animation ---
        vertexShader: `
            attribute float absMag;
            attribute float radius;
            attribute float initialAngle;
            attribute float angularVelocity;
            uniform float u_time;
            uniform float u_time_scale;
            uniform float u_solar_radius_pc;
            uniform float u_size_scale;
            uniform float u_viewport_height;
            uniform float u_brightness_scale;
            varying vec3 vColor;
            varying float vAlpha;
            void main() {
                vColor = color;
                float newAngle = initialAngle + angularVelocity * u_time_scale * u_time;
                vec3 newPosition = vec3(radius * cos(newAngle), position.y, radius * sin(newAngle));
                vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
                
                // Inverse Square Law Brightness
                // Luminosity proportional to 10^(-0.4 * M)
                float luminosity = pow(10.0, -0.4 * absMag);
                float dist = length(mvPosition.xyz);
                // Prevent division by zero or extreme brightness at close range
                dist = max(dist, 0.000001); 
                float brightness = (luminosity * u_brightness_scale) / (dist * dist);
                vAlpha = clamp(brightness, 0.0, 1.0);

                // Perspective Scaling
                // Size = PhysicalDiameter * (ViewportHeight / -ViewZ)
                // PhysicalDiameter = 2 * Radius * Scale
                float physicalDiameter = 2.0 * u_solar_radius_pc * u_size_scale;
                
                // Calculate perspective size
                // Note: -mvPosition.z is positive distance in view space (camera looks down -Z)
                float perspectiveSize = physicalDiameter * (u_viewport_height / -mvPosition.z);
                
                // Clamp to minimum 1.0px as requested, so they never disappear
                gl_PointSize = max(perspectiveSize, 1.0);
                
                gl_Position = projectionMatrix * mvPosition;
            }`,
        fragmentShader: `
            varying vec3 vColor;
            varying float vAlpha;
            void main() {
                vec2 uv = gl_PointCoord.xy - 0.5;
                float dist = length(uv);
                // Sharp circle with slight anti-aliasing edge
                float alphaShape = 1.0 - smoothstep(0.45, 0.5, dist); 
                if (alphaShape < 0.01) discard;
                
                // Combine shape alpha with calculated brightness alpha
                gl_FragColor = vec4(vColor, alphaShape * vAlpha);
            }`
    });

    starState.starPoints = new THREE.Points(geometry, material);
    scene.add(starState.starPoints);

    // --- Pre-populate buffers with static data ---
    // This is the key optimization. We copy all static data (color, size)
    // to the GPU buffers only ONCE at the beginning.
    const positions = starState.starPoints.geometry.attributes.position.array;
    const colors = starState.starPoints.geometry.attributes.color.array;
    const absMags = starState.starPoints.geometry.attributes.absMag.array;
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
        absMags[i] = star.absMag;
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

    // Disabled LOD optimization - Always show all stars
    const starCount = starState.fullStarData.length;

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

    // --- OPTIMIZATION: Update shader uniform on resize ---
    if (starState.starPoints) {
        starState.starPoints.material.uniforms.u_viewport_height.value = window.innerHeight;
    }

    // Bloom pass requires resize if used, but we removed it.
    // composer.setSize(window.innerWidth, window.innerHeight);
});

// --- Animation Loop ---
const clock = new THREE.Clock();
function animate() {
    const delta = clock.getDelta(); // Get time since last frame
    // We don't use clock.getElapsedTime() for rotation anymore, 
    // to allow for pausing and smooth speed changes.

    // Accumulate simulation time if not paused
    if (!animationState.isPaused) {
        animationState.simulationTime += delta * animationState.timeScale;
    }

    if (isFlyMode) {
        flyControls.update(delta);
    } else {
        controls.update();
    }

    // Update star LOD (this is now very fast, and does nothing in explore mode)
    updateStarLOD();

    // --- OPTIMIZATION: Update shader uniforms instead of CPU loop ---
    if (starState.starPoints) {
        starState.starPoints.material.uniforms.u_time.value = animationState.simulationTime;
        starState.starPoints.material.uniforms.u_time_scale.value = 1.0; // Already factored into simulationTime
    }

    const initialRotationOffset = -90 * (Math.PI / 180);

    if (galaxyPlaneMesh) {
        galaxyPlaneMesh.rotation.z = -(GALAXY_ANGULAR_VELOCITY * animationState.simulationTime) + initialRotationOffset;
    }

    if (sunSprite) {
        const newSunAngle = sunInitialAngle + GALAXY_ANGULAR_VELOCITY * animationState.simulationTime;
        const newSunX = sunRadius * Math.cos(newSunAngle);
        const newSunZ = sunRadius * Math.sin(newSunAngle);
        sunSprite.position.set(newSunX, SUN_POSITION.y, newSunZ);
    }

    renderer.render(scene, camera);
    // composer.render();
    window.requestAnimationFrame(animate);
}

animate();