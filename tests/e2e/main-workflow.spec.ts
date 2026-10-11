import { expect, test } from "@playwright/test";

/**
 * Main user journey on an Android-sized screen:
 * profile → weekly plan → replace a meal → add pantry food → consolidated list
 * → tick items → close and reopen → everything persisted.
 */
test("household can plan a week, adjust it, and shop from a consolidated list", async ({ page, context }) => {
  await page.goto("/");
  await page.waitForURL("**/onboarding");

  // 1. Create a household profile
  await page.getByRole("button", { name: "Set up my household" }).click();
  await page.getByRole("button", { name: "Increase adults" }).click(); // 3 adults
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Lidl" }).click();
  const budget = page.getByLabel("Weekly food budget");
  await budget.fill("75");
  await page.getByRole("button", { name: "Next" }).click(); // meals
  await page.getByRole("button", { name: "Next" }).click(); // time
  await page.getByRole("button", { name: "Next" }).click(); // diets
  await page.getByRole("button", { name: "Peanuts", exact: true }).click();
  await expect(page.getByText("Please double-check labels")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click(); // tastes
  await page.getByRole("button", { name: "Next" }).click(); // style

  // 2. Generate a weekly meal plan
  await page.getByRole("button", { name: "Create my meal plan" }).click();
  await page.waitForURL("**/plan**");
  const cards = page.locator("article[aria-label^='dinner:']");
  await expect(cards.first()).toBeVisible();
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  await expect(page.getByText(/of £75\.00 budget/)).toBeVisible();

  // 3. Replace a meal (and check the others are untouched)
  const namesBefore = await cards.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  await cards.first().getByRole("button", { name: "Swap" }).click();
  const sheet = page.getByRole("dialog", { name: "Swap this meal" });
  await expect(sheet).toBeVisible();
  const choice = sheet.locator("ul li button").first();
  const chosenName = (await choice.locator("span.font-semibold").first().textContent())!.trim();
  await choice.click();
  await expect(page.getByText(`Swapped in ${chosenName}`)).toBeVisible();
  const namesAfter = await cards.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  expect(namesAfter[0]).toBe(`dinner: ${chosenName}`);
  expect(namesAfter.slice(1)).toEqual(namesBefore.slice(1));

  // 4. Consolidated shopping list
  await page.getByRole("link", { name: "Shopping List", exact: true }).click();
  await page.waitForURL("**/shopping");
  await expect(page.getByText("Demo prices").first()).toBeVisible();
  const firstItem = page.locator("ul input[type=checkbox]").first();
  await expect(firstItem).toBeVisible();
  const itemLabel = (await firstItem.getAttribute("aria-label"))!; // "Got <name>"
  const itemName = itemLabel.replace(/^Got /, "");

  // 5. Add that ingredient to My Food ("I have some") – it should come off the list
  await page.getByRole("link", { name: "My Food", exact: true }).click();
  await page.getByRole("button", { name: "Add food" }).click();
  await page.getByLabel("What is it?").fill(itemName);
  await expect(page.getByText(/Matched to/)).toBeVisible();
  await page.getByRole("button", { name: "Cupboard" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(`Added ${itemName}`)).toBeVisible();

  await page.getByRole("link", { name: "Shopping List", exact: true }).click();
  await expect(page.getByLabel(itemLabel, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Check you have" })).toContainText(new RegExp(itemName, "i"));

  // 6. Tick off shopping items
  const boxes = page.locator("ul input[type=checkbox]");
  const toTick = boxes.nth(0);
  const tickedLabel = (await toTick.getAttribute("aria-label"))!;
  await toTick.check();
  await expect(page.getByLabel(tickedLabel, { exact: true })).toBeChecked();
  await expect(page.getByText(/items left/)).toBeVisible();

  // 7. Close and reopen the app – everything persists
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto("/shopping");
  await expect(reopened.getByLabel(tickedLabel, { exact: true })).toBeChecked();
  await expect(reopened.getByLabel(itemLabel, { exact: true })).toHaveCount(0);
  await reopened.goto("/plan");
  await expect(reopened.locator("article[aria-label^='dinner:']").first()).toHaveAttribute("aria-label", `dinner: ${chosenName}`);
  await reopened.goto("/food");
  await expect(reopened.getByText(itemName, { exact: false }).first()).toBeVisible();
  await reopened.goto("/settings");
  await expect(reopened.getByText("Lidl · £75.00 a week")).toBeVisible();
});

test("allergy exclusions hold across the recipe library", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Skip – use sensible defaults" }).click();
  await page.waitForURL("**/plan**");
  await page.goto("/settings");
  await page.getByRole("button", { name: /Diets, allergies/ }).click();
  await page.getByRole("button", { name: "Fish", exact: true }).click();
  await page.goto("/recipes/shepherds-pie");
  await expect(page.getByText("Not suitable for your household")).toBeVisible();
  await expect(page.getByText("Contains fish")).toBeVisible();
  await page.goto("/recipes");
  await expect(page.getByRole("link", { name: /Classic shepherd's pie/ })).toHaveCount(0);
});
