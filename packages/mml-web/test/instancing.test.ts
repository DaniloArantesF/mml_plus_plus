import { createSceneAttachedElement } from "./scene-test-utils";
import { Cube } from "../src/elements/Cube";
import { registerCustomElementsToWindow } from "../src/elements/register-custom-elements";

beforeAll(() => {
  registerCustomElementsToWindow(window);
});

describe("m-cube instanced", () => {
  test("test attachment to scene", () => {
    const { scene, element } = createSceneAttachedElement<Cube>("m-cube");

    expect(
      scene.getThreeScene().children[0 /* root container */].children[0 /* attachment container */]
        .children[0 /* element container */].children[0 /* element mesh */],
    ).toBe(element.getCube());

    element.setAttribute("instanced", "true");

    expect(
      scene.getThreeScene().children[0 /* root container */].children[1 /* instanced mesh */],
    ).toBe(scene.getInstancedMeshManager().cubeMesh);
    expect(scene.getInstancedMeshManager().cubeMesh.count).toBe(1);

    expect(
      scene.getThreeScene().children[0 /* root container */].children[0 /* attachment container */]
        .children[0 /* element container */].children[0 /* element mesh */],
    ).toBeUndefined();
  });
});
