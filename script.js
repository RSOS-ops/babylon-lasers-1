const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

// Laser Global Variables
const laserOffset1 = new BABYLON.Vector3(-0.8, 0.8, -1);
const laserOffset2 = new BABYLON.Vector3(0.8, 0.8, -1);
const laserOffset3 = new BABYLON.Vector3(-0.8, -0.8, -1);
const laserOffset4 = new BABYLON.Vector3(0.8, -0.8, -1);

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

    const laserColor = new BABYLON.Color3(1,0,0);
    const lineColors = [];
    for(let k = 0; k < points.length; k++){
        lineColors.push(laserColor.toColor4());
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
            const camWorldMatrix = camera.getWorldMatrix();
            // Ensure camera.target is correctly updated if it's dynamic, or use the one from camera object
            const camTarget = camera.target.clone();

            if (consoleLogSpamStopper < 5) {
                if (interactiveMeshes.length === 0) {
                    console.warn("WARNING: `interactiveMeshes` array is EMPTY. Lasers will not collide. Check model loading and population of this array.");
                }
                consoleLogSpamStopper++;
            }

            const laserOffsets = [laserOffset1, laserOffset2, laserOffset3, laserOffset4];
            for (let i = 0; i < laserLines.length; i++) {
                if (!laserLines[i]) continue;

                const localOffset = laserOffsets[i];
                const worldLaserOrigin = BABYLON.Vector3.TransformCoordinates(localOffset, camWorldMatrix);
                const laserDirection = camTarget.subtract(worldLaserOrigin).normalize();

                if (worldLaserOrigin && laserDirection.lengthSquared() > 0.001 && interactiveMeshes.length > 0) {
                   laserLines[i] = updateLaserLineGeometryBabylon(laserLines[i], worldLaserOrigin, laserDirection, interactiveMeshes, MAX_BOUNCES, MAX_LASER_LENGTH, scene, i);
                } else if (interactiveMeshes.length === 0 && laserLines[i]) {
                    const points = [worldLaserOrigin.clone(), worldLaserOrigin.add(laserDirection.scale(MAX_LASER_LENGTH))];
                     const noHitLaserColor = new BABYLON.Color3(0,1,0); // Green if no model/hit
                     const lineColors = [noHitLaserColor.toColor4(), noHitLaserColor.toColor4()];
                     laserLines[i] = BABYLON.MeshBuilder.CreateLines(laserLines[i].name, {points: points, colors:lineColors, instance: laserLines[i], updatable: true}, scene);
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
