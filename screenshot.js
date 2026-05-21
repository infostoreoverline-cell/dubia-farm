const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();

  await page.goto('http://localhost:8080');

  // Wait for rendering
  await page.waitForTimeout(6000);

  // Click 'Censimento' tab using force
  const censusTab = await page.locator('button[data-target="census"]');
  await censusTab.click({ force: true });

  // Wait a bit
  await page.waitForTimeout(1000);

  // Take full page screenshot
  await page.screenshot({ path: 'frontend_screenshot.png', fullPage: true });

  await browser.close();
})();
