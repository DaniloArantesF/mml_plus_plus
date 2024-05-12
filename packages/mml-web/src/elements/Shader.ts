import * as THREE from "three";

import { Audio } from "./Audio";
import { TransformableElement } from "./TransformableElement";
import { Video } from "./Video";
import { PositionAndRotation } from "../MMLScene";
import { AttributeHandler, parseFloatAttribute } from "../utils/attribute-handling";
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
const defaultShaderType = "mesh";
const defaultVideoWidth = 1;
const defaultVideoHeight = 1;
const defaultCollisionInterval = null;
const defaultVertexShader = `
 void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const defaultFragShader = `
  void main() {
    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
    }
    `;

const baseFragShader = `
#define STANDARD

#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif

uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;

#ifdef IOR
	uniform float ior;
#endif

#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;

	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif

	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif

#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif

#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif

#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;

	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif

	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif

#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;

	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif

varying vec3 vViewPosition;

#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

vec4 sRGBToLinear( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}

void main() {
	#include <clipping_planes_fragment>

  gl_FragColor = vec4(vUv, 0.0, 1.0);

  // insideMainBegin

  // insideMainEnd

  // Set color from user input shader
  gl_FragColor = vec4(gl_FragColor.rgb, opacity * gl_FragColor.a);

	vec4 diffuseColor = sRGBToLinear(gl_FragColor);
  gl_FragColor.rgb = pow(gl_FragColor.rgb, vec3(1.0 / 2.2));


	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;

	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
  #include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>

	// accumulation
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>

	// modulation
	#include <aomap_fragment>

	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;

	#include <transmission_fragment>

	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;

	#ifdef USE_SHEEN

		// Sheen energy compensation approximation calculation can be found at the end of
		// https://drive.google.com/file/d/1T0D1VSyR4AllqIJTQAraEIzjlb5h4FKH/view?usp=sharing
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );

		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecular;

	#endif

	#ifdef USE_CLEARCOAT

		float dotNVcc = saturate( dot( geometry.clearcoatNormal, geometry.viewDir ) );

		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );

		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + clearcoatSpecular * material.clearcoat;

	#endif

  #include <opaque_fragment>
	#include <tonemapping_fragment>
  #include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	// #include <dithering_fragment>
}`;
const baseVertexShader = `
#define STANDARD

varying vec3 vViewPosition;

#ifdef USE_TRANSMISSION

	varying vec3 vWorldPosition;

#endif

#include <common>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

void main() {
  vUv = uv;

  gl_PointSize = 5.0;

	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>

	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>

	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>

	vViewPosition = - mvPosition.xyz;

  // insideMainBegin

  // insideMainEnd

	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>

  #ifdef USE_TRANSMISSION

    vWorldPosition = worldPosition.xyz;

  #endif

}`;

const defaultAudioNode = null;
const defaultVideoNode = null;

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
      instance.props.width = parseFloatAttribute(newValue, defaultVideoWidth);
      instance.updateHeightAndWidth();
    },
    height: (instance, newValue) => {
      instance.props.height = parseFloatAttribute(newValue, defaultVideoHeight);
      instance.updateHeightAndWidth();
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

  private collideableHelper = new CollideableHelper(this);
  private clock = new THREE.Clock();

  private loadedShaderState: {
    audio?: THREE.Audio;

    // The difference between the document time and the local clock time.
    timeDifference: number;

    hasBuffers: boolean;
    bufferManager?: ShaderBufferManager;
  } | null = null;

  private loadedAudioState: {
    analyser: THREE.AudioAnalyser;
    fft: {
      maxValue: number;
      value: number;
    };
    fftSize: number;
  } | null = null;

  private uniforms: { [key: string]: { value: any } } = {};
  private baseUniforms = /* glsl */ `
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
    width: defaultVideoWidth as number | null,
    height: defaultVideoHeight as number | null,
    audio: defaultAudioNode as string | null,
    video: defaultVideoNode as string | null,
    probe: null as string | null,
    type: defaultShaderType as "mesh" | "points",
    collisionInterval: defaultCollisionInterval as string | null,
  };

  constructor() {
    super();
    this.createShaderMesh();

    // Setup default uniforms
    // TODO: change this to use an array
    this.uniforms.mouse = { value: new THREE.Vector2(0, 0) };
    this.uniforms.time = { value: 0.0 };
    this.uniforms.fft = { value: 0.0 };
    this.uniforms.fftTexture = { value: null };
    this.uniforms.resolution = {
      value: new THREE.Vector2(window.innerWidth, window.innerHeight),
    };
    this.uniforms.metalness = { value: 0.0 };
    this.uniforms.roughness = { value: 1.0 };
    this.uniforms.opacity = { value: 1.0 };

    this.uniforms = THREE.UniformsUtils.merge([
      this.uniforms,
      THREE.UniformsLib["lights"],
      THREE.UniformsLib["fog"],
    ]);
  }

  public createShaderMesh() {
    const geometry = new THREE.PlaneGeometry(1, 1, 50, 50);
    const material = new THREE.ShaderMaterial({
      vertexShader: baseVertexShader,
      fragmentShader: baseFragShader,
      uniforms: this.uniforms,
      side: THREE.DoubleSide,
      fog: true,
      lights: true,
      dithering: true,
      depthWrite: true,
      transparent: true,
    });

    material.onBeforeCompile = (shader) => {
      shader.uniforms = this.uniforms;

      shader.vertexShader = this.updateVertexShader();
      shader.fragmentShader = this.updateFragmentShader();

      shader.vertexShader = injectTop(shader.vertexShader, this.baseUniforms);
      shader.fragmentShader = injectTop(shader.fragmentShader, this.baseUniforms);
    };

    if (this.props.type === "points") {
      this.mesh = new THREE.Points(geometry, material);
    } else {
      this.mesh = new THREE.Mesh(geometry, material);
    }

    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.container.add(this.mesh);
  }

  /**
   * Create shader buffers for texture shaders i.e. m-shader children
   */
  public createShaderBuffers() {
    if (!this.loadedShaderState) {
      throw new Error("Trying to create shader buffers before loading shader");
    }

    const shaders = [...Array.from(this.querySelectorAll("m-shader"))] as Shader[];

    const textureMaterials: ShaderBufferItem[] = shaders.map((shader, i) => {
      const material = new THREE.ShaderMaterial({
        vertexShader: shader.props.vert,
        fragmentShader: shader.props.frag,
        uniforms: this.uniforms,
      });
      material.onBeforeCompile = (shader) => {
        shader.uniforms = this.uniforms;
        shader.vertexShader = injectTop(shader.vertexShader, this.baseUniforms);
        shader.vertexShader = injectInsideMain(shader.vertexShader, "vUv = uv;");
        shader.fragmentShader = injectTop(shader.fragmentShader, this.baseUniforms);
      };

      const readTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
      const writeTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);

      this.uniforms[ShaderBufferManager.getBufferKey(i + 1)] = {
        value: readTarget.texture,
      };

      return { material, readTarget, writeTarget };
    });

    this.loadedShaderState.bufferManager = new ShaderBufferManager(
      this.getScene().getRenderer() as THREE.WebGLRenderer,
    );
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
    requestAnimationFrame(this.render.bind(this));
    if (!this.uniforms || !this.loadedShaderState) return;

    // Add the time difference to the local clock time.
    this.uniforms.time.value = this.clock.getElapsedTime() + this.loadedShaderState.timeDifference;

    // Update fft data
    if (this.loadedAudioState) {
      // Update fftTexture
      this.loadedAudioState.analyser.getFrequencyData();
      this.uniforms.fftTexture.value.needsUpdate = true;

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

  private updateMaterial() {
    (this.mesh.material as THREE.ShaderMaterial).fragmentShader = this.updateFragmentShader();

    (this.mesh.material as THREE.ShaderMaterial).vertexShader = this.updateVertexShader();

    (this.mesh.material as THREE.ShaderMaterial).needsUpdate = true;
    this.syncShaderTime();
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
    this.addEventListener("collisionstart", (event: any) => null);
    this.addEventListener("collisionmove", this.watchCollisions);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.documentTimeListener = this.addDocumentTimeListener(this.documentTimeChanged.bind(this));
    this.loadedShaderState = {
      hasBuffers: false,
      timeDifference: 0,
    };

    // Check if shader is supposed to be a texture buffer
    const isShaderChild = this.container.parent?.name.startsWith("_Shader");

    if (isShaderChild) {
      this.container.remove(this.mesh);
      return;
    }

    // Check if shader has texture buffers
    // At this moment, the children won't be present in the scene yet, so we use querySelector
    this.loadedShaderState.hasBuffers = this.querySelectorAll("m-shader").length > 0;
    if (this.loadedShaderState.hasBuffers) {
      this.createShaderBuffers();
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
    // this.syncVideoTime();
  }

  protected disable() {
    this.collideableHelper.disable();
    // this.syncVideoTime();
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
}

type ShaderBufferItem = {
  material: THREE.ShaderMaterial;
  readTarget: THREE.WebGLRenderTarget;
  writeTarget: THREE.WebGLRenderTarget;
};

class ShaderBufferManager {
  private renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.OrthographicCamera;
  private geometry: THREE.PlaneGeometry;
  public targets = new Map<string, ShaderBufferItem>();
  private baseMaterial: THREE.MeshBasicMaterial;
  public mesh: THREE.Mesh;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.geometry = new THREE.PlaneGeometry(2, 2);
    this.baseMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.mesh = new THREE.Mesh(this.geometry, this.baseMaterial);
    this.scene.add(this.mesh);
  }

  public static getBufferKey(id: number) {
    return `prgm${id}Texture`;
  }

  public setBuffers(buffers: ShaderBufferItem[]) {
    buffers.forEach((b, i) => this.targets.set(ShaderBufferManager.getBufferKey(i + 1), b));
  }

  public renderTextures() {
    for (const [, { material, writeTarget }] of this.targets) {
      this.mesh.material = material;

      // Update uniforms
      for (const [key, { readTarget }] of this.targets) {
        material.uniforms[key].value = readTarget.texture;
      }

      this.renderer.setRenderTarget(writeTarget);
      this.renderer.render(this.scene, this.camera);
    }
    this.renderer.setRenderTarget(null);
    this.renderer.autoClear = true;

    this.swapBuffers();
  }

  private swapBuffer(prgmNum: string) {
    const buffer = this.targets.get(prgmNum);
    if (!buffer) return;

    const temp = buffer.readTarget;
    buffer.readTarget = buffer.writeTarget;
    buffer.writeTarget = temp;
  }

  public swapBuffers() {
    for (const [key] of this.targets) {
      this.swapBuffer(key);
    }
  }
}
