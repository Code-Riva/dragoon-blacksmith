// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Wallet Provider Verification — Dual Simulated Providers', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window['__metamaskRequests'] = [];
      window['__braveRequests'] = [];
      window['__rejectMetaMask'] = false;

      const fakeMetaMask = {
        isMetaMask: true,
        request: async ({ method }) => {
          window['__metamaskRequests'].push(method);
          if (
            window['__rejectMetaMask'] &&
            (method === 'eth_requestAccounts' || method === 'wallet_requestPermissions')
          ) {
            const err = new Error('User rejected the request.');
            // @ts-ignore
            err.code = 4001;
            throw err;
          }
          if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
            return ['0x1111111111111111111111111111111111111111'];
          }
          if (method === 'eth_chainId') return '0xaa36a7';
          if (method === 'wallet_requestPermissions') return [{ parentCapability: 'eth_accounts' }];
          if (method === 'wallet_revokePermissions') return null;
          if (method === 'eth_getBalance') return '0xde0b6b3a7640000';
          return null;
        },
        on: () => {},
        removeListener: () => {},
      };

      const fakeBrave = {
        isBraveWallet: true,
        isMetaMask: true,
        request: async ({ method }) => {
          window['__braveRequests'].push(method);
          if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
            return ['0x2222222222222222222222222222222222222222'];
          }
          if (method === 'eth_chainId') return '0xaa36a7';
          if (method === 'wallet_requestPermissions') return [{ parentCapability: 'eth_accounts' }];
          if (method === 'wallet_revokePermissions') return null;
          if (method === 'eth_getBalance') return '0xde0b6b3a7640000';
          return null;
        },
        on: () => {},
        removeListener: () => {},
      };

      // In Brave Browser, window.ethereum is Brave Wallet
      window.ethereum = fakeBrave;

      function dispatchAnnounce() {
        window.dispatchEvent(
          new CustomEvent('eip6963:announceProvider', {
            detail: Object.freeze({
              info: Object.freeze({
                uuid: 'mock-mm-uuid',
                name: 'MetaMask',
                icon: 'data:image/svg+xml,...',
                rdns: 'io.metamask',
              }),
              provider: fakeMetaMask,
            }),
          })
        );
        window.dispatchEvent(
          new CustomEvent('eip6963:announceProvider', {
            detail: Object.freeze({
              info: Object.freeze({
                uuid: 'mock-brave-uuid',
                name: 'Brave Wallet',
                icon: 'data:image/svg+xml,...',
                rdns: 'com.brave.wallet',
              }),
              provider: fakeBrave,
            }),
          })
        );
      }

      window.addEventListener('eip6963:requestProvider', dispatchAnnounce);
      setTimeout(dispatchAnnounce, 0);
      setTimeout(dispatchAnnounce, 50);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('verifies availability indicators: Brave & MetaMask Available, Phantom & Coinbase Unavailable', async ({
    page,
  }) => {
    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    await connectButton.click();

    // Verify modal title
    await expect(page.getByRole('heading', { name: 'Connect Wallet' })).toBeVisible();

    // Brave Wallet and MetaMask must be Available
    const braveRow = page.locator('button:has-text("Brave Wallet")');
    await expect(braveRow.getByText('Available')).toBeVisible();

    const mmRow = page.locator('button:has-text("MetaMask")');
    await expect(mmRow.getByText('Available')).toBeVisible();

    // Phantom and Coinbase must be Unavailable
    const phantomRow = page.locator('button:has-text("Phantom")');
    await expect(phantomRow.getByText('Unavailable')).toBeVisible();

    const cbRow = page.locator('button:has-text("Coinbase Wallet")');
    await expect(cbRow.getByText('Unavailable')).toBeVisible();
  });

  test('verifies MetaMask tile connects to MetaMask provider and NOT to Brave or fallback', async ({
    page,
  }) => {
    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    await connectButton.click();

    // Click MetaMask
    const mmRow = page.locator('button:has-text("MetaMask")');
    await mmRow.click();

    // Verify connected state reflects MetaMask's account (0x1111...1111)
    await expect(page.getByText('0x1111...1111').first()).toBeVisible({ timeout: 5000 });

    // Verify request logs: MetaMask received requests, Brave received NONE
    const mmRequests = await page.evaluate(() => window['__metamaskRequests']);
    const braveRequests = await page.evaluate(() => window['__braveRequests']);

    expect(mmRequests.length).toBeGreaterThan(0);
    expect(mmRequests).toContain('eth_requestAccounts');
    expect(braveRequests).toEqual([]);
  });

  test('verifies Brave Wallet tile connects to Brave provider and NOT to MetaMask', async ({
    page,
  }) => {
    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    await connectButton.click();

    // Click Brave Wallet
    const braveRow = page.locator('button:has-text("Brave Wallet")');
    await braveRow.click();

    // Verify connected state reflects Brave's account (0x2222...2222)
    await expect(page.getByText('0x2222...2222').first()).toBeVisible({ timeout: 5000 });

    // Verify request logs: Brave received requests, MetaMask received NONE
    const mmRequests = await page.evaluate(() => window['__metamaskRequests']);
    const braveRequests = await page.evaluate(() => window['__braveRequests']);

    expect(braveRequests.length).toBeGreaterThan(0);
    expect(braveRequests).toContain('eth_requestAccounts');
    expect(mmRequests).toEqual([]);
  });

  test('verifies user rejection displays clear rejection guidance', async ({ page }) => {
    // Set simulated MetaMask to reject
    await page.evaluate(() => {
      window['__rejectMetaMask'] = true;
    });

    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    await connectButton.click();

    // Click MetaMask
    const mmRow = page.locator('button:has-text("MetaMask")');
    await mmRow.click();

    // Assert Connection Rejected alert
    await expect(page.getByText('Connection Rejected')).toBeVisible();
    await expect(page.getByText('Connection request was rejected in MetaMask.')).toBeVisible();
  });

  test('verifies clicking unavailable wallet displays provider setup guidance', async ({
    page,
  }) => {
    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    await connectButton.click();

    // Click Phantom (unavailable)
    const phantomRow = page.locator('button:has-text("Phantom")');
    await phantomRow.click();

    // Assert Provider Not Available alert
    await expect(page.getByText('Provider Not Available')).toBeVisible();
    await expect(page.getByText(/Phantom is not available/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Get Phantom/i })).toBeVisible();
  });
});
