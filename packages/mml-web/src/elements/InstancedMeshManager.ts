import * as THREE from "three";

import { MElement } from "./MElement";
import { Model } from "./Model";

type ModelInstanceData = {
  count: number;
  group: THREE.Group;
  meshes: Record<string, THREE.InstancedMesh>;
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
      modelData.original.children.forEach((child) => {
        this.setInstancedModelMatrix(modelData!, newIndex, child, parent.getInstanceMatrix());
      });
    } else {
      modelData = {
        original: model,
        meshes: {},
        count: 1,
        group: new THREE.Group(),
        parentMap: new Map(),
      };
      newIndex = 0;

      // Create an instanced mesh per mesh in the model
      modelData.meshes = model.children.reduce(
        (acc, child) => {
          const instancedMesh = this.cloneInstanced(child, parent.getInstanceMatrix());
          instancedMesh.count = 1;
          modelData!.group.add(instancedMesh);

          return {
            ...acc,
            [child.name]: instancedMesh,
          };
        },
        {} as Record<string, THREE.InstancedMesh>,
      );
      this.scene?.add(modelData.group);
    }

    // console.log(`🟩 Registering ${newIndex}`);
    modelData.parentMap.set(newIndex, parent);
    this.modelMap.set(key, modelData);

    return newIndex;
  }

  public unregisterModel(key: string, index: number) {
    // console.log(`🟥 Unregistering ${index}`)
    const modelData = this.modelMap.get(key); //
    if (modelData === undefined) {
      return;
    }

    modelData.count--;
    if (modelData.count === 0) {
      // console.log(`🟥 Removing instanced mesh`)
      // Remove the instanced mesh
      this.scene?.remove(modelData.group);
      this.modelMap.delete(key);
      this.parentMap.delete(index);
    } else {
      // Update each instanced mesh to remove the instance at the given index
      const meshes = Object.keys(modelData.meshes);
      meshes.forEach((meshName) => {
        const instancedMesh = modelData.meshes[meshName];
        instancedMesh.setMatrixAt(index, new THREE.Matrix4());
        instancedMesh.count = modelData.count;
        instancedMesh.instanceMatrix.needsUpdate = true;
      });
      this.parentMap.delete(index);
    }
  }

  // The idea here is to iterate over Objects recursively to set the offset matrix per mesh
  // Assumes the approach being taken is for creating one instanced mesh per mesh in the model
  private setInstancedModelMatrix(
    modelData: ModelInstanceData,
    index: number,
    object: THREE.Object3D,
    parentTransform: THREE.Matrix4,
  ) {
    return traverseImmediateMeshChildren(object, (child) => {
      const clone = child.clone();
      clone.applyMatrix4(parentTransform);
      modelData.meshes[child.name].count = modelData.count;
      modelData.meshes[child.name].setMatrixAt(index, clone.matrix);
      modelData.meshes[child.name].instanceMatrix.needsUpdate = true;
    });
  }

  private cloneInstanced(
    object: THREE.Object3D,
    parentTransform: THREE.Matrix4,
  ): THREE.InstancedMesh {
    const clone = object.clone();
    clone.applyMatrix4(parentTransform);

    if (clone instanceof THREE.Mesh) {
      const mesh = new THREE.InstancedMesh(clone.geometry, clone.material, 1024);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.setMatrixAt(0, clone.matrix);
      mesh.instanceMatrix.needsUpdate = true;
      return mesh;
    }
    return this.cloneInstanced(clone, parentTransform);
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

  public updateModel(src: string, index: number): void {
    const modelData = this.modelMap.get(src);
    const parent = modelData?.parentMap.get(index);
    if (!modelData || !parent) {
      return;
    }

    traverseImmediateMeshChildren(modelData.original, (child) => {
      this.setInstancedModelMatrix(modelData, index, child, parent.getInstanceMatrix());
    });
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
  callback: (object: THREE.Mesh) => void,
) {
  if (object instanceof THREE.Mesh) {
    return callback(object);
  }
  object.children.forEach((child) => {
    traverseImmediateMeshChildren(child, callback);
  });
}
