import * as THREE from "three";

import { MElement } from "./MElement";
import { Model } from "./Model";

type ModelInstanceData = {
  count: number;
  group: THREE.Group;
  original: THREE.Group;
  parentMap: Map<number, Model>;
};

class InstancedMeshManager {
  private modelMap: Map<string, ModelInstanceData> = new Map();
  private parentMap: Map<number, MElement> = new Map(); // Maps instanceId to parent MElement

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
    this.scene = scene;
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

  public registerModel(key: string, model: THREE.Group, parent: Model): number {
    let modelData = this.modelMap.get(key);
    let newIndex: number;

    if (modelData !== undefined) {
      newIndex = modelData.count++;

      // update these before calling update model
      modelData.parentMap.set(newIndex, parent);
      this.modelMap.set(key, modelData);

      this.updateModel(key, newIndex);
    } else {
      modelData = {
        original: model,
        count: 1,
        group: new THREE.Group(),
        parentMap: new Map(),
      };
      newIndex = 0;

      // Create an instanced mesh per mesh in the model
      traverseImmediateMeshChildren(model, (child) => {
        const mesh = new THREE.InstancedMesh(child.geometry, child.material, 1024);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.name = child.name;
        mesh.count = 1;

        const clone = child.clone();
        clone.applyMatrix4(parent.getInstanceMatrix());
        mesh.setMatrixAt(0, clone.matrix);
        mesh.instanceMatrix.needsUpdate = true;
        modelData?.group.add(mesh);
      });

      this.scene?.add(modelData.group);
    }

    modelData.parentMap.set(newIndex, parent);
    this.modelMap.set(key, modelData);

    return newIndex;
  }

  public unregisterModel(key: string, index: number) {
    const modelData = this.modelMap.get(key);
    if (modelData === undefined) {
      return;
    }

    modelData.count--;
    if (modelData.count === 0) {
      this.scene?.remove(modelData.group);
      this.modelMap.delete(key);
    } else {
      // Update each instanced mesh to remove the instance at the given index
      traverseImmediateMeshChildren(modelData.group, (mesh) => {
        if (!(mesh instanceof THREE.InstancedMesh)) {
          return;
        }

        // Shift instances after the removed index
        const curMatrix = new THREE.Matrix4();
        for (let i = index + 1; i <= modelData.count; i++) {
          mesh.getMatrixAt(i, curMatrix);
          mesh.setMatrixAt(i - 1, curMatrix);
          const parent = modelData.parentMap.get(i);
          if (parent) {
            parent.setInstanceIndex(i - 1);
            modelData.parentMap.set(i - 1, parent);
            modelData.parentMap.delete(i);
          }
        }

        modelData.parentMap.delete(modelData.count);
        mesh.count = modelData.count;
        mesh.instanceMatrix.needsUpdate = true;
      });
      // this.parentMap.delete(index);
    }
  }

  // The idea here is to iterate over Objects recursively to set the offset matrix per mesh
  // Assumes the approach being taken is for creating one instanced mesh per mesh in the model
  private setInstancedModelMatrix(
    modelData: ModelInstanceData,
    index: number,
    parentTransform: THREE.Matrix4,
  ) {
    return traverseImmediateMeshChildren(modelData.original, (child) => {
      const mesh = modelData.group.children.find(
        (m) => m.name === child.name,
      ) as THREE.InstancedMesh;
      if (!mesh) {
        return;
      }

      const offsetMatrix = new THREE.Matrix4();
      offsetMatrix.copy(parentTransform);
      offsetMatrix.multiply(child.matrix);

      mesh.setMatrixAt(index, offsetMatrix);
      mesh.count = modelData.count;
      mesh.instanceMatrix.needsUpdate = true;
    });
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
    // Shift instances after the removed index
    const curMatrix = new THREE.Matrix4();
    for (let i = index + 1; i <= this.cubeCount; i++) {
      this.cubeMesh.getMatrixAt(i, curMatrix);
      this.cubeMesh.setMatrixAt(i - 1, curMatrix);
      const parent = this.parentMap.get(i);
      if (parent) {
        parent.setInstanceIndex(i - 1);
        this.parentMap.set(i - 1, parent);
        this.parentMap.delete(i);
      }
    }

    this.cubeMesh.count = --this.cubeCount;
    this.cubeMesh.instanceMatrix.needsUpdate = true;
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

  public updateModel(src: string, index: number): void {
    const modelData = this.modelMap.get(src);
    const parent = modelData?.parentMap.get(index);
    if (!modelData || !parent) {
      return;
    }
    this.setInstancedModelMatrix(modelData, index, parent.getInstanceMatrix());
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

function traverseImmediateMeshChildren(
  object: THREE.Object3D,
  callback: (object: THREE.Mesh | THREE.InstancedMesh) => void,
) {
  if (object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh) {
    return callback(object);
  }
  object.children.forEach((child) => {
    traverseImmediateMeshChildren(child, callback);
  });
}
