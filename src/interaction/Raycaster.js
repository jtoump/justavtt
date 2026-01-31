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

  raycastObjects() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    return this.raycaster.intersectObjects(this.objects, false);
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
        hit => hit.object !== this.carriedObject
      );

      if (this.onPlaceCallback) {
        this.onPlaceCallback({
          carriedObject: this.carriedObject,
          gridHit: gridHits.length > 0 ? gridHits[0] : null,
          objectHit: objectHits.length > 0 ? objectHits[0] : null
        });
      }

      this.isCarrying = false;
      this.carriedObject = null;
      return;
    }

    const objectHits = this.raycastObjects();
    if (objectHits.length > 0) {
      const hit = objectHits[0];

      if (this.selectEnabled) {
        this.isCarrying = true;
        this.carriedObject = hit.object;

        if (this.onSelectCallback) {
          this.onSelectCallback({
            object: hit.object,
            point: hit.point
          });
        }
      } else {
        if (this.onClickCallback) {
          this.onClickCallback({
            type: 'object',
            object: hit.object,
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

    if (this.onHoverCallback) {
      this.onHoverCallback({
        gridHit: gridHits.length > 0 ? gridHits[0] : null,
        objectHit: objectHits.length > 0 ? objectHits[0] : null
      });
    }

    if (this.isCarrying && this.carriedObject) {
      const filteredObjectHits = objectHits.filter(
        hit => hit.object !== this.carriedObject
      );

      if (this.onMoveCallback) {
        this.onMoveCallback({
          carriedObject: this.carriedObject,
          gridHit: gridHits.length > 0 ? gridHits[0] : null,
          objectHit: filteredObjectHits.length > 0 ? filteredObjectHits[0] : null
        });
      }
    }
  }

  cancelCarry() {
    this.isCarrying = false;
    this.carriedObject = null;
  }
}
