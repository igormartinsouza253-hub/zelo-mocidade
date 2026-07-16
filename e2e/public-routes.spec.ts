import { expect, test } from "@playwright/test";

test("authentication route loads without an application error", async ({ page }) => {
  await page.goto("/auth");

  await expect(page.locator("body")).toBeVisible();
  await expect(page.getByText(/erro inesperado/i)).toHaveCount(0);
});
