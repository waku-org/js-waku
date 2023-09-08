import { expect, test } from "@playwright/test";

test("has title Web Chat title", async ({ page }) => {
  await page.goto("");

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle("Waku v2 chat app");
});
