const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

// Laser Global Variables
const laserOffset1 = new BABYLON.Vector3(-0.8, 0.8, -1);
const laserOffset2 = new BABYLON.Vector3(0.8, 0.8, -1);
const laserOffset3 = new BABYLON.Vector3(-0.8, -0.8, -1);
const laserOffset4 = new BABYLON.Vector3(0.8, -0.8, -1);

let laserPulseStates = [
    { isPulsing: false, pulseOriginalColor: null, pulseCurrentColor: null },
    { isPulsing: false, pulseOriginalColor: null, pulseCurrentColor: null },
    { isPulsing: false, pulseOriginalColor: null, pulseCurrentColor: null },
    { isPulsing: false, pulseOriginalColor: null, pulseCurrentColor: null }
];

let laserAngleStates = [
    { originalDirection: null, customDirection: null, isCustomActive: false },
    { originalDirection: null, customDirection: null, isCustomActive: false },
    { originalDirection: null, customDirection: null, isCustomActive: false },
    { originalDirection: null, customDirection: null, isCustomActive: false }
];

// Structure for laserEffectTimers, to be initialized properly later.
// Example: { strobeTimer: 0, strobeInterval: 0, angleChangeTimer: 0, angleChangeInterval: 0, originalColor: null, baseDirection: null }
let laserEffectTimers = [null, null, null, null]; // Will be populated by raveLasers1 setup

// Standard laser color - this should ideally be sourced from a single definition.
// For now, raveLasers1 will use this to create the Color4.
const DEFAULT_LASER_COLOR_RGB = new BABYLON.Color3(1, 0, 0); // Red

// Corresponds to the conceptual "laserpulserate1-"
async function laserPulseRate1(laserIndex, originalColor) {
    if (laserIndex === undefined || laserIndex < 0 || laserIndex >= 4) { // Assuming 4 lasers based on laserOffsets and laserLines
        console.error("laserPulseRate1: Invalid laserIndex provided:", laserIndex);
        return;
    }
    if (!originalColor || !(originalColor instanceof BABYLON.Color4)) {
        console.error("laserPulseRate1: Valid originalColor (BABYLON.Color4) not provided for laser:", laserIndex);
        return;
    }

    const state = laserPulseStates[laserIndex];
    if (state.isPulsing) {
        // console.log(`Laser ${laserIndex} is already pulsing.`);
        return; // Already pulsing, prevent re-triggering
    }

    state.isPulsing = true;
    state.pulseOriginalColor = originalColor.clone(); // Store the color to return to
    state.pulseCurrentColor = originalColor.clone();   // Start with original color visible

    const offColor = new BABYLON.Color4(0, 0, 0, 0); // Transparent black for "off"
    const pulseCount = 3;    // Number of off/on cycles in one strobe effect
    const onDuration = 70;   // Milliseconds for the "on" part of a pulse blink
    const offDuration = 70;  // Milliseconds for the "off" part of a pulse blink

    for (let i = 0; i < pulseCount; i++) {
        // Set to OFF color state
        state.pulseCurrentColor = offColor;
        // The main render loop calling updateLaserLineGeometryBabylon will use this state.
        await new Promise(resolve => setTimeout(resolve, offDuration));

        // Set to ON color state (original)
        state.pulseCurrentColor = state.pulseOriginalColor;
        await new Promise(resolve => setTimeout(resolve, onDuration));
    }

    state.isPulsing = false;
    // After pulsing, updateLaserLineGeometryBabylon will naturally use its default color logic
    // for this laser, as state.isPulsing is now false.
}

// Corresponds to the conceptual "laseranglechange-1"
function laserAngleChange1(laserIndex, baseDirection) {
    if (laserIndex === undefined || laserIndex < 0 || laserIndex >= 4) {
        console.error("laserAngleChange1: Invalid laserIndex provided:", laserIndex);
        return;
    }
    if (!baseDirection || !(baseDirection instanceof BABYLON.Vector3) || baseDirection.lengthSquared() === 0) {
        console.error("laserAngleChange1: Valid baseDirection (BABYLON.Vector3) not provided for laser:", laserIndex);
        return; // Needs a valid direction vector
    }

    const state = laserAngleStates[laserIndex];
    state.originalDirection = baseDirection.clone(); // Store the direction upon which this change is based

    const maxAngleChangeDegrees = 35;
    const maxAngleChangeRadians = BABYLON.Tools.ToRadians(maxAngleChangeDegrees);

    // Generate random rotation angles for yaw and pitch (around Y and X axes relative to the vector's frame)
    // This is a simplification. True yaw/pitch relative to the vector is more complex.
    // A simpler approach: create a random rotation quaternion.

    // Random axis for rotation (not perfectly uniform, but simple)
    const randomAxis = BABYLON.Vector3.Random(-1, 1).normalize();

    // Random angle within the allowed range
    const randomAngle = (Math.random() * 2 - 1) * maxAngleChangeRadians; // between -maxAngleChangeRadians and +maxAngleChangeRadians

    const rotationQuaternion = BABYLON.Quaternion.RotationAxis(randomAxis, randomAngle);

    // Apply the rotation to the originalDirection
    // The baseDirection should be the laser's current "neutral" or "intended" direction.
    // If repeatedly called, it should base the new change on the *original* camera-targeted direction,
    // not the previously randomized one, to prevent drift.
    // So, `baseDirection` should always be the non-randomized, camera-target direction.
    state.customDirection = baseDirection.clone(); // Start with the base direction
    state.customDirection.rotateByQuaternionToRef(rotationQuaternion, state.customDirection); // Rotate it
    state.customDirection.normalize(); // Ensure it's a unit vector

    state.isCustomActive = true;
    // The main laser update logic will need to check isCustomActive and use customDirection.
    // This function itself doesn't run over time; it just sets the state once per call.
}

// Corresponds to the conceptual "rave-lasers-1"
function raveLasers1(deltaTimeInSeconds, camera, worldLaserOrigins) {
    if (!camera || !worldLaserOrigins || worldLaserOrigins.length !== 4) {
        console.error("raveLasers1: Missing camera or worldLaserOrigins.");
        return;
    }

    for (let i = 0; i < 4; i++) {
        // Initialize timer state for each laser if not already done
        if (!laserEffectTimers[i]) {
            const randomStrobeInterval = Math.random() * 4 + 1; // 1 to 5 seconds
            const randomAngleInterval = Math.random() * 4 + 1; // 1 to 5 seconds
            laserEffectTimers[i] = {
                strobeTimer: randomStrobeInterval,
                strobeInterval: randomStrobeInterval,
                angleChangeTimer: randomAngleInterval,
                angleChangeInterval: randomAngleInterval,
                originalColor: new BABYLON.Color4(DEFAULT_LASER_COLOR_RGB.r, DEFAULT_LASER_COLOR_RGB.g, DEFAULT_LASER_COLOR_RGB.b, 1),
                // baseDirection will be updated each frame before angle change
            };
        }

        const timerState = laserEffectTimers[i];

        // Strobe Logic
        timerState.strobeTimer -= deltaTimeInSeconds;
        if (timerState.strobeTimer <= 0) {
            laserPulseRate1(i, timerState.originalColor); // Call the strobe effect
            timerState.strobeInterval = Math.random() * 4 + 1; // New interval: 1 to 5s
            timerState.strobeTimer = timerState.strobeInterval;
        }

        // Angle Change Logic
        timerState.angleChangeTimer -= deltaTimeInSeconds;
        if (timerState.angleChangeTimer <= 0) {
            const worldLaserOrigin = worldLaserOrigins[i];
            if (worldLaserOrigin && camera.target) {
                 // Calculate current default direction for this laser
                const baseDirection = camera.target.subtract(worldLaserOrigin).normalize();
                if (baseDirection.lengthSquared() > 0.001) {
                    laserAngleChange1(i, baseDirection); // Call the angle change effect
                } else {
                    // console.warn(`Laser ${i}: Base direction is zero vector.`);
                }
            }
            timerState.angleChangeInterval = Math.random() * 4 + 1; // New interval: 1 to 5s
            timerState.angleChangeTimer = timerState.angleChangeInterval;
        }
    }
}

let laserLines = [];

const MAX_LASER_LENGTH = 20;
const MAX_BOUNCES = 3;
let interactiveMeshes = [];

let consoleLogSpamStopper = 0; // To prevent flooding console

function updateLaserLineGeometryBabylon(laserLineMesh, origin, direction, interactiveMeshesArr, maxBounces, maxLaserLength, scene, laserIndex) {
    const points = [];
    let currentOrigin = origin.clone();
    let currentDirection = direction.clone().normalize();

    points.push(currentOrigin.clone());

    for (let bounce = 0; bounce < maxBounces; bounce++) {
        const ray = new BABYLON.Ray(currentOrigin, currentDirection, maxLaserLength);

        const pickInfo = scene.pickWithRay(ray, (mesh) => {
            return interactiveMeshesArr.includes(mesh) && mesh.isPickable && mesh.isEnabled();
        });

        if (pickInfo && pickInfo.hit && pickInfo.pickedMesh) {
            const impactPoint = pickInfo.pickedPoint;
            points.push(impactPoint.clone());

            const surfaceNormal = pickInfo.getNormal(true);
            if (!surfaceNormal) {
                if (consoleLogSpamStopper < 50) { // Limit console spam
                   // console.warn(`Laser ${laserIndex}: Hit mesh ${pickInfo.pickedMesh.name} but no normal found at bounce ${bounce}.`);
                }
                points.push(currentOrigin.add(currentDirection.scale(maxLaserLength)));
                break;
            }

            if (BABYLON.Vector3.Dot(currentDirection, surfaceNormal) > 0) {
                surfaceNormal.negateInPlace();
            }

            const dotProduct = BABYLON.Vector3.Dot(currentDirection, surfaceNormal);
            const reflection = currentDirection.subtract(surfaceNormal.scale(2 * dotProduct));

            currentDirection = reflection.normalize();
            currentOrigin = impactPoint.add(currentDirection.scale(0.001));

            if (bounce === maxBounces - 1) {
                points.push(currentOrigin.add(currentDirection.scale(maxLaserLength)));
            }
        } else {
            points.push(currentOrigin.add(currentDirection.scale(maxLaserLength)));
            break;
        }
    }

    if (points.length < 2) {
        points.push(origin.add(direction.scale(0.1)));
    }

    if (consoleLogSpamStopper < 20 && laserIndex === 0) { // Log points for the first laser only, limited times
        // console.log(`Laser ${laserIndex} points:`, points.map(p => `(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`).join(' -> '));
    }

    let currentLaserColor; // This will be a Color4
    const pulseState = laserPulseStates[laserIndex];

    if (pulseState && pulseState.isPulsing && pulseState.pulseCurrentColor) {
        currentLaserColor = pulseState.pulseCurrentColor;
    } else {
        // Default color, ensure DEFAULT_LASER_COLOR_RGB is accessible (it is global)
        currentLaserColor = new BABYLON.Color4(DEFAULT_LASER_COLOR_RGB.r, DEFAULT_LASER_COLOR_RGB.g, DEFAULT_LASER_COLOR_RGB.b, 1);
    }
    const lineColors = [];
    for(let k = 0; k < points.length; k++){
        lineColors.push(currentLaserColor.clone()); // Use the determined Color4 object
    }

    laserLineMesh = BABYLON.MeshBuilder.CreateLines(laserLineMesh.name, {
        points: points,
        colors: lineColors,
        instance: laserLineMesh,
        updatable: true
    }, scene);
    return laserLineMesh;
}

const createScene = async function () {
    const scene = new BABYLON.Scene(engine);
    scene.useRightHandedSystem = true;
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);

    // Camera
    // Parameters: name, alpha, beta, radius, target position, scene
    const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2, 5, new BABYLON.Vector3(0, 0, 0), scene);
    // Positions the camera based on the example URL: -0.14,0.005,0.03
    // Babylon's ArcRotateCamera is defined by alpha, beta, radius, and target.
    // We'll set the position directly and then set the target.
    // camera.setPosition(new BABYLON.Vector3(-0.14, 0.005, 0.03)); // This line is removed
    camera.attachControl(canvas, true);

    // camera.target remains the same (BABYLON.Vector3.Zero() initially, then model center)
    // camera.radius will be set by existing model loading logic
    // camera.alpha and camera.beta will be set by existing model loading logic
    camera.fov = BABYLON.Tools.ToRadians(75);
    camera.minZ = 0.1;
    camera.maxZ = 1000;
    // camera.attachControl(canvas, true); // Already exists
    camera.panningSensibility = 0;
    camera.wheelPrecision = 50;
    camera.lowerRadiusLimit = 1; // Keep existing lowerRadiusLimit if it was more restrictive based on model
    camera.upperRadiusLimit = 500; // Keep existing upperRadiusLimit if it was more restrictive
    camera.angularSensibilityX = 2000;
    camera.angularSensibilityY = 2000;

    // Remove camera auto-rotation
    // camera.autoRotate = true;
    // camera.autoRotateSpeed = 0.5;

    // Remove X-axis limits
    // camera.inputs.attached.mousewheel.axis = BABYLON.Axis.X;
    // camera.inputs.attached.pointers.axis = BABYLON.Axis.X;
    // camera.lowerBetaLimit = camera.beta; // These lines are effectively removed by new settings or defaults
    // camera.upperBetaLimit = camera.beta; // These lines are effectively removed by new settings or defaults


    // Skybox REMOVED
    // const skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 1000.0 }, scene);
    // const skyboxMaterial = new BABYLON.StandardMaterial("skyBoxMaterial", scene);
    // skyboxMaterial.backFaceCulling = false;
    // skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("https://assets.babylonjs.com/environments/studio.env", scene);
    // skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    // skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
    // skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    // skybox.material = skyBoxMaterial;

    const ambientLight = new BABYLON.HemisphericLight("ambientLight", new BABYLON.Vector3(0, 1, 0), scene);
    ambientLight.intensity = 0.5;

    const directionalLight = new BABYLON.DirectionalLight("directionalLight", new BABYLON.Vector3(-1, -1, -1).normalize(), scene);
    directionalLight.position = new BABYLON.Vector3(5, 5, 5);
    directionalLight.intensity = 0.8;

    const dirLightGizmo = new BABYLON.LightGizmo(); // Requires babylon.gui.min.js
    dirLightGizmo.light = directionalLight;

    const spotLightDown = new BABYLON.SpotLight("spotLightDown", BABYLON.Vector3.Zero(), new BABYLON.Vector3(0, -1, 0), Math.PI / 8, 2, scene);
    spotLightDown.intensity = 50 * 10;
    spotLightDown.range = 1;

    const spotLightFace = new BABYLON.SpotLight("spotLightFace", BABYLON.Vector3.Zero(), BABYLON.Vector3.Zero(), Math.PI / 11.5, 0.5, scene);
    spotLightFace.intensity = 50 * 10;
    spotLightFace.range = 0.85;

    // Model Loading
    try {
        const result = await BABYLON.SceneLoader.ImportMeshAsync(null, "", "HoodedCory_NewStart_NewHood_DecimatedCreasedHood-1.glb", scene, function (evt) {
            // Optional: model loading progress
        });

        const mainMesh = result.meshes[0];
        if (mainMesh) {
            mainMesh.name = "HoodedModel"; // As per laser script
            // Existing model processing (scaling, camera targeting) should be HERE
            // For example:
            mainMesh.scaling = new BABYLON.Vector3(2, 2, 2); // Keep existing scale
            let boundingInfo = mainMesh.getHierarchyBoundingVectors();
            let modelCenter = boundingInfo.center.clone();
            camera.setTarget(modelCenter);

            // Copied and adapted existing camera radius/positioning logic
            let modelSizeVec = boundingInfo.max.subtract(boundingInfo.min);
            let modelDimensionForFraming = Math.abs(modelSizeVec.y);
            if (modelDimensionForFraming < 0.001) {
                modelDimensionForFraming = Math.max(Math.abs(modelSizeVec.x), Math.abs(modelSizeVec.z));
            }
            if (modelDimensionForFraming < 0.001) {
                modelDimensionForFraming = 0.1;
            }
            const percentageOfView = 0.75;
            let distance = (modelDimensionForFraming / (2 * percentageOfView)) / Math.tan(camera.fov / 2);
            if (isNaN(distance) || distance <= 0 || !isFinite(distance)) {
                console.warn("Camera distance calculation resulted in an invalid value, using default.");
                distance = 10;
            }
            distance *= 1.1;
            camera.radius = distance;
            // Keep alpha/beta as set by user or default, don't force front view here
            // camera.alpha = -Math.PI / 2; // Removed
            // camera.beta = Math.PI / 2;   // Removed

            // Populate interactiveMeshes (NEW)
            interactiveMeshes.push(mainMesh);
            mainMesh.isPickable = true;
            mainMesh.getChildMeshes(false).forEach(child => {
                interactiveMeshes.push(child);
                child.isPickable = true;
            });
            console.log("Interactive meshes count:", interactiveMeshes.length);

            // Parent and position new spotlights (NEW)
            spotLightDown.parent = mainMesh;
            spotLightDown.position = new BABYLON.Vector3(0, 0.5, 0);
            spotLightDown.direction = new BABYLON.Vector3(0, -1, 0);
            // const spotLightDownGizmo = new BABYLON.LightGizmo(); // Gizmos are for editor use, not essential for effect
            // spotLightDownGizmo.light = spotLightDown;
            // spotLightDownGizmo.scaleRatio = 0.5;

            spotLightFace.parent = mainMesh;
            spotLightFace.position = new BABYLON.Vector3(0, -0.6, 0.5);
            const spotLightFaceTargetPosition = new BABYLON.Vector3(0, 0.4, 0.0);
            spotLightFace.direction = spotLightFaceTargetPosition.subtract(spotLightFace.position).normalize();
            // const spotLightFaceGizmo = new BABYLON.LightGizmo();
            // spotLightFaceGizmo.light = spotLightFace;
            // spotLightFaceGizmo.scaleRatio = 0.5;

        } else {
            console.error("Model loading resulted in no meshes.");
        }
    } catch (error) {
        console.error("An error occurred loading the GLB model:", error);
    }

    const laserColor = new BABYLON.Color3(1, 0, 0); // Red
    for (let i = 0; i < 4; i++) {
        const laserLine = BABYLON.MeshBuilder.CreateLines("laser" + i, {
            points: [BABYLON.Vector3.Zero(), new BABYLON.Vector3(0.01, 0, 0)],
            updatable: true,
            colors: [laserColor.toColor4(1), laserColor.toColor4(1)]
        }, scene);
        laserLine.isPickable = false;
        laserLines.push(laserLine);
    }

    // Add a hemispheric light to ensure the model is visible
    // const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    // light.intensity = 0.7;

    // Add a DirectionalLight
    // Light source is conceptually "slightly up, to the right, and slightly forward" from the model.
    // If model is at origin, source could be (5, 5, 5).
    // Direction of light rays is from source to target (model origin). So, (0-5, 0-5, 0-5) = (-5, -5, -5).
    // const directionalLight = new BABYLON.DirectionalLight("directionalLight", new BABYLON.Vector3(-1, -1, -1).normalize(), scene);
    // directionalLight.intensity = 0.8; // Medium intensity
    // directionalLight.diffuse = new BABYLON.Color3(1, 1, 1); // White light
    // directionalLight.specular = new BABYLON.Color3(1, 1, 1); // White highlights
    // // Set a conceptual position for the light source (e.g. for shadow maps if they were used)
    // directionalLight.position = new BABYLON.Vector3(5, 5, 5);

    // return scene; // Old line
    return { scene, camera }; // New line, at the end of createScene
};

let scene; // Declare here to be accessible in render loop and resize
let camera; // Declare here

createScene().then(result => {
    scene = result.scene;
    camera = result.camera; // Capture camera here

    engine.runRenderLoop(() => {
        if (scene && scene.activeCamera) { // scene.activeCamera is 'camera'
            const deltaTimeInSeconds = engine.getDeltaTime() / 1000.0;
            const camWorldMatrix = camera.getWorldMatrix();
            const camTarget = camera.target.clone(); // Use a stable clone of camera target

            if (consoleLogSpamStopper < 5) { // Keep console spam under control
                if (interactiveMeshes.length === 0) {
                    console.warn("WARNING: `interactiveMeshes` array is EMPTY. Lasers will not collide or reflect.");
                }
                consoleLogSpamStopper++;
            }

            const collectedWorldLaserOrigins = [];
            const collectedFinalLaserDirections = [];
            const laserOffsets = [laserOffset1, laserOffset2, laserOffset3, laserOffset4];

            // First pass: Calculate all laser origins and their intended/custom directions
            for (let i = 0; i < laserLines.length; i++) {
                const localOffset = laserOffsets[i];
                const worldLaserOrigin = BABYLON.Vector3.TransformCoordinates(localOffset, camWorldMatrix);
                collectedWorldLaserOrigins.push(worldLaserOrigin);

                let finalLaserDirection;
                // Calculate default direction towards camera target
                const defaultDirection = camTarget.subtract(worldLaserOrigin).normalize();

                // Check if a custom angle is active for this laser
                if (laserAngleStates[i] && laserAngleStates[i].isCustomActive && laserAngleStates[i].customDirection && laserAngleStates[i].customDirection.lengthSquared() > 0.001) {
                    finalLaserDirection = laserAngleStates[i].customDirection; // This should be a normalized vector
                } else {
                    finalLaserDirection = defaultDirection;
                }

                collectedFinalLaserDirections.push(finalLaserDirection);
            }

            // Call raveLasers1 to update laser effect states (strobing, new angle decisions)
            // It uses collectedWorldLaserOrigins to calculate base directions for any new angle changes.
            if (collectedWorldLaserOrigins.length === 4) {
                raveLasers1(deltaTimeInSeconds, camera, collectedWorldLaserOrigins);
            }

            // Second pass: Update all laser line geometries based on calculated states
            for (let i = 0; i < laserLines.length; i++) {
                if (!laserLines[i]) continue;

                const worldLaserOrigin = collectedWorldLaserOrigins[i];
                const finalLaserDirection = collectedFinalLaserDirections[i];

                // Ensure origin and a valid direction exist before updating
                if (worldLaserOrigin && finalLaserDirection && finalLaserDirection.lengthSquared() > 0.001) {
                    if (interactiveMeshes.length > 0) {
                        laserLines[i] = updateLaserLineGeometryBabylon(laserLines[i], worldLaserOrigin, finalLaserDirection, interactiveMeshes, MAX_BOUNCES, MAX_LASER_LENGTH, scene, i);
                    } else {
                        // No reflection: Draw a simple line, but respect pulsing state for color
                        const points = [worldLaserOrigin.clone(), worldLaserOrigin.add(finalLaserDirection.scale(MAX_LASER_LENGTH))];

                        let noHitLaserColor;
                        const pulseState = laserPulseStates[i];
                        if (pulseState && pulseState.isPulsing && pulseState.pulseCurrentColor) {
                            noHitLaserColor = pulseState.pulseCurrentColor; // Use pulsing color if active
                        } else {
                            noHitLaserColor = new BABYLON.Color4(0, 1, 0, 1); // Default green for no-hit
                        }
                        const lineColors = [noHitLaserColor.clone(), noHitLaserColor.clone()];
                        laserLines[i] = BABYLON.MeshBuilder.CreateLines(laserLines[i].name, {points: points, colors: lineColors, instance: laserLines[i], updatable: true}, scene);
                    }
                } else if (laserLines[i] && worldLaserOrigin) {
                    // If direction is invalid (e.g. zero vector), make the laser effectively invisible (zero length)
                     let colorForZeroLengthLine;
                     const pulseState = laserPulseStates[i];
                     if (pulseState && pulseState.isPulsing && pulseState.pulseCurrentColor) {
                        colorForZeroLengthLine = pulseState.pulseCurrentColor;
                     } else {
                        colorForZeroLengthLine = new BABYLON.Color4(DEFAULT_LASER_COLOR_RGB.r, DEFAULT_LASER_COLOR_RGB.g, DEFAULT_LASER_COLOR_RGB.b, 1);
                     }
                     const zeroLengthPoints = [worldLaserOrigin.clone(), worldLaserOrigin.clone()];
                     const zeroLengthColors = [colorForZeroLengthLine.clone(),colorForZeroLengthLine.clone()];
                    laserLines[i] = BABYLON.MeshBuilder.CreateLines(laserLines[i].name, {points: zeroLengthPoints, colors: zeroLengthColors, instance: laserLines[i], updatable: true}, scene);
                }
            }
            scene.render();
        }
    });
});

// Old render loop removed as the new one is inside createScene().then(...)
// engine.runRenderLoop(function () {
//     scene.render();
// });

window.addEventListener("resize", function () {
    engine.resize();
});
