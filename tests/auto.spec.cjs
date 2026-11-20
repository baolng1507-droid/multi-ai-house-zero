const { test, expect, devices } = require("@playwright/test");

test.use({ ...devices["iPhone 15"], defaultBrowserType: "chromium", serviceWorkers: "block" });

test("hands off the actual draft, retries only the review and restores the final without saving the key", async ({ page }) => {
  const requests = [];
  const brief = "Viết kịch bản Mỡ kể chuyện. Mở đầu trong 3 giây.";
  const draft = "Bản nháp có chi tiết về Mỡ.";
  const final = "Mỡ giấu quả bóng của sen. Đây là bản cuối.";
  const key = "fixture-key";
  await page.route("https://openrouter.ai/api/v1/chat/completions", async (route) => {
    const request = route.request();
    requests.push({ body: request.postDataJSON(), authorization: request.headers().authorization });
    if (requests.length === 2) {
      await route.fulfill({ status: 429, json: { error: { code: 429 } } });
      return;
    }
    await route.fulfill({
      json: { choices: [{ message: { content: requests.length === 1 ? draft : final } }] },
    });
  });

  await page.goto("/");
  await page.getByRole("link", { name: "Chạy tự động với hai AI" }).click();
  await expect(page).toHaveURL(/\/#auto-hub$/);
  const panel = page.getByRole("region", { name: "Chạy tự động với hai AI" });
  await page.getByLabel("Việc cần làm").fill(brief);
  await page.getByRole("button", { name: "Chạy hai AI" }).click();
  await expect(panel.getByRole("status")).toContainText("Nhập khóa");
  expect(requests).toHaveLength(0);

  await page.getByLabel("Khóa OpenRouter").fill(key);
  await page.getByRole("button", { name: "Chạy hai AI" }).click();
  await expect(panel.getByRole("status")).toContainText("quá giới hạn");
  await expect(page.locator("#draft")).toHaveText(draft);
  expect(requests).toHaveLength(2);

  await page.reload();
  await expect(page.getByLabel("Khóa OpenRouter")).toHaveValue("");
  await expect(page.locator("#draft")).toHaveText(draft);
  await page.getByLabel("Khóa OpenRouter").fill(key);
  await page.getByRole("button", { name: "Chạy lại bước kiểm tra" }).click();
  await expect(page.locator("#final")).toHaveText(final);
  await expect(panel.getByRole("status")).toContainText("Đã lưu bản cuối");

  expect(requests.map(({ body }) => body.model)).toEqual([
    "google/gemma-4-26b-a4b-it:free",
    "openai/gpt-oss-20b:free",
    "openai/gpt-oss-20b:free",
  ]);
  for (const { body, authorization } of requests) {
    expect(authorization).toBe("Bearer " + key);
    expect(body.provider.max_price).toEqual({ prompt: 0, completion: 0 });
  }
  expect(JSON.parse(requests[2].body.messages[1].content)).toEqual({ yeuCau: brief, banNhap: draft });
  await page.reload();
  await expect(page.locator("#final")).toHaveText(final);
  await expect(page.getByLabel("Khóa OpenRouter")).toHaveValue("");
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(key);
});
