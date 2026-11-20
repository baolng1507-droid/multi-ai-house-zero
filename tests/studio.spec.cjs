const { readFile } = require("node:fs/promises");
const { test, expect, devices } = require("@playwright/test");
test.use({ ...devices["iPhone 15"], defaultBrowserType: "chromium", serviceWorkers: "block" });

test("renders the reviewed storyboard into a playable vertical video file", async ({ page }) => {
  const storyboard = {
    title: "Một buổi chiều với Mỡ",
    scenes: [
      { headline: "Sen về rồi.", caption: "Mỡ nghe tiếng cửa.", seconds: 2, color: "mint" },
      { headline: "Nghỉ đi sen.", caption: "Mỡ nằm cạnh.", seconds: 2, color: "rose" },
    ],
  };
  let calls = 0;
  await page.route("https://openrouter.ai/api/v1/chat/completions", async (route) => {
    calls++;
    expect(route.request().postDataJSON().messages[0].content).toContain("JSON hợp lệ");
    await route.fulfill({ json: { choices: [{ message: { content: JSON.stringify(storyboard) } }] } });
  });

  await page.goto("/");
  await page.getByLabel("Sản phẩm cần bàn giao").selectOption("video");
  await page.getByLabel("Việc cần làm").fill("Làm clip minh họa hai cảnh về Mỡ.");
  await page.getByLabel("Khóa OpenRouter").fill("fixture-key");
  await page.getByRole("button", { name: "Giao cho hai phòng" }).click();
  await expect(page.locator("#studio-status")).toContainText("Phân cảnh của hai phòng");
  expect(calls).toBe(2);
  await page.getByRole("button", { name: "Xuất video" }).click();
  await expect(page.locator("#studio-status")).toContainText("Đã xuất clip dọc", { timeout: 12000 });
  await expect.poll(() => page.locator("#studio video").evaluate(video => [video.videoWidth, video.videoHeight]))
    .toEqual([720, 1280]);

  const downloaded = page.waitForEvent("download");
  await page.getByRole("link", { name: "Tải video" }).click();
  const file = await downloaded;
  const bytes = await readFile(await file.path());
  expect(bytes.length).toBeGreaterThan(10000);
  if (file.suggestedFilename().endsWith(".mp4")) expect(bytes.toString("ascii", 4, 8)).toBe("ftyp");
  else expect(bytes.subarray(0, 4).toString("hex")).toBe("1a45dfa3");
});
