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
  const panel = page.getByRole("region", { name: "Điều hành công ty AI" });
  const map = panel.getByRole("group", { name: "Bản đồ công ty AI" });
  await expect(map.getByRole("button")).toHaveCount(4);
  await map.getByRole("button", { name: /Phòng kiểm định/ }).click();
  await expect(panel.locator("#room-detail-title")).toHaveText("Phòng kiểm định");
  await page.getByLabel("Việc cần làm").fill(brief);
  await page.getByRole("button", { name: "Giao cho hai phòng" }).click();
  await expect(panel.getByRole("status")).toContainText("Nhập khóa");
  expect(requests).toHaveLength(0);

  await page.getByLabel("Khóa OpenRouter").fill(key);
  await page.getByRole("button", { name: "Giao cho hai phòng" }).click();
  await expect(panel.getByRole("status")).toContainText("quá giới hạn");
  await expect(page.locator("#draft")).toHaveText(draft);
  await expect(panel.locator("#room-writer .room-state")).toHaveText("Đã chuyển bản nháp");
  await expect(panel.locator("#room-reviewer .room-state")).toHaveText("Cần thử lại");
  await expect(panel.locator("#room-detail-state")).toHaveText("Cần thử lại");
  expect(requests).toHaveLength(2);

  await page.reload();
  await expect(page.getByLabel("Khóa OpenRouter")).toHaveValue("");
  await expect(page.locator("#draft")).toHaveText(draft);
  await page.getByLabel("Khóa OpenRouter").fill(key);
  await page.getByRole("button", { name: "Chạy lại bước kiểm tra" }).click();
  await expect(page.locator("#final")).toHaveText(final);
  await expect(panel.getByRole("status")).toContainText("Đã lưu bản cuối");
  await expect(panel.locator("#room-reviewer .room-state")).toHaveText("Đã bàn giao");
  await map.getByRole("button", { name: /Kho bàn giao/ }).click();
  await expect(panel.locator("#room-detail-state")).toHaveText("Có bản cuối");
  await panel.getByRole("link", { name: "Mở kết quả đã lưu" }).click();
  await expect(page).toHaveURL(/#results$/);

  expect(requests.map(({ body }) => body.model)).toEqual([
    "google/gemma-4-26b-a4b-it:free",
    "nvidia/nemotron-3.5-lightning:free",
    "nvidia/nemotron-3.5-lightning:free",
  ]);
  expect(requests[0].body.models).toBeUndefined();
  expect(requests[2].body.models).toEqual([
    "nvidia/nemotron-3.5-lightning:free",
    "nvidia/nemotron-3.5-super-vl:free",
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

test("failed new writer job never inherits previous completed room states, including after reload", async ({ page }) => {
  let calls = 0;
  await page.route("https://openrouter.ai/api/v1/chat/completions", async (route) => {
    calls += 1;
    if (calls === 3) {
      await route.fulfill({ status: 429, json: { error: { code: 429 } } });
      return;
    }
    await route.fulfill({ json: { choices: [{ message: { content: calls === 1 ? "Draft A" : "Final A" } }] } });
  });
  await page.goto("/");
  await page.getByLabel("Khóa OpenRouter").fill("fixture-key");
  await page.getByLabel("Việc cần làm").fill("First task");
  await page.getByRole("button", { name: "Giao cho hai phòng" }).click();
  await expect(page.locator("#final")).toHaveText("Final A");
  await page.getByLabel("Việc cần làm").fill("Second task");
  await page.getByRole("button", { name: "Giao cho hai phòng" }).click();
  await expect(page.locator("#status")).toContainText("quá giới hạn");
  await expect(page.locator("#room-writer .room-state")).toHaveText("Cần thử lại");
  await expect(page.locator("#room-reviewer .room-state")).toHaveText("Chờ bản nháp");
  await expect(page.locator("#room-delivery .room-state")).toHaveText("Chờ bản cuối");
  await expect(page.locator("#results")).toBeHidden();
  await page.reload();
  await expect(page.locator("#room-writer .room-state")).toHaveText("Chờ soạn");
  await expect(page.locator("#room-reviewer .room-state")).toHaveText("Chờ bản nháp");
  await expect(page.locator("#status")).toContainText("chưa có bản nháp");
  await expect(page.locator("#final")).toBeHidden();
  expect(calls).toBe(3);
});


test("invalid video review cannot be delivered and can be retried from saved draft", async ({ page }) => {
  let calls = 0;
  const valid = JSON.stringify({title:"Mỡ kể chuyện",scenes:[{headline:"Mỡ chờ sen",caption:"Sen về rồi!",seconds:3,color:"mint"},{headline:"Mỡ vui",caption:"Một ngày bình yên",seconds:3,color:"rose"}]});
  await page.route("https://openrouter.ai/api/v1/chat/completions", async route => {
    calls++;
    await route.fulfill({json:{choices:[{message:{content:calls===1?valid:calls===2?"Not valid JSON":valid}}]}});
  });
  await page.goto("/");
  await page.getByLabel("Khóa OpenRouter").fill("fixture-key");
  await page.locator("#work-kind").selectOption("video");
  await page.getByLabel("Việc cần làm").fill("Làm video dọc về Mỡ");
  await page.getByRole("button",{name:"Giao cho hai phòng"}).click();
  await expect(page.locator("#status")).toContainText("sai định dạng video");
  await expect(page.locator("#final")).toBeHidden();
  await expect(page.locator("#draft")).toHaveText(valid);
  await page.reload();
  await page.getByLabel("Khóa OpenRouter").fill("fixture-key");
  await page.getByRole("button",{name:"Chạy lại bước kiểm tra"}).click();
  await expect(page.locator("#final")).toHaveText(valid);
  expect(calls).toBe(3);
});


test("filtered reviewer output is not delivered even when the provider returns text", async ({ page }) => {
  let calls = 0;
  await page.route("https://openrouter.ai/api/v1/chat/completions", async route => {
    calls++;
    await route.fulfill({ json: { choices: [{
      finish_reason: calls === 2 ? "content_filter" : "stop",
      message: { content: calls === 1 ? "Safe draft" : "Filtered partial output" }
    }] } });
  });
  await page.goto("/");
  await page.getByLabel("Khóa OpenRouter").fill("fixture-key");
  await page.getByLabel("Việc cần làm").fill("Write a short script");
  await page.getByRole("button", { name: "Giao cho hai phòng" }).click();
  await expect(page.locator("#status")).toContainText("đã lọc nội dung");
  await expect(page.locator("#draft")).toHaveText("Safe draft");
  await expect(page.locator("#final")).toBeHidden();
  await expect(page.getByRole("button", { name: "Chạy lại bước kiểm tra" })).toBeVisible();
  expect(calls).toBe(2);
});
