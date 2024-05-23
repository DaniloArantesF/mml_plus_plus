import * as THREE from "three";

import { createSceneAttachedElement } from "./scene-test-utils";
// import { testElementSchemaMatchesObservedAttributes } from "./schema-utils";
import { registerCustomElementsToWindow } from "../src/elements/register-custom-elements";
import { Shader } from "../src/elements/Shader";

beforeAll(() => {
  registerCustomElementsToWindow(window);
});

describe("m-shader", () => {
  // test("observes the schema-specified attributes", () => {
  //   // FIXME: add schema attributes
  //   const schema = testElementSchemaMatchesObservedAttributes("m-shader", Shader);
  //   expect(schema.name).toEqual(Shader.tagName);
  // });

  test("test attachment to scene", () => {
    const { scene, element } = createSceneAttachedElement<Shader>("m-shader");
    expect(
      scene.getThreeScene().children[0 /* root container */].children[0 /* attachment container */]
        .children[0 /* element container */].children[0 /* element mesh */],
    ).toBe(element.getShader());
  });

  test("sx, sy, sz", () => {
    const { element } = createSceneAttachedElement<Shader>("m-shader");
    expect(element.getContainer().scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(element.getShader()!.scale).toMatchObject({ x: 1, y: 1, z: 1 });

    element.setAttribute("sx", "5");
    element.setAttribute("sy", "6");
    element.setAttribute("sz", "7");

    // Setting scale attributes should affect the container of the element, but not the (sphere) mesh itself
    expect(element.getContainer().scale).toMatchObject({ x: 5, y: 6, z: 7 });
    expect(element.getShader()!.scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(element.getShader()!.getWorldScale(new THREE.Vector3())).toMatchObject({
      x: 5,
      y: 6,
      z: 7,
    });

    // Removing the scale should return the element to its default scale
    element.removeAttribute("sx");
    element.removeAttribute("sy");
    element.removeAttribute("sz");
    expect(element.getContainer().scale).toMatchObject({ x: 1, y: 1, z: 1 });
    expect(element.getShader()!.scale).toMatchObject({ x: 1, y: 1, z: 1 });
  });
});
