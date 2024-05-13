import * as THREE from "three";

export type ShaderBufferItem = {
  material: THREE.ShaderMaterial;
  readTarget: THREE.WebGLRenderTarget;
  writeTarget: THREE.WebGLRenderTarget;
};

export default class ShaderBufferManager {
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

  public dispose() {
    for (const [, { readTarget, writeTarget }] of this.targets) {
      readTarget.dispose();
      writeTarget.dispose();
    }
  }
}
