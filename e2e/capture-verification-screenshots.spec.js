// @ts-check
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const ARTIFACT_DIR = 'C:/Users/qamra/.gemini/antigravity-cli/brain/025b754c-2e1e-47f0-be72-85a2dfdd5132/screenshots';
const LOCAL_DIR = path.resolve('screenshots');

test.beforeAll(() => {
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOCAL_DIR)) {
    fs.mkdirSync(LOCAL_DIR, { recursive: true });
  }
});

test('captures desktop verification screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // 1. Desktop default state (collapsed advanced details, tightened form spacing)
  await page.screenshot({ path: path.join(LOCAL_DIR, 'desktop-default-view.png'), fullPage: false });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'desktop-default-view.png'), fullPage: false });

  // 2. Desktop with advanced details expanded
  const trigger = page.locator('[data-testid="token-overview-card"]').getByRole('button', { name: /advanced details/i });
  await trigger.click();
  await page.waitForTimeout(300); // allow transition
  await page.screenshot({ path: path.join(LOCAL_DIR, 'desktop-advanced-details-expanded.png'), fullPage: false });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'desktop-advanced-details-expanded.png'), fullPage: false });

  // 3. Desktop with Connect Wallet selector open
  const connectButton = page.getByRole('button', { name: /connect wallet/i });
  await connectButton.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(LOCAL_DIR, 'desktop-wallet-selector-open.png'), fullPage: false });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'desktop-wallet-selector-open.png'), fullPage: false });
});

test('captures mobile verification screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // 4. Mobile default view
  await page.screenshot({ path: path.join(LOCAL_DIR, 'mobile-default-view.png'), fullPage: false });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mobile-default-view.png'), fullPage: false });

  // 5. Mobile with advanced details expanded
  const trigger = page.locator('[data-testid="token-overview-card"]').getByRole('button', { name: /advanced details/i });
  await trigger.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(LOCAL_DIR, 'mobile-advanced-details-expanded.png'), fullPage: false });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mobile-advanced-details-expanded.png'), fullPage: false });

  // 6. Mobile with Connect Wallet selector open
  const connectButton = page.getByRole('button', { name: /connect wallet/i });
  await connectButton.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(LOCAL_DIR, 'mobile-wallet-selector-open.png'), fullPage: false });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mobile-wallet-selector-open.png'), fullPage: false });
});
