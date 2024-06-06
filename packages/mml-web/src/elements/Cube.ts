import * as THREE from "three";

import { AnimationType, AttributeAnimation } from "./AttributeAnimation";
import { MElement } from "./MElement";
import { minimumNonZero, TransformableElement } from "./TransformableElement";
import { AnimatedAttributeHelper } from "../utils/AnimatedAttributeHelper";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseColorAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { CollideableHelper } from "../utils/CollideableHelper";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";

const defaultCubeColor = new THREE.Color(0xffffff);
const defaultCubeWidth = 1;
const defaultCubeHeight = 1;
const defaultCubeDepth = 1;
const defaultCubeOpacity = 1;
const defaultCubeCastShadows = true;
const defaultInstanced = false;
const defaultScaleX = 1;
const defaultScaleY = 1;
const defaultScaleZ = 1;

export class Cube extends TransformableElement {
  static tagName = "m-cube";

  private cubeAnimatedAttributeHelper = new AnimatedAttributeHelper(this, {
    sx: [
      AnimationType.Number,
      1,
      (newValue: number) => {
        if (this.props.instanced) {
          this.container.scale.x = minimumNonZero(newValue);
          this.updateInstancedMesh();
        }
      },
    ],
    sy: [
      AnimationType.Number,
      1,
      (newValue: number) => {
        if (this.props.instanced) {
          this.container.scale.y = minimumNonZero(newValue);
          this.updateInstancedMesh();
        }
      },
    ],
    sz: [
      AnimationType.Number,
      1,
      (newValue: number) => {
        if (this.props.instanced) {
          this.container.scale.z = minimumNonZero(newValue);
          this.updateInstancedMesh();
        }
      },
    ],
    color: [
      AnimationType.Color,
      defaultCubeColor,
      (newValue: THREE.Color) => {
        this.props.color = newValue;
        if (this.material) {
          this.material.color = this.props.color;
        }
        if (this.props.instanced && this.getInstanceIndex() !== undefined) {
          this.getInstanceManager()?.update(
            this.getInstanceIndex() as number,
            this.getInstanceMatrix(),
            this.props.color,
          );
        }
      },
    ],
    width: [
      AnimationType.Number,
      defaultCubeWidth,
      (newValue: number) => {
        this.props.width = newValue;

        if (this.props.instanced) {
          this.updateInstancedMesh();
        } else {
          this.mesh.scale.x = this.props.width;
        }

        this.applyBounds();
        this.collideableHelper.updateCollider(this.mesh);
      },
    ],
    height: [
      AnimationType.Number,
      defaultCubeHeight,
      (newValue: number) => {
        this.props.height = newValue;

        if (this.props.instanced) {
          this.updateInstancedMesh();
        } else {
          this.mesh.scale.y = this.props.height;
        }

        this.applyBounds();
        this.collideableHelper.updateCollider(this.mesh);
      },
    ],
    depth: [
      AnimationType.Number,
      defaultCubeDepth,
      (newValue: number) => {
        this.props.depth = newValue;

        if (this.props.instanced) {
          this.updateInstancedMesh();
        } else {
          this.mesh.scale.z = this.props.depth;
        }

        this.applyBounds();
        this.collideableHelper.updateCollider(this.mesh);
      },
    ],
    opacity: [
      AnimationType.Number,
      defaultCubeOpacity,
      (newValue: number) => {
        this.props.opacity = newValue;
        if (this.material) {
          const needsUpdate = this.material.transparent === (this.props.opacity === 1);
          this.material.transparent = this.props.opacity !== 1;
          this.material.needsUpdate = needsUpdate;
          this.material.opacity = newValue;
        }
      },
    ],
  });

  static boxGeometry = new THREE.BoxGeometry(1, 1, 1);

  private props = {
    sx: defaultScaleX,
    sy: defaultScaleY,
    sz: defaultScaleZ,
    instanced: defaultInstanced,
    width: defaultCubeWidth,
    height: defaultCubeHeight,
    depth: defaultCubeDepth,
    color: defaultCubeColor,
    opacity: defaultCubeOpacity,
    castShadows: defaultCubeCastShadows,
  };
  private mesh: THREE.Mesh<THREE.BoxGeometry, THREE.Material | Array<THREE.Material>>;
  private material: THREE.MeshStandardMaterial | null = null;
  private collideableHelper = new CollideableHelper(this);

  private static attributeHandler = new AttributeHandler<Cube>({
    sx: (instance) => {
      instance.props.sx = parseFloatAttribute(instance.getAttribute("sx"), 1);
      if (instance.props.instanced) {
        instance.updateInstancedMesh();
      }
    },
    sy: (instance) => {
      instance.props.sy = parseFloatAttribute(instance.getAttribute("sy"), 1);
      if (instance.props.instanced) {
        instance.updateInstancedMesh();
      }
    },
    sz: (instance) => {
      instance.props.sz = parseFloatAttribute(instance.getAttribute("sz"), 1);
      if (instance.props.instanced) {
        instance.updateInstancedMesh();
      }
    },
    instanced: (instance, newValue) => {
      instance.props.instanced = parseBoolAttribute(newValue, defaultInstanced);
      if (instance.isConnected) {
        instance.updateMeshType();
      }
    },
    width: (instance, newValue) => {
      instance.cubeAnimatedAttributeHelper.elementSetAttribute(
        "width",
        parseFloatAttribute(newValue, defaultCubeWidth),
      );
    },
    height: (instance, newValue) => {
      instance.cubeAnimatedAttributeHelper.elementSetAttribute(
        "height",
        parseFloatAttribute(newValue, defaultCubeHeight),
      );
    },
    depth: (instance, newValue) => {
      instance.cubeAnimatedAttributeHelper.elementSetAttribute(
        "depth",
        parseFloatAttribute(newValue, defaultCubeDepth),
      );
    },
    color: (instance, newValue) => {
      instance.cubeAnimatedAttributeHelper.elementSetAttribute(
        "color",
        parseColorAttribute(newValue, defaultCubeColor),
      );
    },
    opacity: (instance, newValue) => {
      instance.cubeAnimatedAttributeHelper.elementSetAttribute(
        "opacity",
        parseFloatAttribute(newValue, defaultCubeOpacity),
      );
    },
    "cast-shadows": (instance, newValue) => {
      instance.props.castShadows = parseBoolAttribute(newValue, defaultCubeCastShadows);
      instance.mesh.castShadow = instance.props.castShadows;
    },
  });

  protected enable() {
    this.collideableHelper.enable();
  }

  protected disable() {
    this.collideableHelper.disable();
  }

  protected getContentBounds(): OrientedBoundingBox | null {
    return OrientedBoundingBox.fromSizeAndMatrixWorldProvider(
      new THREE.Vector3(this.props.width, this.props.height, this.props.depth),
      this.container,
    );
  }

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Cube.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes,
    ];
  }

  constructor() {
    super();
    this.initMesh();
  }

  private initMesh() {
    if (this.props.instanced) {
      // Initialize instanced mesh attributes
      this.material = new THREE.MeshStandardMaterial({
        color: this.props.color,
        transparent: this.props.opacity !== 1,
        opacity: this.props.opacity,
      });
      const shaderChunks = {
        instance_pars_vertex: /* glsl */ `
          attribute vec3 instancePosition;
          attribute vec4 instanceQuaternion;
          attribute vec3 instanceScale;
          vec3 applyTRS (vec3 position, vec3 translation, vec4 quaternion, vec3 scale) {
            position *= scale;
            position += 2.0 * cross(quaternion.xyz, cross(quaternion.xyz, position) + quaternion.w * position);
            return position + translation;
          }`,
        instance_vertex: `
          transformed = applyTRS(transformed.xyz, instancePosition, instanceQuaternion, instanceScale);
          `,
      };
      this.material.onBeforeCompile = (shader) => {
        shader.vertexShader = shaderChunks.instance_pars_vertex + "\n" + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          ${shaderChunks.instance_vertex}
          `,
        );
      };
      this.mesh = new THREE.InstancedMesh(
        Cube.boxGeometry,
        this.material,
        1024,
      ) as unknown as THREE.Mesh<THREE.BoxGeometry, THREE.Material | Array<THREE.Material>>;
    } else {
      // Initialize regular mesh
      this.material = new THREE.MeshStandardMaterial({
        color: this.props.color,
        transparent: this.props.opacity !== 1,
        opacity: this.props.opacity,
      });
      this.mesh = new THREE.Mesh(Cube.boxGeometry, this.material);
      this.mesh.scale.x = this.props.width;
      this.mesh.scale.y = this.props.height;
      this.mesh.scale.z = this.props.depth;
    }

    this.mesh.castShadow = this.props.castShadows;
    this.mesh.receiveShadow = true;
    this.container.add(this.mesh);
  }

  public addSideEffectChild(child: MElement): void {
    if (child instanceof AttributeAnimation) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.cubeAnimatedAttributeHelper.addAnimation(child, attr);
      }
    }
    super.addSideEffectChild(child);
  }

  public removeSideEffectChild(child: MElement): void {
    if (child instanceof AttributeAnimation) {
      const attr = child.getAnimatedAttributeName();
      if (attr) {
        this.cubeAnimatedAttributeHelper.removeAnimation(child, attr);
      }
    }
    super.removeSideEffectChild(child);
  }

  public parentTransformed(): void {
    this.collideableHelper.parentTransformed();
  }

  public isClickable(): boolean {
    return true;
  }

  public getCube(): THREE.Mesh<THREE.BoxGeometry, THREE.Material | Array<THREE.Material>> | null {
    return this.mesh;
  }

  public attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    Cube.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }

  public connectedCallback(): void {
    super.connectedCallback();
    if (this.props.instanced) {
      this.container.updateMatrix();

      this.setInstanceIndex(
        this.getInstanceManager()?.register(this.getInstanceMatrix(), this.props.color, this),
      );

      this.container.remove(this.mesh);
    } else {
      this.mesh.visible = true;
      this.container.add(this.mesh);
    }

    this.applyBounds();
    this.collideableHelper.updateCollider(this.mesh);
  }

  public disconnectedCallback(): void {
    this.collideableHelper.removeColliders();
    if (this.material) {
      this.material.dispose();
      this.mesh.material = [];
      this.material = null;
    }

    if (this.getInstanceIndex() !== undefined && this.props.instanced) {
      this.getInstanceManager()?.unregister(this.getInstanceIndex() as number);
    }

    super.disconnectedCallback();
  }

  private getInstanceMatrix() {
    const position = this.container.getWorldPosition(new THREE.Vector3());
    const quaternion = this.container.getWorldQuaternion(new THREE.Quaternion());
    const scale = new THREE.Vector3().multiplyVectors(
      new THREE.Vector3(this.props.width, this.props.height, this.props.depth),
      this.container.getWorldScale(new THREE.Vector3()),
    );

    return new THREE.Matrix4().compose(position, quaternion, scale);
  }

  // Called to switch between instanced and non-instanced mesh types
  // It is assumed that the caller has updated the props.instanced flag
  private updateMeshType() {
    if (this.props.instanced) {
      // Switch from mesh to instanced
      if (this.getInstanceIndex() === undefined) {
        this.setInstanceIndex(
          this.getInstanceManager()?.register(this.getInstanceMatrix(), this.props.color, this),
        );
      }
      this.container.remove(this.mesh);
    } else {
      // Switch from instanced to mesh
      if (this.getInstanceIndex() !== undefined) {
        this.getInstanceManager()?.unregister(this.getInstanceIndex() as number);
        this.setInstanceIndex(undefined);
      }
      this.initMesh();
    }

    this.applyBounds();
    this.collideableHelper.updateCollider(this.mesh);
  }

  private updateInstancedMesh(): void {
    if (this.getInstanceIndex() === undefined) {
      return;
    }
    this.getInstanceManager()?.update(this.getInstanceIndex() as number, this.getInstanceMatrix());
  }
}
