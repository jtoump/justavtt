import * as THREE from 'three';

export class ObjectManager {
  constructor(scene, grid) {
    this.scene = scene;
    this.grid = grid;
    this.objects = [];
    this.stackHeights = new Map();

    this.boxSize = 1;
    this.boxColor = 0x8B4513;
    this.currentShape = 'box';

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
      )
    };

    this.selectedObject = null;
    this.originalPosition = null;
    this.originalGridPos = null;
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

    const material = new THREE.MeshStandardMaterial({
      color: this.boxColor,
      roughness: 0.7,
      metalness: 0.1
    });

    const geometry = this.geometries[this.currentShape];
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
    mesh.userData.shape = this.currentShape;

    this.scene.add(mesh);
    this.objects.push(mesh);
    this.setStackHeight(gridX, gridZ, currentHeight + this.boxSize);

    return mesh;
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

    object.material.emissive = new THREE.Color(0x444444);
  }

  deselectObject() {
    if (this.selectedObject) {
      this.selectedObject.material.emissive = new THREE.Color(0x000000);
    }
    this.selectedObject = null;
    this.originalPosition = null;
    this.originalGridPos = null;
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

    const oldHeight = this.getStackHeight(oldGridX, oldGridZ);
    this.setStackHeight(oldGridX, oldGridZ, oldHeight - this.boxSize);

    this.updateStackAbove(oldGridX, oldGridZ, oldStackLevel);

    const newHeight = this.getStackHeight(gridX, gridZ);
    const worldPos = this.grid.gridToWorld(gridX, gridZ);

    object.position.set(
      worldPos.x,
      newHeight + this.boxSize / 2,
      worldPos.z
    );

    object.userData.gridX = gridX;
    object.userData.gridZ = gridZ;
    object.userData.stackLevel = newHeight;

    this.setStackHeight(gridX, gridZ, newHeight + this.boxSize);
  }

  updateStackAbove(gridX, gridZ, removedLevel) {
    for (const obj of this.objects) {
      if (
        obj.userData.gridX === gridX &&
        obj.userData.gridZ === gridZ &&
        obj.userData.stackLevel > removedLevel
      ) {
        obj.userData.stackLevel -= this.boxSize;
        obj.position.y -= this.boxSize;
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

    this.scene.remove(object);
    object.material.dispose();

    const index = this.objects.indexOf(object);
    if (index > -1) {
      this.objects.splice(index, 1);
    }

    const currentHeight = this.getStackHeight(gridX, gridZ);
    const isTopBox = (stackLevel + this.boxSize) >= currentHeight;

    if (isTopBox) {
      this.setStackHeight(gridX, gridZ, stackLevel);
    }
  }

  getObjects() {
    return this.objects;
  }

  setBoxColor(color) {
    this.boxColor = color;
  }

  setShape(shape) {
    if (this.geometries[shape]) {
      this.currentShape = shape;
    }
  }

  getShape() {
    return this.currentShape;
  }

  clearAll() {
    for (const obj of this.objects) {
      this.scene.remove(obj);
      obj.geometry.dispose();
      obj.material.dispose();
    }
    this.objects = [];
    this.stackHeights.clear();
    this.deselectObject();
  }
}
