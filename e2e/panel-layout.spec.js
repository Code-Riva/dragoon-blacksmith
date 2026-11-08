// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Token Blueprint & Token Overview — Equal Dimensions & Layout Verification', () => {
  const VIEWPORTS = [
    { name: 'Desktop (1440x900)', width: 1440, height: 900, isSideBySide: true },
    { name: 'Laptop (1366x768)', width: 1366, height: 768, isSideBySide: true },
    { name: 'Mobile (390x844)', width: 390, height: 844, isSideBySide: false },
  ];

  for (const vp of VIEWPORTS) {
    test(`verifies card dimensions, alignment and overflow at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const blueprint = page.locator('[data-testid="token-blueprint-card"]');
      const overview = page.locator('[data-testid="token-overview-card"]');

      await expect(blueprint).toBeVisible();
      await expect(overview).toBeVisible();

      const blueprintBox = await blueprint.boundingBox();
      const overviewBox = await overview.boundingBox();

      expect(blueprintBox).not.toBeNull();
      expect(overviewBox).not.toBeNull();

      if (!blueprintBox || !overviewBox) return;

      if (vp.isSideBySide) {
        // 1. Equal widths (within 2px tolerance for subpixel rounding)
        const widthDiff = Math.abs(blueprintBox.width - overviewBox.width);
        expect(widthDiff, `Expected widths to be equal: blueprint=${blueprintBox.width}, overview=${overviewBox.width}`).toBeLessThanOrEqual(2);

        // 2. Aligned top edges (within 2px)
        const topDiff = Math.abs(blueprintBox.y - overviewBox.y);
        expect(topDiff, `Expected top edges to align: blueprint.y=${blueprintBox.y}, overview.y=${overviewBox.y}`).toBeLessThanOrEqual(2);

        // 3. Aligned bottom edges (within 2px)
        const blueprintBottom = blueprintBox.y + blueprintBox.height;
        const overviewBottom = overviewBox.y + overviewBox.height;
        const bottomDiff = Math.abs(blueprintBottom - overviewBottom);
        expect(bottomDiff, `Expected bottom edges to align: blueprintBottom=${blueprintBottom}, overviewBottom=${overviewBottom}`).toBeLessThanOrEqual(2);

        // 4. Equal heights (within 2px)
        const heightDiff = Math.abs(blueprintBox.height - overviewBox.height);
        expect(heightDiff, `Expected heights to be equal: blueprint.h=${blueprintBox.height}, overview.h=${overviewBox.height}`).toBeLessThanOrEqual(2);
      } else {
        // Mobile: Stacked vertically
        expect(
          overviewBox.y,
          `Expected Overview to stack below Blueprint: overview.y=${overviewBox.y}, blueprint.bottom=${blueprintBox.y + blueprintBox.height}`
        ).toBeGreaterThanOrEqual(blueprintBox.y + blueprintBox.height - 2);
      }

      // 5. Verify neither card has internal scroll overflow
      const blueprintOverflow = await blueprint.evaluate((el) => ({
        hasHScroll: el.scrollWidth > el.clientWidth,
        hasVScroll: el.scrollHeight > el.clientHeight,
      }));
      expect(blueprintOverflow.hasHScroll, 'Blueprint card should not have horizontal overflow').toBe(false);
      expect(blueprintOverflow.hasVScroll, 'Blueprint card should not have vertical overflow').toBe(false);

      const overviewOverflow = await overview.evaluate((el) => ({
        hasHScroll: el.scrollWidth > el.clientWidth,
        hasVScroll: el.scrollHeight > el.clientHeight,
      }));
      expect(overviewOverflow.hasHScroll, 'Overview card should not have horizontal overflow').toBe(false);
      expect(overviewOverflow.hasVScroll, 'Overview card should not have vertical overflow').toBe(false);
    });
  }

  test('verifies single primary action button beneath Overview and none in Blueprint', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const blueprint = page.locator('[data-testid="token-blueprint-card"]');
    const overview = page.locator('[data-testid="token-overview-card"]');

    // Token Blueprint must NOT contain any Forge button
    const blueprintForgeButton = blueprint.getByRole('button', { name: /forge/i });
    await expect(blueprintForgeButton).toHaveCount(0);

    // Token Overview must contain exactly ONE primary "Review & Forge Token" button
    const overviewForgeButton = overview.getByRole('button', { name: /review & forge token/i });
    await expect(overviewForgeButton).toHaveCount(1);
    await expect(overviewForgeButton).toBeVisible();

    // Ethereum Sepolia must be clearly identified nearby
    await expect(overview.getByText('Deploys to Ethereum Sepolia testnet.')).toBeVisible();
  });

  test('verifies tightened comfortable vertical gaps between input fields on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Get the input fields container inside the blueprint card
    const nameField = page.locator('#token-name').locator('xpath=ancestor::div[contains(@class, "relative")]/..');
    const symbolField = page.locator('#token-symbol').locator('xpath=ancestor::div[contains(@class, "relative")]/..');
    const supplyField = page.locator('#token-supply').locator('xpath=ancestor::div[contains(@class, "relative")]/..');

    await expect(nameField).toBeVisible();
    await expect(symbolField).toBeVisible();
    await expect(supplyField).toBeVisible();

    const nameBox = await nameField.boundingBox();
    const symbolBox = await symbolField.boundingBox();
    const supplyBox = await supplyField.boundingBox();

    expect(nameBox).not.toBeNull();
    expect(symbolBox).not.toBeNull();
    expect(supplyBox).not.toBeNull();

    if (nameBox && symbolBox && supplyBox) {
      const gap1 = symbolBox.y - (nameBox.y + nameBox.height);
      const gap2 = supplyBox.y - (symbolBox.y + symbolBox.height);

      console.log('INPUT FIELD GAPS:', { gap1, gap2 });

      // Spacing should be tightened and comfortable (12px to 25px), not oversized (e.g. 50-80px)
      expect(gap1).toBeGreaterThanOrEqual(12);
      expect(gap1).toBeLessThanOrEqual(25);
      expect(gap2).toBeGreaterThanOrEqual(12);
      expect(gap2).toBeLessThanOrEqual(25);
    }

    // Verify "Token details" section replaces "Blueprint Allocation Architecture"
    const tokenDetails = page.locator('[data-testid="token-blueprint-card"]').getByText('Token details');
    await expect(tokenDetails).toBeVisible();
    await expect(page.getByText('Blueprint Allocation Architecture')).toHaveCount(0);
  });

  test('verifies "Advanced details" disclosure collapsed by default and keyboard accessible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const overview = page.locator('[data-testid="token-overview-card"]');
    const trigger = overview.getByRole('button', { name: /advanced details/i });
    const detailsContainer = overview.locator('#advanced-supply-details');

    // 1. Prominent total supply remains visible
    await expect(overview.getByText('1,000,000')).toBeVisible();

    // 2. Collapsed by default
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(detailsContainer).toHaveClass(/grid-rows-\[0fr\]/);

    // 3. Click to expand
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(detailsContainer).toHaveClass(/grid-rows-\[1fr\]/);

    // Verify raw base units and copy button are revealed
    const copyButton = overview.getByRole('button', { name: /copy base units/i });
    await expect(copyButton).toBeVisible();
    await expect(overview.getByText('1000000000000000000000000')).toBeVisible();

    // 4. Keyboard accessible toggle (Enter/Space)
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(detailsContainer).toHaveClass(/grid-rows-\[0fr\]/);

    await page.keyboard.press('Space');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(detailsContainer).toHaveClass(/grid-rows-\[1fr\]/);
  });

  test('verifies wallet selector rendering with local SVG icons and clean wallet outline', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Connect wallet button has clean wallet outline
    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    await expect(connectButton).toBeVisible();
    const walletOutlineSvg = connectButton.locator('svg');
    await expect(walletOutlineSvg).toBeVisible();

    // Open selector dialog
    await connectButton.click();
    const dialog = page.locator('div[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify all 4 provider icons use local SVGs from /wallets/
    const braveIcon = dialog.locator('img[src*="/wallets/brave.svg"]');
    const metamaskIcon = dialog.locator('img[src*="/wallets/metamask.svg"]');
    const phantomIcon = dialog.locator('img[src*="/wallets/phantom.svg"]');
    const coinbaseIcon = dialog.locator('img[src*="/wallets/coinbase.svg"]');

    await expect(braveIcon).toBeVisible();
    await expect(metamaskIcon).toBeVisible();
    await expect(phantomIcon).toBeVisible();
    await expect(coinbaseIcon).toBeVisible();
  });

  test('verifies "Config Valid" badge top-right placement on desktop and wrapping on mobile', async ({ page }) => {
    const screenshotDir = 'C:/Users/qamra/.gemini/antigravity-cli/brain/7d804547-700e-4d97-931c-0bdde68de8fc/screenshots';

    // Desktop check (1440x900)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const overview = page.locator('[data-testid="token-overview-card"]');
    const heading = overview.getByRole('heading', { name: 'Token Overview' });
    const badge = overview.locator('text=Config Valid');

    await expect(heading).toBeVisible();
    await expect(badge).toBeVisible();

    const headingBox = await heading.boundingBox();
    const badgeBox = await badge.boundingBox();

    expect(headingBox).not.toBeNull();
    expect(badgeBox).not.toBeNull();

    if (headingBox && badgeBox) {
      // Top-aligned with the heading area (top edge difference <= 8px)
      expect(Math.abs(badgeBox.y - headingBox.y)).toBeLessThanOrEqual(8);
      // Positioned to the right of the heading
      expect(badgeBox.x).toBeGreaterThan(headingBox.x + headingBox.width);
    }

    // Verify badge is a non-interactive span
    const tagName = await badge.evaluate((el) => el.tagName);
    expect(tagName).toBe('SPAN');

    await page.screenshot({ path: `${screenshotDir}/desktop-overview-badge.png`, fullPage: false });

    // Mobile check (390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const mobileBadge = page.locator('[data-testid="token-overview-card"]').locator('text=Config Valid');
    await expect(mobileBadge).toBeVisible();

    const mobileOverview = page.locator('[data-testid="token-overview-card"]');
    const mobileOverviewBox = await mobileOverview.boundingBox();
    const mobileBadgeBox = await mobileBadge.boundingBox();

    if (mobileOverviewBox && mobileBadgeBox) {
      // Badge stays within the overview card horizontal boundaries (no clipping/overflow)
      expect(mobileBadgeBox.x + mobileBadgeBox.width).toBeLessThanOrEqual(
        mobileOverviewBox.x + mobileOverviewBox.width + 2
      );
    }

    await page.screenshot({ path: `${screenshotDir}/mobile-overview-badge.png`, fullPage: false });
  });
});
