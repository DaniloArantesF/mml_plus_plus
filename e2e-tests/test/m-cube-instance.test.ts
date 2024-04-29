describe("m-cube", () => {
  test("instanced attribute", async () => {
    const page = await __BROWSER_GLOBAL__.newPage();

    await page.setViewport({ width: 1024, height: 1024 });

    await page.goto("http://localhost:7079/m-cube-instance-test.html/reset");

    await page.waitForSelector("m-cube[color='red']");

    expect(
      await page.evaluate(() => {
        const cube = (document.querySelector("m-cube") as any).getScene();
        return cube.renderer.info.render.calls as number;
      }),
    ).toBe(6);

    // Switch to instanced
    {
      await page.evaluate(() => {
        const cubes = document.querySelectorAll("m-cube");
        for (const cube of cubes) {
          cube.setAttribute("instanced", "true");
        }
      });
    }

    expect(
      await page.evaluate(() => {
        const cube = (document.querySelector("m-cube") as any).getScene();
        return cube.renderer.info.render.calls as number;
      }),
    ).toBe(1);

    await page.close();
  }, 60000);
});
