import * as THREE from 'three';

export class Raycaster {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.gridPlane = null;
    this.objects = [];

    this.onClickCallback = null;
    this.onSelectCallback = null;
    this.onMoveCallback = null;
    this.onPlaceCallback = null;
    this.onHoverCallback = null;

    this.isCarrying = false;
    this.carriedObject = null;
    this.selectEnabled = false;

    this.setupEventListeners();
  }

  setSelectEnabled(enabled) {
    this.selectEnabled = enabled;
    if (!enabled) {
      this.cancelCarry();
    }
  }

  setupEventListeners() {
    this.domElement.addEventListener('click', (e) => this.handleClick(e));
    this.domElement.addEventListener('mousemove', (e) => this.handleMouseMove(e));
  }

  setGridPlane(plane) {
    this.gridPlane = plane;
  }

  setObjects(objects) {
    this.objects = objects;
  }

  setOnClick(callback) {
    this.onClickCallback = callback;
  }

  setOnSelect(callback) {
    this.onSelectCallback = callback;
  }

  setOnMove(callback) {
    this.onMoveCallback = callback;
  }

  setOnPlace(callback) {
    this.onPlaceCallback = callback;
  }

  setOnHover(callback) {
    this.onHoverCallback = callback;
  }

  updateMouse(event) {
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  /**
   * Find the root parent object that belongs to our objects array.
   * This is needed because raycasting into Groups hits child meshes,
   * but we need to return the parent Group with userData.
   */
  findParentObject(hitObject) {
    // Check if the hit object itself is in our objects array
    if (this.objects.includes(hitObject)) {
      return hitObject;
    }
    // Traverse up to find a parent that's in our objects array
    let current = hitObject.parent;
    while (current) {
      if (this.objects.includes(current)) {
        return current;
      }
      current = current.parent;
    }
    return hitObject; // Fallback to original if not found
  }

  /**
   * Check if an object belongs to (or is) the carried object
   */
  isPartOfCarriedObject(obj) {
    if (!this.carriedObject) return false;
    if (obj === this.carriedObject) return true;
    // Check if obj is a descendant of carriedObject
    let current = obj.parent;
    while (current) {
      if (current === this.carriedObject) return true;
      current = current.parent;
    }
    return false;
  }

  raycastObjects() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    // Use true to traverse children (needed for THREE.Group objects)
    return this.raycaster.intersectObjects(this.objects, true);
  }

  raycastGrid() {
    if (!this.gridPlane) return [];
    this.raycaster.setFromCamera(this.mouse, this.camera);
    return this.raycaster.intersectObject(this.gridPlane, false);
  }

  handleClick(event) {
    if (event.button !== 0) return;

    this.updateMouse(event);

    if (this.isCarrying && this.carriedObject) {
      const gridHits = this.raycastGrid();
      const objectHits = this.raycastObjects().filter(
        hit => !this.isPartOfCarriedObject(hit.object)
      );

      // Map hits to their parent objects
      const mappedHit = objectHits.length > 0 ? {
        ...objectHits[0],
        object: this.findParentObject(objectHits[0].object)
      } : null;

      if (this.onPlaceCallback) {
        this.onPlaceCallback({
          carriedObject: this.carriedObject,
          gridHit: gridHits.length > 0 ? gridHits[0] : null,
          objectHit: mappedHit
        });
      }

      this.isCarrying = false;
      this.carriedObject = null;
      return;
    }

    const objectHits = this.raycastObjects();
    if (objectHits.length > 0) {
      const hit = objectHits[0];
      const parentObject = this.findParentObject(hit.object);

      if (this.selectEnabled) {
        this.isCarrying = true;
        this.carriedObject = parentObject;

        if (this.onSelectCallback) {
          this.onSelectCallback({
            object: parentObject,
            point: hit.point
          });
        }
      } else {
        if (this.onClickCallback) {
          this.onClickCallback({
            type: 'object',
            object: parentObject,
            point: hit.point
          });
        }
      }
      return;
    }

    const gridHits = this.raycastGrid();
    if (gridHits.length > 0) {
      if (this.onClickCallback) {
        this.onClickCallback({
          type: 'grid',
          point: gridHits[0].point
        });
      }
    }
  }

  handleMouseMove(event) {
    this.updateMouse(event);

    const gridHits = this.raycastGrid();
    const objectHits = this.raycastObjects();

    // Map hits to their parent objects for hover callback
    const mappedHoverHit = objectHits.length > 0 ? {
      ...objectHits[0],
      object: this.findParentObject(objectHits[0].object)
    } : null;

    if (this.onHoverCallback) {
      this.onHoverCallback({
        gridHit: gridHits.length > 0 ? gridHits[0] : null,
        objectHit: mappedHoverHit
      });
    }

    if (this.isCarrying && this.carriedObject) {
      const filteredObjectHits = objectHits.filter(
        hit => !this.isPartOfCarriedObject(hit.object)
      );

      // Map filtered hits to their parent objects
      const mappedMoveHit = filteredObjectHits.length > 0 ? {
        ...filteredObjectHits[0],
        object: this.findParentObject(filteredObjectHits[0].object)
      } : null;

      if (this.onMoveCallback) {
        this.onMoveCallback({
          carriedObject: this.carriedObject,
          gridHit: gridHits.length > 0 ? gridHits[0] : null,
          objectHit: mappedMoveHit
        });
      }
    }
  }

  cancelCarry() {
    this.isCarrying = false;
    this.carriedObject = null;
  }
}
