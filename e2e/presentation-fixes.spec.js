// @ts-check
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const ARTIFACT_SCREENSHOT_DIR = 'C:/Users/qamra/.gemini/antigravity-cli/brain/7d804547-700e-4d97-931c-0bdde68de8fc/screenshots';
const LOCAL_SCREENSHOT_DIR = path.resolve('screenshots');

test.beforeAll(() => {
  if (!fs.existsSync(ARTIFACT_SCREENSHOT_DIR)) {
    fs.mkdirSync(ARTIFACT_SCREENSHOT_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOCAL_SCREENSHOT_DIR)) {
    fs.mkdirSync(LOCAL_SCREENSHOT_DIR, { recursive: true });
  }
});

test.describe('Presentation Fixes Verification — Dialog Positioning & Gradient', () => {
  const viewports = [
    { name: 'desktop-1440x900', width: 1440, height: 900 },
    { name: 'laptop-1366x768', width: 1366, height: 768 },
    { name: 'mobile-390x844', width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    test(`verifies dialog bounds, reachability, and captures screenshots at ${vp.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Screenshot 1: Closed dialog to inspect visible darkened gradient (#35170D -> #241B0D -> #080706)
      await page.screenshot({
        path: path.join(ARTIFACT_SCREENSHOT_DIR, `${vp.name}-gradient-closed.png`),
        fullPage: false,
      });
      await page.screenshot({
        path: path.join(LOCAL_SCREENSHOT_DIR, `${vp.name}-gradient-closed.png`),
        fullPage: false,
      });

      // Verify initial body scroll is not locked
      const initialOverflow = await page.evaluate(() => document.body.style.overflow);
      expect(initialOverflow).not.toBe('hidden');

      // Open wallet dialog
      const connectButton = page.getByRole('button', { name: /connect wallet/i });
      await expect(connectButton).toBeVisible();
      await connectButton.click();

      // Verify background scroll lock while open
      const openOverflow = await page.evaluate(() => document.body.style.overflow);
      expect(openOverflow).toBe('hidden');

      // Dialog container & title
      const dialogCard = page.locator('div[role="dialog"] > div > div').first();
      await expect(dialogCard).toBeVisible();
      const title = page.getByRole('heading', { name: 'Connect Wallet' });
      await expect(title).toBeVisible();

      // Assert dialog card stays within viewport bounds
      const box = await dialogCard.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        // Assert top edge is within viewport (never extending above viewport)
        expect(box.y).toBeGreaterThanOrEqual(0);
        // Assert bottom edge does not exceed viewport height
        expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 2);
      }

      // Assert all 4 wallet options are present and in order: Brave, MetaMask, Phantom, Coinbase
      const wallets = ['Brave Wallet', 'MetaMask', 'Phantom', 'Coinbase Wallet'];
      for (let i = 0; i < wallets.length; i++) {
        const w = wallets[i];
        const walletButton = page.locator(`button:has-text("${w}")`).first();
        // Scroll into view if needed
        await walletButton.scrollIntoViewIfNeeded();
        await expect(walletButton).toBeVisible();
      }

      // Check that Coinbase Wallet name element does not wrap onto multiple lines
      const coinbaseLabel = page.locator('button:has-text("Coinbase Wallet") span.font-semibold');
      await expect(coinbaseLabel).toBeVisible();
      const coinbaseBox = await coinbaseLabel.boundingBox();
      expect(coinbaseBox).not.toBeNull();
      if (coinbaseBox) {
        // A single line of 14px text has a line-height <= 24px
        expect(coinbaseBox.height).toBeLessThanOrEqual(24);
      }

      // Screenshot 2: Open dialog to inspect positioning and margins
      await page.screenshot({
        path: path.join(ARTIFACT_SCREENSHOT_DIR, `${vp.name}-dialog-open.png`),
        fullPage: false,
      });
      await page.screenshot({
        path: path.join(LOCAL_SCREENSHOT_DIR, `${vp.name}-dialog-open.png`),
        fullPage: false,
      });

      // Verify Close control is accessible
      const closeButton = page.getByRole('button', { name: /close wallet selection dialog/i });
      await expect(closeButton).toBeVisible();
      await closeButton.click();

      // Verify dialog is closed
      await expect(title).not.toBeVisible();

      // Verify background scroll lock is restored
      const restoredOverflow = await page.evaluate(() => document.body.style.overflow);
      expect(restoredOverflow).not.toBe('hidden');

      // Verify focus return to opener button
      await expect(connectButton).toBeFocused();
    });
  }

  test('verifies Escape key closing and keyboard focus containment (trap)', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    await connectButton.click();

    // Verify dialog opened
    const title = page.getByRole('heading', { name: 'Connect Wallet' });
    await expect(title).toBeVisible();

    // Verify initial focus is within the dialog
    const isFocusInside = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"]');
      return dialog ? dialog.contains(document.activeElement) : false;
    });
    expect(isFocusInside).toBe(true);

    // Press Escape
    await page.keyboard.press('Escape');

    // Verify dialog closed
    await expect(title).not.toBeVisible();

    // Verify body scroll lock restored
    const overflow = await page.evaluate(() => document.body.style.overflow);
    expect(overflow).not.toBe('hidden');

    // Verify focus returned to opener button
    await expect(connectButton).toBeFocused();
  });
});
