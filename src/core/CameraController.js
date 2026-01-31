import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class CameraController {
  constructor(camera, domElement) {
    this.controls = new OrbitControls(camera, domElement);

    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    this.controls.minDistance = 5;
    this.controls.maxDistance = 50;

    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.minPolarAngle = 0.1;

    this.controls.target.set(0, 0, 0);
  }

  update() {
    this.controls.update();
  }

  setTarget(x, y, z) {
    this.controls.target.set(x, y, z);
  }
}
