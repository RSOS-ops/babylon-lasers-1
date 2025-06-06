const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);

const createScene = function () {
    const scene = new BABYLON.Scene(engine);

    // Camera
    // Parameters: name, alpha, beta, radius, target position, scene
    const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2, 5, new BABYLON.Vector3(0, 0, 0), scene);
    // Positions the camera based on the example URL: -0.14,0.005,0.03
    // Babylon's ArcRotateCamera is defined by alpha, beta, radius, and target.
    // We'll set the position directly and then set the target.
    // camera.setPosition(new BABYLON.Vector3(-0.14, 0.005, 0.03)); // This line is removed
    camera.attachControl(canvas, true);

    // Limit camera controls to X-axis
    camera.inputs.attached.mousewheel.axis = BABYLON.Axis.X;
    camera.inputs.attached.pointers.axis = BABYLON.Axis.X;
    camera.lowerBetaLimit = camera.beta;
    camera.upperBetaLimit = camera.beta;

    // Enable auto-rotation
    camera.autoRotate = true;
    camera.autoRotateSpeed = 0.5; // Adjust speed as needed

    // Skybox
    const skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 1000.0 }, scene);
    const skyboxMaterial = new BABYLON.StandardMaterial("skyBoxMaterial", scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("https://assets.babylonjs.com/environments/studio.env", scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
    skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    skybox.material = skyboxMaterial;

    // Model Loading
    BABYLON.SceneLoader.ImportMesh("", "", "HoodedCory_NewStart_NewHood_DecimatedCreasedHood-1.glb", scene, function (meshes) {
        // Optional: scale or position the loaded model if necessary
        // meshes[0].scaling = new BABYLON.Vector3(0.1, 0.1, 0.1);
        // Ensure the camera is targeting the loaded model or a point of interest.
        // If meshes exist, set camera target to the first mesh's position.
        if (meshes.length > 0) {
            let mainMesh = meshes[0];
            // Preserve existing scaling, e.g., current is (2,2,2)
            mainMesh.scaling = new BABYLON.Vector3(2, 2, 2);

            // Calculate bounding box for the entire hierarchy
            let boundingInfo = mainMesh.getHierarchyBoundingVectors();
            // It's often better to use the center of the bounding box directly
            let modelCenter = boundingInfo.center.clone(); // Use .clone() if you plan to modify it later, though not here.

            // Calculate the size of the bounding box vector
            let modelSizeVec = boundingInfo.max.subtract(boundingInfo.min);

            // Set camera target to the center of the model's hierarchy
            camera.setTarget(modelCenter);

            // Determine the model's height (for vertical FOV)
            // Use Math.abs to ensure positive height, as min/max could be "inverted" if model has unusual root transform
            let modelDimensionForFraming = Math.abs(modelSizeVec.y);

            // If height is negligible (e.g., a flat plane), use width or depth.
            if (modelDimensionForFraming < 0.001) {
                modelDimensionForFraming = Math.max(Math.abs(modelSizeVec.x), Math.abs(modelSizeVec.z));
            }
            // If all dimensions are tiny, use a fallback small value to prevent division by zero or extremely small distances
            if (modelDimensionForFraming < 0.001) {
                modelDimensionForFraming = 0.1;
            }

            // Calculate the required distance for the camera
            // camera.fov is the vertical field of view in radians. Default is 0.8 for ArcRotateCamera.
            // Formula: distance = (objectHeightForFraming / (2 * percentageOfView)) / tan(verticalFov / 2)
            const percentageOfView = 0.75; // Aim for 75% of view height
            let distance = (modelDimensionForFraming / (2 * percentageOfView)) / Math.tan(camera.fov / 2);

            // Sanity check for distance: ensure it's a positive, reasonable number.
            if (isNaN(distance) || distance <= 0 || !isFinite(distance)) {
                console.warn("Camera distance calculation resulted in an invalid value, using default.");
                distance = 10; // Fallback distance
            }
            // Add a small buffer to the distance so model is not exactly touching screen edges.
            distance *= 1.1;


            // Set camera properties for framing
            camera.radius = distance;
            // Standard front view: Alpha determines rotation around Y (up) axis. -PI/2 or 1.5*PI often means looking at Z+
            // Beta determines rotation around X (right) axis. PI/2 means looking straight, not from top/bottom.
            camera.alpha = -Math.PI / 2;
            camera.beta = Math.PI / 2;

            // Optional: Adjust camera clipping planes if models are very large or very small,
            // or if camera gets very close or very far.
            // camera.minZ = distance / 100; // Example: near clip plane relative to distance
            // camera.maxZ = distance * 100; // Example: far clip plane relative to distance

            // For debugging:
            // console.log("Model Center:", modelCenter);
            // console.log("Model Dimension for Framing (Height/Width/Depth):", modelDimensionForFraming);
            // console.log("Calculated Camera Distance (Radius):", distance);
            // console.log("Camera FOV (radians):", camera.fov);

            // Add a SpotLight
            const spotLightPosition = new BABYLON.Vector3(modelCenter.x, modelCenter.y + 5, modelCenter.z);
            const spotLightDirection = modelCenter.subtract(spotLightPosition).normalize(); // Direction from light position to model center

            const spotLight = new BABYLON.SpotLight(
                "spotLight",
                spotLightPosition,
                spotLightDirection,
                5 * Math.PI / 180, // Angle in radians
                2, // Exponent (falloff)
                scene
            );
            spotLight.intensity = 75;
            // Deep red color
            const deepRedColor = new BABYLON.Color3(0.6, 0.1, 0.1);
            spotLight.diffuse = deepRedColor;
            spotLight.specular = deepRedColor;
        }
    });

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

    return scene;
};

const scene = createScene();

engine.runRenderLoop(function () {
    scene.render();
});

window.addEventListener("resize", function () {
    engine.resize();
});
