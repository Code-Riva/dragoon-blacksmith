// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Dragoon’s Blacksmith — Presentation & Branding Verification', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', (err) => console.log('BROWSER ERROR:', err.message));
    await page.goto('/');
  });

  test('verifies updated branding, headings, and metadata', async ({ page }) => {
    // Page Title
    await expect(page).toHaveTitle(/Dragoon’s Blacksmith/);

    // Main Heading & Subtitle
    const heading = page.locator('h1');
    await expect(heading).toHaveText(/Dragoon’s Blacksmith/i);

    const subtitle = page.getByText('Create a fixed-supply ERC-20 token on Ethereum Sepolia.');
    await expect(subtitle).toBeVisible();

    // Two-Column Headings: Token Blueprint & Token Overview
    const blueprintHeading = page.getByRole('heading', { name: 'Token Blueprint' });
    await expect(blueprintHeading).toBeVisible();

    const overviewHeading = page.getByRole('heading', { name: 'Token Overview' });
    await expect(overviewHeading).toBeVisible();

    // Deployment state callout reflects actual disconnected wallet state
    const deploymentState = page.getByText('Connect a wallet to continue');
    await expect(deploymentState).toBeVisible();

    // Exact Footer Signature
    const footerSig = page.getByText('Independent Portfolio Demo — by Qamra Ariva.');
    await expect(footerSig).toBeVisible();
  });

  test('verifies live blueprint preview updates and working reset', async ({ page }) => {
    const nameInput = page.locator('#token-name');
    const symbolInput = page.locator('#token-symbol');
    const supplyInput = page.locator('#token-supply');

    // Fill new custom token parameters
    await nameInput.fill('Aethelgard Guild');
    await symbolInput.fill('AGRD');
    await supplyInput.fill('5000000');

    // Check preview updates
    await expect(page.getByRole('heading', { name: 'Aethelgard Guild' })).toBeVisible();
    await expect(page.locator('text=AGRD').first()).toBeVisible();
    await expect(page.locator('text=5,000,000').first()).toBeVisible();

    // Click Reset
    const resetButton = page.getByRole('button', { name: /reset/i });
    await resetButton.click();

    // Verify restored defaults
    await expect(nameInput).toHaveValue('Dragoon Token');
    await expect(symbolInput).toHaveValue('DRGN');
    await expect(supplyInput).toHaveValue('1000000');
    await expect(page.getByRole('heading', { name: 'Dragoon Token' })).toBeVisible();
  });

  test('verifies wallet picker wording and built-in guidance', async ({ page }) => {
    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    await expect(connectButton).toBeVisible();
    await connectButton.click();

    // Verify modal title
    await expect(page.getByRole('heading', { name: 'Connect Wallet' })).toBeVisible();

    // Verify all 4 wallets appear in strict order: Brave, MetaMask, Phantom, Coinbase
    const walletButtons = page.locator('div[role="dialog"] button:has(span.font-semibold)');
    await expect(walletButtons).toHaveCount(4);
    await expect(walletButtons.nth(0)).toContainText('Brave Wallet');
    await expect(walletButtons.nth(1)).toContainText('MetaMask');
    await expect(walletButtons.nth(2)).toContainText('Phantom');
    await expect(walletButtons.nth(3)).toContainText('Coinbase Wallet');

    // Verify "Unavailable" status indicator is present for uninstalled wallets
    const unavailableCount = await page.getByText('Unavailable').count();
    expect(unavailableCount).toBeGreaterThan(0);

    // Verify technical badges and descriptive paragraphs are removed from the options list
    await expect(page.getByText('Built-in')).toHaveCount(0);
    await expect(page.getByText('Multi-Chain')).toHaveCount(0);
    await expect(page.getByText('Smart Wallet')).toHaveCount(0);
    await expect(page.getByText('Native Web3 wallet built into the Brave browser.')).toHaveCount(0);

    // Verify simplified footer reassurance
    await expect(page.getByText('Connecting does not move funds.')).toBeVisible();
    await expect(page.getByText('Standard EIP-6963 Discovery')).toHaveCount(0);

    // Verify selecting an unavailable wallet shows detailed setup guidance
    await walletButtons.nth(0).click(); // Click Brave Wallet
    await expect(page.getByText(/enable Web3 provider access in Brave Settings/i)).toBeVisible();

    // Capture screenshot of the detailed guidance view
    await page.screenshot({
      path: 'screenshots/desktop-1440x900-unavailable-guidance.png',
      fullPage: false,
    });
  });
});
