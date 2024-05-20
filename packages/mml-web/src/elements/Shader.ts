import * as THREE from "three";

import { Audio } from "./Audio";
import { TransformableElement } from "./TransformableElement";
import { Video } from "./Video";
import { PositionAndRotation } from "../MMLScene";
import {
  baseFragShader,
  baseVertexShader,
  defaultFragShader,
  defaultVertexShader,
} from "../shaders/defaultShaders";
import ShaderBufferManager, { ShaderBufferItem } from "../shaders/ShaderBuffer";
import {
  AttributeHandler,
  parseBoolAttribute,
  parseFloatAttribute,
} from "../utils/attribute-handling";
import { CollideableHelper } from "../utils/CollideableHelper";
import { OrientedBoundingBox } from "../utils/OrientedBoundingBox";
import {
  injectAfter,
  injectBeforeMain,
  injectInsideMain,
  injectTop,
  regexBeforeMain,
  regexInsideMain,
} from "../utils/shader-helpers";

const FFT_BIN_COUNT = 512;
const MAX_SHADER_TEXTURES = 8;

const defaultShaderType = "mesh";
const defaultShaderWidth = 1;
const defaultShaderHeight = 1;
const defaultCollisionInterval = null;
const defaultAudioNode = null;
const defaultVideoNode = null;
const defaultFog = true;
const defaultLights = true;
const defaultDithering = true;
const defaultDepthWrite = true;
const defaultTransparent = true;

export class Shader extends TransformableElement {
  static tagName = "m-shader";
  private documentTimeListener: { remove: () => void };

  private static attributeHandler = new AttributeHandler<Shader>({
    vert: (instance, newValue) => {
      instance.props.vert = newValue || defaultVertexShader;
      if (instance.isConnected) {
        instance.updateMaterial();
      }
    },
    frag: (instance, newValue) => {
      instance.props.frag = newValue || defaultFragShader;
      if (instance.isConnected) {
        instance.updateMaterial();
      }
    },
    width: (instance, newValue) => {
      instance.props.width = parseFloatAttribute(newValue, defaultShaderWidth);
      if (instance.isConnected) {
        instance.updateHeightAndWidth();
      }
    },
    height: (instance, newValue) => {
      instance.props.height = parseFloatAttribute(newValue, defaultShaderHeight);
      if (instance.isConnected) {
        instance.updateHeightAndWidth();
      }
    },
    audio: (instance, newValue) => {
      instance.props.audio = newValue || defaultAudioNode;
      if (instance.props.audio && instance.loadedAudioState) {
        instance.updateAudio();
      }
    },
    video: (instance, newValue) => {
      instance.props.video = newValue;
      if (instance.loadedAudioState) {
        instance.updateAudio();
      }
    },
    ["collision-interval"]: (instance, newValue) => {
      instance.props.collisionInterval = newValue;
      instance.updateCollision();
    },
    type: (instance, newValue) => {
      const ogType = instance.props.type;
      instance.props.type = newValue?.match(/(mesh|points)/)
        ? (newValue as typeof instance.props.type)
        : defaultShaderType;

      if (instance.isConnected && ogType !== instance.props.type) {
        instance.updateMeshType();
      }
    },
    fog: (instance, newValue) => {
      instance.props.fog = parseBoolAttribute(newValue, defaultFog);
      if (instance.material && instance.material.fog !== instance.props.fog) {
        instance.material.fog = instance.props.fog;
        instance.updateUniforms();
        instance.material.needsUpdate = true;
      }
    },
    lights: (instance, newValue) => {
      instance.props.lights = parseBoolAttribute(newValue, defaultLights);
      if (instance.material && instance.material.lights !== instance.props.lights) {
        instance.material.lights = instance.props.lights;
        instance.updateUniforms();
        instance.material.needsUpdate = true;
      }
    },
    dithering: (instance, newValue) => {
      instance.props.dithering = parseBoolAttribute(newValue, defaultDithering);
      if (instance.material) {
        instance.material.dithering = instance.props.dithering;
        instance.material.needsUpdate = true;
      }
    },
    ["depth-write"]: (instance, newValue) => {
      instance.props.depthWrite = parseBoolAttribute(newValue, defaultDepthWrite);
      if (instance.material) {
        instance.material.depthWrite = instance.props.depthWrite;
        instance.material.needsUpdate = true;
      }
    },
    transparent: (instance, newValue) => {
      instance.props.transparent = parseBoolAttribute(newValue, defaultTransparent);
      if (instance.material) {
        instance.material.transparent = instance.props.transparent;
        instance.material.needsUpdate = true;
      }
    },
  });

  static get observedAttributes(): Array<string> {
    return [
      ...TransformableElement.observedAttributes,
      ...Shader.attributeHandler.getAttributes(),
      ...CollideableHelper.observedAttributes,
    ];
  }

  private mesh:
    | THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>
    | THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private material: THREE.ShaderMaterial | null = null;

  private collideableHelper = new CollideableHelper(this);
  private clock = new THREE.Clock();

  private loadedShaderState: {
    audio?: THREE.Audio;

    // The difference between the document time and the local clock time.
    timeDifference: number;

    hasBuffers: boolean;
    bufferManager?: ShaderBufferManager;

    animationRequestId: number;

    parent: Shader | null;
  } | null = null;

  private loadedAudioState: {
    analyser: THREE.AudioAnalyser;
    fft: {
      maxValue: number;
      value: number;
    };
    fftSize: number;
  } | null = null;

  private uniforms: { [key: string]: THREE.IUniform } = {};
  private baseUniforms: { [key: string]: THREE.IUniform } = {};
  private textureUniforms: { [key: string]: THREE.IUniform } = {};

  private baseUniformsDeclarationString = /* glsl */ `
  #define BIN_COUNT ${(FFT_BIN_COUNT * 2) / 3}
  varying vec2 vUv;
  uniform float time;
  uniform vec2 resolution;
  uniform float fft;
  uniform sampler2D fftTexture;
`;

  // Parsed attribute values
  private props = {
    vert: defaultVertexShader,
    frag: defaultFragShader,
    width: defaultShaderWidth as number | null,
    height: defaultShaderHeight as number | null,
    audio: defaultAudioNode as string | null,
    video: defaultVideoNode as string | null,
    probe: null as string | null,
    type: defaultShaderType as "mesh" | "points",
    collisionInterval: defaultCollisionInterval as string | null,
    fog: defaultFog as boolean,
    lights: defaultLights as boolean,
    dithering: defaultDithering as boolean,
    depthWrite: defaultDepthWrite as boolean,
    transparent: defaultTransparent as boolean,
  };

  constructor() {
    super();

    // Setup default uniforms
    this.baseUniforms.mouse = new THREE.Uniform(new THREE.Vector2(0, 0));
    this.baseUniforms.time = new THREE.Uniform(0.0);
    this.baseUniforms.fft = new THREE.Uniform(0.0);
    this.baseUniforms.fftTexture = new THREE.Uniform(null);
    this.baseUniforms.resolution = new THREE.Uniform(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
    );
    this.baseUniforms.metalness = new THREE.Uniform(0.0);
    this.baseUniforms.roughness = new THREE.Uniform(1.0);
    this.baseUniforms.opacity = new THREE.Uniform(1.0);

    this.textureUniforms = {};
    Array.from({ length: MAX_SHADER_TEXTURES }, (_, i) => {
      this.textureUniforms[ShaderBufferManager.getBufferKey(i + 1)] = new THREE.Uniform(null);
    });

    this.uniforms = THREE.UniformsUtils.merge([
      this.baseUniforms,
      this.textureUniforms,
      this.props.lights ? THREE.UniformsLib["lights"] : {},
      THREE.UniformsLib["fog"],
    ]);
  }

  private createShaderMaterial() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: baseVertexShader,
      fragmentShader: baseFragShader,
      uniforms: this.uniforms,
      side: THREE.DoubleSide,
      fog: this.props.fog,
      lights: this.props.lights,
      dithering: this.props.dithering,
      depthWrite: this.props.depthWrite,
      transparent: this.props.transparent,
    });

    this.material.onBeforeCompile = (shader) => {
      shader.uniforms = this.uniforms;

      shader.vertexShader = this.updateVertexShader();
      shader.fragmentShader = this.updateFragmentShader();

      shader.vertexShader = injectTop(shader.vertexShader, this.baseUniformsDeclarationString);
      shader.fragmentShader = injectTop(shader.fragmentShader, this.baseUniformsDeclarationString);
    };
  }

  public createShaderMesh() {
    if (!this.material) {
      throw new Error("Shader material is undefined");
    }
    const geometry = new THREE.PlaneGeometry(1, 1, 50, 50);

    if (this.props.type === "points") {
      this.mesh = new THREE.Points(geometry, this.material);
    } else {
      this.mesh = new THREE.Mesh(geometry, this.material);
    }

    this.updateHeightAndWidth();

    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.container.add(this.mesh);
  }

  /**
   * Create shader buffers for texture shaders i.e. m-shader children
   */
  public updateShaderBuffers() {
    if (!this.loadedShaderState || !this.loadedShaderState.bufferManager) {
      throw new Error("Trying to create shader buffers before loading shader");
    }

    const shaders = [...Array.from(this.querySelectorAll("m-shader"))] as Shader[];
    this.loadedShaderState.hasBuffers = shaders.length > 0;

    const textureMaterials: ShaderBufferItem[] = shaders.map((shader, i) => {
      const material = new THREE.ShaderMaterial({
        vertexShader: shader.props.vert,
        fragmentShader: shader.props.frag,
        uniforms: this.uniforms,
      });
      material.onBeforeCompile = (shader) => {
        shader.uniforms = this.uniforms;
        shader.vertexShader = injectTop(shader.vertexShader, this.baseUniformsDeclarationString);
        shader.vertexShader = injectInsideMain(shader.vertexShader, "vUv = uv;");
        shader.fragmentShader = injectTop(
          shader.fragmentShader,
          this.baseUniformsDeclarationString,
        );
      };

      const readTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
      const writeTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);

      this.textureUniforms[ShaderBufferManager.getBufferKey(i + 1)].value = readTarget.texture;

      return { material, readTarget, writeTarget };
    });

    this.loadedShaderState.bufferManager.dispose();
    this.loadedShaderState.bufferManager.setBuffers(textureMaterials);
  }

  private parseCustomUniforms() {
    const data = this.dataset;
    try {
      const uniformHandlers = {
        float: (value: string) => parseFloat(value),
        int: (value: string) => parseInt(value),
        floatArray: (value: string[]) => value.map(parseFloat),
        intArray: (value: string[]) => value.map(parseInt),
        vec2: (value: number[]) => new THREE.Vector2(...value),
        vec3: (value: number[]) => new THREE.Vector3(...value),
        vec4: (value: number[]) => new THREE.Vector4(...value),
        vec2Array: (value: number[][]) => value.map((v) => new THREE.Vector2(...v)),
        vec3Array: (value: number[][]) => value.map((v) => new THREE.Vector3(...v)),
        vec4Array: (value: number[][]) => value.map((v) => new THREE.Vector4(...v)),
        bool: (value: string) => (value === "true" ? true : false),
        mat4: (value: string[]) => new THREE.Matrix4().fromArray(value.map(parseFloat)),
      };

      for (const [key, value] of Object.entries(data)) {
        if (key.startsWith("uniform") && value) {
          const parsedValue = JSON.parse(value);
          const uniformKey = key.charAt(7).toLowerCase() + key.slice(8); // remove 'uniform' prefix and transform to camelCase

          // Validate type
          if (!parsedValue.type || !Object.keys(uniformHandlers).includes(parsedValue.type)) {
            console.warn(`Uniform ${uniformKey} does not have a valid type. Skipping...`);
            continue;
          }

          const handler = uniformHandlers[parsedValue.type as keyof typeof uniformHandlers];
          this.uniforms[uniformKey] = { value: handler(parsedValue.value) };
        }
      }
      console.log("Parsed Uniforms:\n", this.uniforms);
    } catch (error) {
      console.error("Error parsing uniforms", error);
    }
  }

  public parentTransformed(): void {
    this.collideableHelper.parentTransformed();
  }

  public isClickable(): boolean {
    return true;
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    super.attributeChangedCallback(name, oldValue, newValue);
    Shader.attributeHandler.handle(this, name, newValue);
    this.collideableHelper.handle(name, newValue);
  }

  private syncShaderTime() {
    const documentTime = this.getDocumentTime();
    if (documentTime && this.loadedShaderState) {
      // Compute the difference between the document time and the local clock time
      this.loadedShaderState.timeDifference = documentTime / 1000 - this.clock.getElapsedTime();
    }
  }

  private documentTimeChanged() {
    if (this.props.audio && !this.loadedAudioState) {
      this.updateAudio();
    }

    if (this.loadedShaderState) {
      this.syncShaderTime();
      this.uniforms.time.value =
        this.clock.getElapsedTime() + this.loadedShaderState.timeDifference;
    }
  }

  private render() {
    if (!this.uniforms || !this.loadedShaderState) return;
    this.loadedShaderState.animationRequestId = requestAnimationFrame(this.render.bind(this));

    // Add the time difference to the local clock time.
    this.uniforms.time.value = this.clock.getElapsedTime() + this.loadedShaderState.timeDifference;

    // Update fft data
    if (this.loadedAudioState) {
      // Update fftTexture
      this.loadedAudioState.analyser.getFrequencyData();
      if (this.uniforms.fftTexture.value) {
        this.uniforms.fftTexture.value.needsUpdate = true;
      }

      // Update fft average value
      this.loadedAudioState.fft.value = this.loadedAudioState.analyser.getAverageFrequency();

      // Update max fft value
      this.loadedAudioState.fft.maxValue = Math.max(
        this.loadedAudioState.fft.value,
        this.loadedAudioState.fft.maxValue || 1,
      );

      // Normalize fft value
      this.uniforms.fft.value =
        this.loadedAudioState.fft.value / this.loadedAudioState.fft.maxValue;
    }

    // Update shader buffers
    if (this.loadedShaderState.hasBuffers) {
      this.loadedShaderState.bufferManager?.renderTextures();
    }
  }

  private updateVertexShader() {
    if (!this.props.vert) return baseVertexShader;
    let vert = baseVertexShader;
    const beforeMainVert = this.props.vert.match(regexBeforeMain);
    const insideMainVert = this.props.vert.match(regexInsideMain);

    if (beforeMainVert && beforeMainVert[0]) {
      vert = injectBeforeMain(vert, beforeMainVert[0]);
    }

    if (insideMainVert && insideMainVert[insideMainVert.length - 1]) {
      vert = injectAfter(vert, "// insideMainBegin", insideMainVert[insideMainVert.length - 1]);
    }

    return vert;
  }

  private updateFragmentShader() {
    if (!this.props.frag) return baseFragShader;
    let frag = baseFragShader;
    const beforeMainFrag = this.props.frag.match(regexBeforeMain);
    const insideMainFrag = this.props.frag.match(regexInsideMain);

    if (beforeMainFrag && beforeMainFrag[0]) {
      frag = injectBeforeMain(frag, beforeMainFrag[0]);
    }

    if (insideMainFrag && insideMainFrag[insideMainFrag.length - 1]) {
      frag = injectAfter(frag, "// insideMainBegin", insideMainFrag[insideMainFrag.length - 1]);
    }

    return frag;
  }

  private updateParentShader() {
    if (this.loadedShaderState?.parent !== this.parentElement) {
      throw new Error("Parent shader does not match parent element");
    }

    const mainShader = this.loadedShaderState.parent;
    if (!mainShader?.loadedShaderState) {
      throw new Error("Main shader does not have loaded shader state");
    }

    // We are adding a texture to a childless shader
    if (!mainShader?.loadedShaderState?.bufferManager) {
      mainShader.loadedShaderState.bufferManager = new ShaderBufferManager(
        this.getScene().getRenderer() as THREE.WebGLRenderer,
      );
    }

    // Update parent material
    if (mainShader) {
      mainShader.updateShaderBuffers();
      mainShader.updateMaterial();
    }
  }

  private updateMaterial() {
    if (this.loadedShaderState?.parent && this.loadedShaderState?.parent !== this.parentElement) {
      throw new Error("Parent shader does not match parent element");
    }

    if (this.material) {
      (this.material as THREE.ShaderMaterial).fragmentShader = this.updateFragmentShader();
      (this.material as THREE.ShaderMaterial).vertexShader = this.updateVertexShader();
      (this.material as THREE.ShaderMaterial).needsUpdate = true;
    }
    this.syncShaderTime();

    // Update main shader if this is a texture buffer
    const isChildShader = this.parentElement?.tagName.toLowerCase() === Shader.tagName;
    if (isChildShader) {
      this.updateParentShader();
    }
  }

  /*
   * Updates the audio element being used for audio data
   */
  private updateAudio() {
    if (!this.loadedAudioState) {
      let audioElement: THREE.PositionalAudio;

      if (this.props.audio) {
        const audio = document.getElementById(this.props.audio) as Audio;
        const audioState = audio.getLoadedAudioState();

        if (!audioState || !audioState.audioElement || !audioState.positionalAudio) {
          return;
        }
        audioElement = audioState.positionalAudio;
      } else if (this.props.video) {
        const video = document.getElementById(this.props.video) as Video;
        const videoState = video.getLoadedVideoState();
        if (!videoState?.audio) {
          return;
        }
        audioElement = videoState.audio;
      } else {
        return;
      }

      const analyser = new THREE.AudioAnalyser(audioElement, FFT_BIN_COUNT);
      const format = (this.getScene().getRenderer() as THREE.WebGLRenderer).capabilities.isWebGL2
        ? THREE.RedFormat
        : THREE.LuminanceFormat;
      this.loadedAudioState = {
        analyser,
        fft: {
          value: 0,
          maxValue: 0,
        },
        fftSize: FFT_BIN_COUNT,
      };

      this.uniforms.fftTexture.value = new THREE.DataTexture(
        analyser.data,
        FFT_BIN_COUNT / 2,
        1,
        format,
      );
    }
  }

  private watchCollisions(
    event: Event & {
      detail: {
        position: { x: number; y: number; z: number };
      };
    },
  ) {
    const { position } = event.detail;
    this.updateCollisionPosition({ position });
  }

  private updateCollisionPosition(elementRelative: Pick<PositionAndRotation, "position">) {
    const shaderDimentions = {
      width: parseInt(this.getAttribute("width") || "1"),
      height: parseInt(this.getAttribute("height") || "1"),
    };
    const offsetX = shaderDimentions.width / 2;
    const offsetZ = shaderDimentions.height / 2;
    this.uniforms.mouse.value = {
      x: (elementRelative.position.x + offsetX) / shaderDimentions.width,
      y: (elementRelative.position.y + offsetZ) / shaderDimentions.height,
    };
  }

  private updateCollision() {
    if (!this.props.collisionInterval) {
      this.removeEventListener("collision", this.watchCollisions);
      return;
    }
    this.addEventListener("collisionstart", () => null);
    this.addEventListener("collisionmove", this.watchCollisions);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.documentTimeListener = this.addDocumentTimeListener(this.documentTimeChanged.bind(this));
    this.loadedShaderState = {
      hasBuffers: false,
      timeDifference: 0,
      animationRequestId: -1,
      parent: null,
    };

    // Check if shader is supposed to be a texture buffer
    const isShaderChild = this.parentElement?.tagName.toLowerCase() === Shader.tagName;
    if (isShaderChild) {
      this.loadedShaderState.parent = this.parentElement as Shader;
      this.updateParentShader();
      return;
    }

    this.createShaderMaterial();
    this.createShaderMesh();

    // Check if shader has texture buffers
    this.loadedShaderState.hasBuffers = this.querySelectorAll("m-shader").length > 0;
    if (this.loadedShaderState.hasBuffers) {
      this.loadedShaderState.bufferManager = new ShaderBufferManager(
        this.getScene().getRenderer() as THREE.WebGLRenderer,
      );
      this.updateShaderBuffers();
    }

    // this.parseCustomUniforms();
    if (this.props.type !== defaultShaderType) {
      this.updateMeshType();
    } else {
      this.updateMaterial();
    }

    if (this.props.audio) {
      const audioTag = document.getElementById(this.props.audio) as Audio;
      audioTag?.getLoadedAudioState()?.audioElement.addEventListener("loadeddata", () => {
        this.updateAudio();
      });
    }

    if (this.props.video) {
      const videoTag = document.getElementById(this.props.video) as Video;
      videoTag.getLoadedVideoState()?.video.addEventListener("loadeddata", () => {
        this.updateAudio();
      });
    }

    this.collideableHelper.updateCollider(this.mesh);
    this.render();
  }

  disconnectedCallback() {
    this.documentTimeListener.remove();
    this.collideableHelper.removeColliders();

    if (this.material) {
      this.material.dispose();
      this.material = null;
    }
    if (this.mesh) {
      this.container.remove(this.mesh);
      this.mesh.geometry.dispose();
    }

    cancelAnimationFrame(this.loadedShaderState?.animationRequestId || -1);

    if (this.loadedShaderState?.parent) {
      // this.loadedShaderState.parent.updateShaderBuffers();
      // this.loadedShaderState.parent.updateMaterial();
    }
    this.loadedShaderState?.bufferManager?.dispose();
    this.loadedShaderState = null;

    super.disconnectedCallback();
  }

  public getMesh(): typeof this.mesh {
    return this.mesh;
  }

  private updateHeightAndWidth() {
    const height = parseFloat(this.getAttribute("height") || "1");
    const width = parseFloat(this.getAttribute("width") || "1");

    this.mesh.scale.set(width, height, 1);
    this.collideableHelper.updateCollider(this.mesh);
  }

  public getContentBounds(): OrientedBoundingBox | null {
    return null;
  }

  protected enable() {
    this.collideableHelper.enable();
    this.syncShaderTime();
  }

  protected disable() {
    this.collideableHelper.disable();
    this.syncShaderTime();
  }

  private updateMeshType() {
    if (
      (this.props.type === "mesh" && this.mesh instanceof THREE.Mesh) ||
      (this.props.type === "points" && this.mesh instanceof THREE.Points)
    ) {
      return;
    }
    const geometry = this.mesh.geometry;
    const material = this.mesh.material;
    const oldMesh = this.mesh;

    if (this.props.type === "points") {
      this.mesh = new THREE.Points(geometry, material);
    } else {
      this.mesh = new THREE.Mesh(geometry, material);
    }

    this.container.remove(oldMesh);
    this.container.add(this.mesh);

    this.updateHeightAndWidth();
    this.updateMaterial();
  }

  private updateUniforms() {
    const uniforms = [this.baseUniforms, THREE.UniformsLib["fog"]];
    if (this.props.lights) {
      uniforms.push(THREE.UniformsLib["lights"]);
    }

    this.uniforms = {
      ...THREE.UniformsUtils.merge(uniforms),
      ...this.textureUniforms,
    };
  }
}
