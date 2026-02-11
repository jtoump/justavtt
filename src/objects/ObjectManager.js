import * as THREE from 'three';

export class ObjectManager {
  constructor(scene, grid) {
    this.scene = scene;
    this.grid = grid;
    this.objects = [];
    this.stackHeights = new Map();

    this.boxSize = 1;
    this.boxColor = 0x8B4513;
    this.currentShape = 'model'; // Default to model for wargaming
    this.currentBaseSize = '32mm';

    // Base sizes in inches (1 inch = 1 grid unit)
    // Standard wargaming base sizes
    this.baseSizes = {
      '25mm': 0.984,  // ~1 inch
      '32mm': 1.26,   // ~1.25 inch
      '40mm': 1.575,  // ~1.5 inch
      '50mm': 1.968,  // ~2 inch
      '60mm': 2.362,  // ~2.5 inch
      '80mm': 3.15,   // ~3 inch
      '100mm': 3.937, // ~4 inch (large monsters)
      '120mm': 4.724, // ~5 inch (vehicles)
      '170mm': 6.693  // ~7 inch (knights/titans)
    };

    this.geometries = {
      box: new THREE.BoxGeometry(
        this.boxSize * 0.9,
        this.boxSize,
        this.boxSize * 0.9
      ),
      cylinder: new THREE.CylinderGeometry(
        this.boxSize * 0.4,
        this.boxSize * 0.4,
        this.boxSize,
        16
      ),
      sphere: new THREE.SphereGeometry(
        this.boxSize * 0.45,
        16,
        16
      ),
      // Model on base (wargaming miniature)
      model: null, // Generated dynamically based on base size
      // Light source (generated dynamically with PointLight)
      light: null
    };

    // Light source settings
    this.lightColor = 0xffffcc;
    this.lightIntensity = 2;
    this.lightDistance = 15;

    this.selectedObject = null;
    this.selectedObjects = []; // Multi-select support
    this.originalPosition = null;
    this.originalGridPos = null;
  }

  createModelGeometry(baseSize) {
    const radius = this.baseSizes[baseSize] / 2 || 0.5;
    const height = radius * 2; // Model height proportional to base

    // Create a group with base and model
    const group = new THREE.Group();

    // Base (flat cylinder)
    const baseGeometry = new THREE.CylinderGeometry(radius, radius, 0.05, 32);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.9,
      metalness: 0.1
    });
    const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
    baseMesh.position.y = 0.025;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    group.add(baseMesh);

    // Model body (simplified humanoid shape)
    const bodyGeometry = new THREE.CylinderGeometry(radius * 0.3, radius * 0.4, height * 0.6, 8);
    const bodyMesh = new THREE.Mesh(bodyGeometry);
    bodyMesh.position.y = 0.05 + height * 0.3;
    group.add(bodyMesh);

    // Head
    const headGeometry = new THREE.SphereGeometry(radius * 0.25, 8, 8);
    const headMesh = new THREE.Mesh(headGeometry);
    headMesh.position.y = 0.05 + height * 0.7;
    group.add(headMesh);

    return { group, height: height + 0.05, radius };
  }

  getStackKey(gridX, gridZ) {
    return `${gridX},${gridZ}`;
  }

  getStackHeight(gridX, gridZ) {
    const key = this.getStackKey(gridX, gridZ);
    return this.stackHeights.get(key) || 0;
  }

  setStackHeight(gridX, gridZ, height) {
    const key = this.getStackKey(gridX, gridZ);
    if (height <= 0) {
      this.stackHeights.delete(key);
    } else {
      this.stackHeights.set(key, height);
    }
  }

  addBox(gridX, gridZ) {
    const currentHeight = this.getStackHeight(gridX, gridZ);
    const worldPos = this.grid.gridToWorld(gridX, gridZ);

    let mesh;
    let objectHeight = this.boxSize;

    if (this.currentShape === 'model') {
      // Create wargaming model with base
      mesh = this.createModel(worldPos, currentHeight);
      objectHeight = mesh.userData.modelHeight || this.boxSize;
    } else if (this.currentShape === 'light') {
      // Create light source
      mesh = this.createLight(worldPos, currentHeight);
      objectHeight = mesh.userData.modelHeight || this.boxSize;
    } else {
      // Original shape creation
      const material = new THREE.MeshStandardMaterial({
        color: this.boxColor,
        roughness: 0.7,
        metalness: 0.1
      });

      const geometry = this.geometries[this.currentShape];
      mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        worldPos.x,
        (worldPos.y || 0) + currentHeight + this.boxSize / 2,
        worldPos.z
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }

    mesh.userData.gridX = gridX;
    mesh.userData.gridZ = gridZ;
    mesh.userData.stackLevel = currentHeight;
    mesh.userData.terrainHeight = worldPos.y || 0;
    mesh.userData.shape = this.currentShape;
    mesh.userData.baseSize = this.currentBaseSize;
    mesh.userData.wounds = 0;
    mesh.userData.maxWounds = 1;
    mesh.userData.label = '';

    this.scene.add(mesh);
    this.objects.push(mesh);
    this.setStackHeight(gridX, gridZ, currentHeight + objectHeight);

    return mesh;
  }

  createModel(worldPos, currentHeight) {
    const { group, height, radius } = this.createModelGeometry(this.currentBaseSize);

    // Apply color to body and head (skip base)
    group.children.forEach((child, index) => {
      if (index > 0) { // Skip base
        child.material = new THREE.MeshStandardMaterial({
          color: this.boxColor,
          roughness: 0.7,
          metalness: 0.1
        });
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    group.position.set(worldPos.x, (worldPos.y || 0) + currentHeight, worldPos.z);
    group.userData.modelHeight = height;
    group.userData.baseRadius = radius;
    group.userData.isModel = true;

    return group;
  }

  createLight(worldPos, currentHeight) {
    const group = new THREE.Group();
    const sphereRadius = 0.4;

    // Create glowing sphere for visual representation
    const sphereGeometry = new THREE.SphereGeometry(sphereRadius, 32, 16);
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color: this.lightColor,
      transparent: true,
      opacity: 0.9
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.y = sphereRadius + 0.1;
    sphere.userData.isLightSphere = true;
    group.add(sphere);

    // Create the actual point light
    const light = new THREE.PointLight(
      this.lightColor,
      this.lightIntensity,
      this.lightDistance
    );
    light.position.y = sphereRadius + 0.1;
    light.castShadow = true;
    light.shadow.mapSize.width = 512;
    light.shadow.mapSize.height = 512;
    light.userData.isTemplateLight = true;
    group.add(light);

    // Add a small ring on the ground to show position
    const ringGeometry = new THREE.RingGeometry(sphereRadius * 0.6, sphereRadius * 0.8, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: this.lightColor,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthTest: false
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    group.add(ring);

    group.position.set(worldPos.x, (worldPos.y || 0) + currentHeight, worldPos.z);
    group.userData.modelHeight = sphereRadius * 2 + 0.1;
    group.userData.isLight = true;
    group.userData.lightRef = light;
    group.userData.sphereRef = sphere;
    group.userData.ringRef = ring;
    group.userData.lightIntensity = this.lightIntensity;
    group.userData.lightDistance = this.lightDistance;
    group.userData.lightColor = this.lightColor;

    return group;
  }

  /**
   * Set light color for new lights
   * @param {number} color - Hex color
   */
  setLightColor(color) {
    this.lightColor = color;
  }

  /**
   * Update the color of an existing light object
   * @param {THREE.Group} lightObject - The light group
   * @param {number} color - Hex color
   */
  updateLightObjectColor(lightObject, color) {
    if (!lightObject?.userData?.isLight) return;

    const { lightRef, sphereRef, ringRef } = lightObject.userData;
    if (lightRef) lightRef.color.setHex(color);
    if (sphereRef?.material) sphereRef.material.color.setHex(color);
    if (ringRef?.material) ringRef.material.color.setHex(color);
    lightObject.userData.lightColor = color;
  }

  /**
   * Update the intensity of an existing light object
   * @param {THREE.Group} lightObject - The light group
   * @param {number} intensity - Light intensity
   */
  updateLightObjectIntensity(lightObject, intensity) {
    if (!lightObject?.userData?.isLight) return;

    const { lightRef } = lightObject.userData;
    if (lightRef) lightRef.intensity = intensity;
    lightObject.userData.lightIntensity = intensity;
  }

  /**
   * Update the distance (range) of an existing light object
   * @param {THREE.Group} lightObject - The light group
   * @param {number} distance - Light distance
   */
  updateLightObjectDistance(lightObject, distance) {
    if (!lightObject?.userData?.isLight) return;

    const { lightRef } = lightObject.userData;
    if (lightRef) lightRef.distance = distance;
    lightObject.userData.lightDistance = distance;
  }

  /**
   * Set default light intensity for new lights
   * @param {number} intensity - Light intensity
   */
  setLightIntensity(intensity) {
    this.lightIntensity = intensity;
  }

  /**
   * Set default light distance for new lights
   * @param {number} distance - Light distance
   */
  setLightDistance(distance) {
    this.lightDistance = distance;
  }

  setBaseSize(size) {
    if (this.baseSizes[size]) {
      this.currentBaseSize = size;
    }
  }

  getBaseSize() {
    return this.currentBaseSize;
  }

  getBaseSizes() {
    return Object.keys(this.baseSizes);
  }

  // Wound tracking
  setWounds(object, wounds) {
    object.userData.wounds = Math.max(0, wounds);
    this.updateWoundDisplay(object);
  }

  addWound(object) {
    object.userData.wounds = (object.userData.wounds || 0) + 1;
    this.updateWoundDisplay(object);
  }

  removeWound(object) {
    object.userData.wounds = Math.max(0, (object.userData.wounds || 0) - 1);
    this.updateWoundDisplay(object);
  }

  setMaxWounds(object, maxWounds) {
    object.userData.maxWounds = maxWounds;
  }

  updateWoundDisplay(object) {
    // Remove existing wound marker if any
    const existingMarker = object.children?.find(c => c.userData?.isWoundMarker);
    if (existingMarker) {
      object.remove(existingMarker);
    }

    const wounds = object.userData.wounds || 0;
    if (wounds === 0) return;

    // Create wound marker (red ring above model)
    const markerGeometry = new THREE.TorusGeometry(0.15, 0.03, 8, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.rotation.x = Math.PI / 2;
    marker.position.y = (object.userData.modelHeight || 1) + 0.3;
    marker.userData.isWoundMarker = true;

    // Stack multiple markers for multiple wounds
    for (let i = 1; i < wounds; i++) {
      const additionalMarker = marker.clone();
      additionalMarker.position.y += i * 0.15;
      object.add(additionalMarker);
    }

    object.add(marker);
  }

  // Label support
  setLabel(object, label) {
    object.userData.label = label;
    // Label rendering would be handled by a separate label system
  }

  stackOnObject(targetObject) {
    const { gridX, gridZ } = targetObject.userData;
    return this.addBox(gridX, gridZ);
  }

  /**
   * Add a box with specific state (used for deserialization)
   * @param {number} gridX - Grid X position
   * @param {number} gridZ - Grid Z position
   * @param {string} shape - Shape type ('box', 'cylinder', 'sphere', 'model', 'light')
   * @param {number} color - Hex color value
   * @param {string} baseSize - Base size for model shapes (default: '32mm')
   * @param {Object} lightState - Optional light state { intensity, distance }
   * @returns {THREE.Mesh|THREE.Group} The created object
   */
  addBoxWithState(gridX, gridZ, shape, color, baseSize = '32mm', lightState = null) {
    const currentHeight = this.getStackHeight(gridX, gridZ);
    const worldPos = this.grid.gridToWorld(gridX, gridZ);

    let mesh;
    let objectHeight = this.boxSize;

    if (shape === 'model') {
      // Create wargaming model with base (same as addBox does for models)
      const savedBaseSize = this.currentBaseSize;
      const savedColor = this.boxColor;
      this.currentBaseSize = baseSize;
      this.boxColor = color;

      mesh = this.createModel(worldPos, currentHeight);
      objectHeight = mesh.userData.modelHeight || this.boxSize;

      this.currentBaseSize = savedBaseSize;
      this.boxColor = savedColor;
    } else if (shape === 'light') {
      // Create light source with saved state
      const savedColor = this.lightColor;
      const savedIntensity = this.lightIntensity;
      const savedDistance = this.lightDistance;

      this.lightColor = color;
      if (lightState) {
        this.lightIntensity = lightState.intensity || savedIntensity;
        this.lightDistance = lightState.distance || savedDistance;
      }

      mesh = this.createLight(worldPos, currentHeight);
      objectHeight = mesh.userData.modelHeight || this.boxSize;

      this.lightColor = savedColor;
      this.lightIntensity = savedIntensity;
      this.lightDistance = savedDistance;
    } else {
      // Original shape creation for box, cylinder, sphere
      const material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.7,
        metalness: 0.1
      });

      const geometry = this.geometries[shape] || this.geometries.box;
      mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        worldPos.x,
        (worldPos.y || 0) + currentHeight + this.boxSize / 2,
        worldPos.z
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }

    mesh.userData.gridX = gridX;
    mesh.userData.gridZ = gridZ;
    mesh.userData.stackLevel = currentHeight;
    mesh.userData.terrainHeight = worldPos.y || 0;
    mesh.userData.shape = shape;
    mesh.userData.baseSize = baseSize;

    this.scene.add(mesh);
    this.objects.push(mesh);
    this.setStackHeight(gridX, gridZ, currentHeight + objectHeight);

    return mesh;
  }

  selectObject(object) {
    this.selectedObject = object;
    this.originalPosition = object.position.clone();
    this.originalGridPos = {
      x: object.userData.gridX,
      z: object.userData.gridZ
    };

    // Handle both Mesh and Group objects
    this.setEmissive(object, 0x444444);
  }

  deselectObject() {
    if (this.selectedObject) {
      // Handle both Mesh and Group objects
      this.setEmissive(this.selectedObject, 0x000000);
    }
    this.selectedObject = null;
    this.originalPosition = null;
    this.originalGridPos = null;
  }

  /**
   * Set emissive color on an object, handling both Mesh and Group
   */
  setEmissive(object, color) {
    if (object.isGroup) {
      // For Groups, set emissive on all child meshes with materials
      object.traverse((child) => {
        if (child.isMesh && child.material && child.material.emissive) {
          child.material.emissive = new THREE.Color(color);
        }
      });
    } else if (object.material && object.material.emissive) {
      object.material.emissive = new THREE.Color(color);
    }
  }

  getSnapTarget(gridHit, objectHit) {
    if (objectHit) {
      const targetObj = objectHit.object;
      const { gridX, gridZ } = targetObj.userData;
      const stackHeight = this.getStackHeight(gridX, gridZ);
      const worldPos = this.grid.gridToWorld(gridX, gridZ);

      return {
        type: 'stack',
        gridX,
        gridZ,
        worldX: worldPos.x,
        worldY: (worldPos.y || 0) + stackHeight,
        worldZ: worldPos.z,
        targetObject: targetObj
      };
    }

    if (gridHit) {
      const gridPos = this.grid.worldToGrid(gridHit.point.x, gridHit.point.z);
      if (gridPos) {
        const stackHeight = this.getStackHeight(gridPos.x, gridPos.z);
        const worldPos = this.grid.gridToWorld(gridPos.x, gridPos.z);

        return {
          type: 'grid',
          gridX: gridPos.x,
          gridZ: gridPos.z,
          worldX: worldPos.x,
          worldY: (worldPos.y || 0) + stackHeight,
          worldZ: worldPos.z
        };
      }
    }

    return null;
  }

  moveObjectTo(object, gridX, gridZ) {
    const oldGridX = object.userData.gridX;
    const oldGridZ = object.userData.gridZ;
    const oldStackLevel = object.userData.stackLevel;

    // Get the object's height (model or box)
    const objectHeight = object.userData.modelHeight || this.boxSize;

    const oldHeight = this.getStackHeight(oldGridX, oldGridZ);
    this.setStackHeight(oldGridX, oldGridZ, oldHeight - objectHeight);

    this.updateStackAbove(oldGridX, oldGridZ, oldStackLevel);

    const newHeight = this.getStackHeight(gridX, gridZ);
    const worldPos = this.grid.gridToWorld(gridX, gridZ);
    const terrainY = worldPos.y || 0;

    // Position based on object type
    if (object.userData.isModel) {
      object.position.set(worldPos.x, terrainY + newHeight, worldPos.z);
    } else {
      object.position.set(worldPos.x, terrainY + newHeight + this.boxSize / 2, worldPos.z);
    }

    object.userData.gridX = gridX;
    object.userData.gridZ = gridZ;
    object.userData.stackLevel = newHeight;
    object.userData.terrainHeight = terrainY;

    this.setStackHeight(gridX, gridZ, newHeight + objectHeight);
  }

  updateStackAbove(gridX, gridZ, removedLevel) {
    for (const obj of this.objects) {
      if (
        obj.userData.gridX === gridX &&
        obj.userData.gridZ === gridZ &&
        obj.userData.stackLevel > removedLevel
      ) {
        const objectHeight = obj.userData.modelHeight || this.boxSize;
        obj.userData.stackLevel -= objectHeight;
        obj.position.y -= objectHeight;
      }
    }
  }

  cancelMove() {
    if (this.selectedObject && this.originalPosition) {
      this.selectedObject.position.copy(this.originalPosition);
    }
    this.deselectObject();
  }

  confirmMove(snapTarget) {
    if (!this.selectedObject || !snapTarget) {
      this.cancelMove();
      return;
    }

    const isSamePosition =
      snapTarget.gridX === this.originalGridPos.x &&
      snapTarget.gridZ === this.originalGridPos.z;

    if (!isSamePosition) {
      this.moveObjectTo(
        this.selectedObject,
        snapTarget.gridX,
        snapTarget.gridZ
      );
    }

    this.deselectObject();
  }

  removeObject(object) {
    const gridX = object.userData.gridX;
    const gridZ = object.userData.gridZ;
    const stackLevel = object.userData.stackLevel;
    const objectHeight = object.userData.modelHeight || this.boxSize;

    this.scene.remove(object);

    // Dispose of geometry and materials properly for both Mesh and Group
    this.disposeObject(object);

    const index = this.objects.indexOf(object);
    if (index > -1) {
      this.objects.splice(index, 1);
    }

    const currentHeight = this.getStackHeight(gridX, gridZ);
    const isTopBox = (stackLevel + objectHeight) >= currentHeight;

    if (isTopBox) {
      this.setStackHeight(gridX, gridZ, stackLevel);
    }
  }

  /**
   * Properly dispose of an object's geometry and materials
   */
  disposeObject(object) {
    if (object.isGroup) {
      // For Groups, dispose all children
      object.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
    } else {
      // For regular Mesh
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(m => m.dispose());
        } else {
          object.material.dispose();
        }
      }
    }
  }

  getObjects() {
    return this.objects;
  }

  setBoxColor(color) {
    this.boxColor = color;
  }

  setShape(shape) {
    // Check if key exists (not truthy value, since model is null)
    if (shape in this.geometries) {
      this.currentShape = shape;
    }
  }

  getShape() {
    return this.currentShape;
  }

  clearAll() {
    for (const obj of this.objects) {
      this.scene.remove(obj);
      this.disposeObject(obj);
    }
    this.objects = [];
    this.stackHeights.clear();
    this.deselectObject();
  }
}
