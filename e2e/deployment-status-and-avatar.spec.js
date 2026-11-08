// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Deployment Status States, Action Icon & Preview Avatar Verification', () => {
  test('verifies disconnected state status and decorative coin avatar', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const overview = page.locator('[data-testid="token-overview-card"]');

    // 1. Status reflects disconnected state
    await expect(overview.getByText('Connect a wallet to continue')).toBeVisible();
    await expect(overview.getByText('Connect your Web3 wallet to prepare and forge your ERC-20 token on Ethereum Sepolia.')).toBeVisible();

    // 2. Form validity is represented separately by validation badge
    const badge = overview.locator('text=Config Valid');
    await expect(badge).toBeVisible();

    // 3. Avatar renders local coin SVG with engraved D & dragon shade background, marked decorative
    const avatarImg = overview.locator('img[src*="/dragoon-coin.svg"]');
    await expect(avatarImg).toBeVisible();
    await expect(avatarImg).toHaveAttribute('aria-hidden', 'true');

    // Verify old "DR" text initials are NOT rendered
    const avatarContainer = avatarImg.locator('xpath=..');
    const avatarText = await avatarContainer.innerText();
    expect(avatarText.trim()).toBe('');

    // 4. "Review & Forge Token" button has hammer icon, not dollar sign
    const actionButton = overview.getByRole('button', { name: /review & forge token/i });
    await expect(actionButton).toBeVisible();
    const hammerSvg = actionButton.locator('svg');
    await expect(hammerSvg).toBeVisible();
    // Dollar sign path contains 'M12 2v20' which should NOT be in the hammer icon
    const svgHtml = await hammerSvg.innerHTML();
    expect(svgHtml).not.toContain('M12 2v20');
  });

  test('verifies wrong-network, invalid-form, and ready states with simulated provider', async ({ page }) => {
    await page.addInitScript(() => {
      window['__chainId'] = '0xaa36a7'; // Sepolia
      const listeners = {};

      const mockProvider = {
        isMetaMask: true,
        on: (event, handler) => {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(handler);
        },
        removeListener: (event, handler) => {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter((h) => h !== handler);
          }
        },
        emit: (event, data) => {
          if (listeners[event]) {
            for (const h of listeners[event]) {
              try {
                h(data);
              } catch (e) {
                console.error('listener err:', e);
              }
            }
          }
        },
        request: async ({ method }) => {
          if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
            return ['0x70997970C51812dc3A010C7d01b50e0d17dc79C8'];
          }
          if (method === 'eth_chainId') return window['__chainId'];
          if (method === 'wallet_requestPermissions') return [{ parentCapability: 'eth_accounts' }];
          if (method === 'wallet_revokePermissions') return null;
          if (method === 'eth_getBalance') return '0xde0b6b3a7640000';
          if (method === 'wallet_switchEthereumChain') {
            window['__chainId'] = '0xaa36a7';
            mockProvider.emit('chainChanged', '0xaa36a7');
            return null;
          }
          return null;
        },
      };

      window['__mockProvider'] = mockProvider;
      window.ethereum = mockProvider;

      function dispatchAnnounce() {
        window.dispatchEvent(
          new CustomEvent('eip6963:announceProvider', {
            detail: Object.freeze({
              info: Object.freeze({
                uuid: 'mock-metamask-uuid',
                name: 'MetaMask',
                icon: 'data:image/svg+xml,...',
                rdns: 'io.metamask',
              }),
              provider: mockProvider,
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

    const overview = page.locator('[data-testid="token-overview-card"]');

    // 1. Initially disconnected
    await expect(overview.getByText('Connect a wallet to continue')).toBeVisible();

    // 2. Connect wallet to Sepolia
    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    await connectButton.click();
    const mmButton = page.locator('div[role="dialog"] button:has-text("MetaMask")');
    await mmButton.click();

    // 3. Ready state: connected to Sepolia + valid form
    await expect(overview.getByText('Ready to Forge')).toBeVisible();
    await expect(overview.getByText('Ethereum Sepolia testnet deployment. Contracts are unaudited educational demos.')).toBeVisible();
    await expect(overview.locator('text=Config Valid')).toBeVisible();

    // 4. Invalid-form state: connected to Sepolia, but form is invalid
    const nameInput = page.locator('#token-name');
    await nameInput.fill('');
    await page.waitForTimeout(200);

    await expect(overview.getByText('Complete token configuration')).toBeVisible();
    await expect(overview.getByText('Provide a valid token name, symbol, and initial supply to ready your contract for deployment.')).toBeVisible();
    // Validation badge separately shows "Awaiting Input"
    await expect(overview.locator('text=Awaiting Input')).toBeVisible();

    // Restore valid token name
    await nameInput.fill('Dragoon Token');
    await page.waitForTimeout(200);
    await expect(overview.getByText('Ready to Forge')).toBeVisible();
    await expect(overview.locator('text=Config Valid')).toBeVisible();

    // 5. Wrong-network state: switch wallet chain to Mainnet (0x1)
    await page.evaluate(() => {
      window['__chainId'] = '0x1';
      // @ts-ignore
      window['__mockProvider'].emit('chainChanged', '0x1');
    });
    await page.waitForTimeout(300);

    await expect(overview.getByText('Switch to Ethereum Sepolia', { exact: true })).toBeVisible();
    await expect(overview.getByText('Your connected wallet is on an unsupported network. Switch to Ethereum Sepolia testnet to continue.')).toBeVisible();
    // Validation badge still separately shows "Config Valid"
    await expect(overview.locator('text=Config Valid')).toBeVisible();

    // 6. Switch back to Sepolia restores ready state
    await page.evaluate(() => {
      window['__chainId'] = '0xaa36a7';
      // @ts-ignore
      window['__mockProvider'].emit('chainChanged', '0xaa36a7');
    });
    await page.waitForTimeout(300);

    await expect(overview.getByText('Ready to Forge')).toBeVisible();
    await expect(overview.locator('text=Config Valid')).toBeVisible();
  });
});
