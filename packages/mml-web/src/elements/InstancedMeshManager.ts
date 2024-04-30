import * as THREE from "three";

import { MElement } from "./MElement";

class InstancedMeshManager {
  private parentMap: Map<number, MElement> = new Map();
  private cubeCount = 0;

  private boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  private material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    opacity: 1,
  });

  private static instance?: InstancedMeshManager;
  public cubeMesh: THREE.InstancedMesh;
  private scene?: THREE.Scene;

  private constructor(scene: THREE.Scene) {
    this.cubeMesh = this.createCubeMesh(scene);
  }

  public static getInstance(scene: THREE.Scene) {
    if (!InstancedMeshManager.instance) {
      InstancedMeshManager.instance = new InstancedMeshManager(scene);
    }
    return InstancedMeshManager.instance;
  }

  public getParent(instanceId: number) {
    return this.parentMap.get(instanceId) || null;
  }

  private createCubeMesh(scene: THREE.Scene): THREE.InstancedMesh {
    const cubeMesh = new THREE.InstancedMesh(this.boxGeometry, this.material, 1024);
    cubeMesh.count = this.cubeCount;
    cubeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    cubeMesh.instanceMatrix.needsUpdate = true;

    if (cubeMesh.instanceColor) {
      cubeMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }

    scene.add(cubeMesh);
    return cubeMesh;
  }

  public register(matrix: THREE.Matrix4, color: THREE.Color, parent: MElement): number {
    if (this.cubeCount === 0) {
      this.material.needsUpdate = true;
    }

    const newIndex = this.cubeCount++;
    this.cubeMesh.count = this.cubeCount;
    this.update(newIndex, matrix, color);

    this.parentMap.set(newIndex, parent);
    return newIndex;
  }

  public unregister(index: number): void {
    this.cubeMesh.setMatrixAt(index, new THREE.Matrix4());
    this.cubeMesh.count = --this.cubeCount;
    this.cubeMesh.instanceMatrix.needsUpdate = true;
    this.parentMap.delete(index);
    if (this.cubeCount === 0) {
      this.material.needsUpdate = true;
    }
  }

  public update(index: number, matrix?: THREE.Matrix4, color?: THREE.Color): void {
    if (matrix) {
      this.cubeMesh.setMatrixAt(index, matrix);
      this.cubeMesh.instanceMatrix.needsUpdate = true;
      this.cubeMesh.computeBoundingSphere();
    }

    if (color) {
      this.cubeMesh.setColorAt(index, color);
      if (this.cubeMesh.instanceColor) {
        this.cubeMesh.instanceColor.needsUpdate = true;
      }
    }
  }

  public updateTransform(
    index: number,
    position?: THREE.Vector3,
    quaternion?: THREE.Quaternion,
    scale?: THREE.Vector3,
  ): void {
    const matrix = new THREE.Matrix4();
    this.cubeMesh.getMatrixAt(index, matrix);

    if (!position) {
      position = new THREE.Vector3();
      position.setFromMatrixPosition(matrix);
    }

    if (!quaternion) {
      const rotation = new THREE.Matrix4().extractRotation(matrix);
      quaternion = new THREE.Quaternion();
      quaternion.setFromRotationMatrix(rotation);
    }

    if (!scale) {
      scale = new THREE.Vector3();
      scale.setFromMatrixScale(matrix);
    }

    this.update(
      index,
      new THREE.Matrix4().compose(position.clone(), quaternion.clone().normalize(), scale.clone()),
    );
  }

  public updateColor(index: number, color: THREE.Color) {
    return this.update(index, undefined, color);
  }

  public dispose() {
    this.scene?.remove(this.cubeMesh);
    this.cubeMesh.dispose();
  }
}

export default InstancedMeshManager;
