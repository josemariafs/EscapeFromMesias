/**
 * Capture README screenshots at desktop resolution in English.
 * Usage: node scripts/capture-readme-screenshots.mjs [baseUrl]
 */
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4173';
const outDir = path.resolve('docs/screenshots');

async function waitForApp(page) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () => {
      const text = document.body.textContent ?? '';
      return !text.includes('Loading quests') && !text.includes('Cargando misiones');
    },
    { timeout: 120_000 },
  );
  await page.waitForTimeout(800);
}

async function setEnglish(page) {
  await page.locator('.lang-control select').selectOption('en');
  await page.waitForFunction(
    () => {
      const text = document.body.textContent ?? '';
      return !text.includes('Loading quests') && !text.includes('Cargando misiones');
    },
    { timeout: 120_000 },
  );
  await page.waitForTimeout(800);
}

async function screenshot(page, name) {
  const file = path.join(outDir, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log('Wrote', file);
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });

  await page.addInitScript(() => {
    localStorage.clear();
  });

  await waitForApp(page);
  await setEnglish(page);

  // Side Quests (default sub-tab)
  await page.getByRole('button', { name: /^Side Quest/ }).click();
  await page.waitForTimeout(300);
  await screenshot(page, 'side-quests.png');

  // Story campaign
  await page.getByRole('button', { name: /^Story/ }).click();
  await page.waitForTimeout(300);
  await screenshot(page, 'story-campaign.png');

  // Quest detail (Side Quest + select Shooting Cans)
  await page.getByRole('button', { name: /^Side Quest/ }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Shooting Cans/ }).first().click();
  await page.waitForTimeout(300);
  await screenshot(page, 'quest-detail.png');

  // Active by map
  await page.getByRole('button', { name: /Shooting Cans/ }).first().getByRole('button', { name: 'Start' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /^Active/ }).click();
  await page.waitForTimeout(300);
  await screenshot(page, 'active-by-map.png');

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
