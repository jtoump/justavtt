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
      model: null // Generated dynamically based on base size
    };

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
        currentHeight + this.boxSize / 2,
        worldPos.z
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }

    mesh.userData.gridX = gridX;
    mesh.userData.gridZ = gridZ;
    mesh.userData.stackLevel = currentHeight;
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

    group.position.set(worldPos.x, currentHeight, worldPos.z);
    group.userData.modelHeight = height;
    group.userData.baseRadius = radius;
    group.userData.isModel = true;

    return group;
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
   * @param {string} shape - Shape type ('box', 'cylinder', 'sphere')
   * @param {number} color - Hex color value
   * @returns {THREE.Mesh} The created mesh
   */
  addBoxWithState(gridX, gridZ, shape, color) {
    const currentHeight = this.getStackHeight(gridX, gridZ);
    const worldPos = this.grid.gridToWorld(gridX, gridZ);

    const material = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.7,
      metalness: 0.1
    });

    const geometry = this.geometries[shape] || this.geometries.box;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      worldPos.x,
      currentHeight + this.boxSize / 2,
      worldPos.z
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    mesh.userData.gridX = gridX;
    mesh.userData.gridZ = gridZ;
    mesh.userData.stackLevel = currentHeight;
    mesh.userData.shape = shape;

    this.scene.add(mesh);
    this.objects.push(mesh);
    this.setStackHeight(gridX, gridZ, currentHeight + this.boxSize);

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
        worldY: stackHeight,
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
          worldY: stackHeight,
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

    // Position based on object type
    if (object.userData.isModel) {
      // Models sit directly on the surface
      object.position.set(worldPos.x, newHeight, worldPos.z);
    } else {
      // Regular shapes are centered vertically
      object.position.set(worldPos.x, newHeight + this.boxSize / 2, worldPos.z);
    }

    object.userData.gridX = gridX;
    object.userData.gridZ = gridZ;
    object.userData.stackLevel = newHeight;

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
