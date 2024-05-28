import { takeAndCompareScreenshot } from "./testing-utils";

const labelCoords = {
  addCubes: {
    x: 150,
    y: 110,
  },
  removeCubes: {
    x: 325,
    y: 110,
  },
  minus: {
    x: 130,
    y: 215,
  },
  plus: {
    x: 365,
    y: 215,
  },
};

const cubeCoords = [
  { x: 663, y: 885 },
  { x: 585, y: 885 },
  { x: 365, y: 885 },
  { x: 505, y: 885 },
  { x: 220, y: 885 },
];

describe("instancing", () => {
  test("instanced mesh visible and clickable", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });
    await page.goto("http://localhost:7079/m-cube-instanced-test.html/reset");

    await page.waitForSelector("#addCubes");
    await page.click("canvas", { offset: labelCoords.addCubes });

    await Promise.all(
      cubeCoords.map(async (coord) => await page.click("canvas", { offset: coord })),
    );

    await page.waitForSelector("[data-instanced='5']");
    await takeAndCompareScreenshot(page);

    await page.close();
  }, 60000);

  test("instanced mesh can be removed in any order", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });
    await page.goto("http://localhost:7079/m-cube-instanced-test.html/reset");

    // Add 10 cubes
    await page.waitForSelector("#addCubes");
    await page.click("canvas", { offset: labelCoords.addCubes });

    await Promise.all(
      cubeCoords.map(async (coord) => await page.click("canvas", { offset: coord })),
    );

    await page.waitForSelector("[data-instanced='5']");
    await takeAndCompareScreenshot(page);

    // Set value to 1
    await Promise.all(
      Array.from({ length: 9 }).map(
        async () => await page.click("canvas", { offset: labelCoords.minus }),
      ),
    );
    await page.waitForSelector("[data-value='1']");

    // Unregister some cubes such that the indexes need to be shifted
    for (let i = 0; i < 8; i++) {
      await page.click("canvas", { offset: labelCoords.removeCubes });
      await page.waitForSelector(`[data-cube-count='${9 - i}']`);
      await takeAndCompareScreenshot(page);
    }

    await page.close();
  }, 60000);

  test("instanced draw calls", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-cube-instanced-test.html/reset");

    // Add 10 cubes
    await page.waitForSelector("#addCubes");
    await page.click("canvas", { offset: labelCoords.addCubes });

    await page.waitForSelector("[data-cube-count='10']");

    const getDrawCalls = () => {
      const cube = (document.querySelector("m-cube") as any)?.getScene();
      const labelCount = document.querySelectorAll("m-label").length;
      return (cube.renderer.info.render.calls - labelCount) as number;
    };

    expect(await page.evaluate(getDrawCalls)).toBe(10);

    await Promise.all(
      cubeCoords.map(async (coord) => await page.click("canvas", { offset: coord })),
    );

    await page.waitForSelector(`[data-instanced='${cubeCoords.length}']`);

    expect(await page.evaluate(getDrawCalls)).toBe(10 - cubeCoords.length + 1);

    await page.close();
  }, 60000);
});
