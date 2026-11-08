// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Token Deployment Flow — Review, Validation & Simulation', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', (err) => console.log('BROWSER ERROR:', err.message));

    await page.addInitScript(() => {
      window['__deployRequests'] = [];
      window['__rejectDeployment'] = false;
      window['__revertDeployment'] = false;
      window['__stayOnWrongChain'] = false;
      window['__chainId'] = '0xaa36a7'; // Sepolia (11155111)

      const DEPLOYER_ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
      const MOCK_TX_HASH = '0x9999999999999999999999999999999999999999999999999999999999999999';
      const MOCK_CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

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
        request: async ({ method, params }) => {
          window['__deployRequests'].push({ method, params });

          if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
            return [DEPLOYER_ADDRESS];
          }
          if (method === 'eth_chainId') {
            return window['__chainId'];
          }
          if (method === 'wallet_requestPermissions') {
            return [{ parentCapability: 'eth_accounts' }];
          }
          if (method === 'wallet_revokePermissions') {
            return null;
          }
          if (method === 'eth_getBalance') {
            return '0xde0b6b3a7640000'; // 1 ETH
          }
          if (method === 'eth_blockNumber') {
            return '0x105'; // Block 261
          }
          if (method === 'eth_getBlockByNumber') {
            return {
              number: '0x105',
              hash: '0x1234567890123456789012345678901234567890123456789012345678901234',
              timestamp: '0x654321',
            };
          }
          if (method === 'eth_estimateGas') {
            return '0x138800'; // ~1,280,000 gas
          }
          if (method === 'eth_gasPrice') {
            return '0x59682f00'; // 1.5 gwei
          }
          if (method === 'wallet_switchEthereumChain') {
            if (window['__stayOnWrongChain']) {
              const err = new Error('User rejected the network switch.');
              // @ts-ignore
              err.code = 4001;
              throw err;
            }
            window['__chainId'] = '0xaa36a7';
            mockProvider.emit('chainChanged', '0xaa36a7');
            return null;
          }
          if (method === 'eth_sendTransaction') {
            if (window['__rejectDeployment']) {
              const err = new Error('User rejected the transaction.');
              // @ts-ignore
              err.code = 4001;
              throw err;
            }
            return MOCK_TX_HASH;
          }
          if (method === 'eth_getTransactionByHash') {
            return {
              hash: MOCK_TX_HASH,
              blockHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
              blockNumber: '0x100',
              from: DEPLOYER_ADDRESS,
              to: null,
              gas: '0x138800',
              gasPrice: '0x59682f00',
              input: '0x60806040',
              nonce: '0x0',
              transactionIndex: '0x0',
              value: '0x0',
              type: '0x2',
            };
          }
          if (method === 'eth_getTransactionReceipt') {
            return {
              transactionHash: MOCK_TX_HASH,
              blockHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
              blockNumber: '0x100',
              from: DEPLOYER_ADDRESS,
              to: null,
              cumulativeGasUsed: '0x124f80',
              gasUsed: '0x124f80',
              effectiveGasPrice: '0x59682f00',
              status: window['__revertDeployment'] ? '0x0' : '0x1',
              contractAddress: window['__revertDeployment'] ? null : MOCK_CONTRACT_ADDRESS,
              logs: [],
              logsBloom: '0x0000000000000000000000000000000000000000000000000000000000000000',
              type: '0x2',
              transactionIndex: '0x0',
            };
          }
          if (method === 'eth_call') {
            // Simulate contract readback:
            // name() -> "Dragoon Token"
            // symbol() -> "DRGN"
            // decimals() -> 18
            // totalSupply() -> 1,000,000 * 10^18
            // balanceOf() -> 1,000,000 * 10^18
            const data = params?.[0]?.data || '';
            // name() = 0x06fdde03
            if (data.startsWith('0x06fdde03')) {
              // Return ABI-encoded "Dragoon Token"
              return '0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000d447261676f6f6e20546f6b656e00000000000000000000000000000000000000';
            }
            // symbol() = 0x95d89b41
            if (data.startsWith('0x95d89b41')) {
              // Return ABI-encoded "DRGN"
              return '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000044452474e00000000000000000000000000000000000000000000000000000000';
            }
            // decimals() = 0x313ce567
            if (data.startsWith('0x313ce567')) {
              return '0x0000000000000000000000000000000000000000000000000000000000000012'; // 18
            }
            // totalSupply() = 0x18160ddd or balanceOf() = 0x70a08231
            if (data.startsWith('0x18160ddd') || data.startsWith('0x70a08231')) {
              // Return 1,000,000 * 10^18 = 0xd3c21bcecceda1000000
              return '0x0000000000000000000000000000000000000000000d3c21bcecceda10000000';
            }
            return '0x0000000000000000000000000000000000000000000000000000000000000000';
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
                uuid: 'sim-mm',
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
  });

  test('completes full Forge flow: review, confirm, approval, receipt, and verified contract display', async ({
    page,
  }) => {
    // 1. Connect wallet first
    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    await connectButton.click();
    await page.locator('button:has-text("MetaMask")').click();
    await expect(page.getByText('0x7099...79C8').first()).toBeVisible();

    // 2. Click "Review & Forge Token"
    const forgeButton = page.getByRole('button', { name: /review & forge token/i });
    await expect(forgeButton).toBeVisible();
    await forgeButton.click();

    // 3. Verify Review Modal opens with exact specifications
    await expect(page.getByRole('heading', { name: 'Review Token Blueprint' })).toBeVisible();
    await expect(page.getByText('Whole-Token Supply')).toBeVisible();
    await expect(page.getByText('Passed directly to constructor')).toBeVisible();
    await expect(page.getByText('0.0 ETH (Gas only)')).toBeVisible();
    await expect(page.getByText('Ethereum Sepolia (11155111)')).toBeVisible();
    await expect(page.getByText(/Ethereum Sepolia Testnet Only/i)).toBeVisible();

    // 4. Click "Confirm & Forge"
    const confirmButton = page.getByRole('button', { name: /confirm & forge/i });
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // 5. Verify transition to confirmed state with contract address
    await expect(page.getByText('Token Successfully Deployed!')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('0x5FbDB2315678afecb367f032d93F642f64180aa3')).toBeVisible();

    // 6. Verify explorer links
    const contractLink = page.getByRole('link', { name: /view contract/i });
    await expect(contractLink).toBeVisible();
    expect(await contractLink.getAttribute('href')).toContain(
      'https://sepolia.etherscan.io/address/0x5FbDB2315678afecb367f032d93F642f64180aa3'
    );

    const txLink = page.getByRole('link', { name: /view transaction/i });
    await expect(txLink).toBeVisible();
    expect(await txLink.getAttribute('href')).toContain(
      'https://sepolia.etherscan.io/tx/0x9999999999999999999999999999999999999999999999999999999999999999'
    );

    // 7. Verify "Forge Another Token" button works and resets blueprint
    const forgeAnotherButton = page.getByRole('button', { name: /forge another token/i });
    await expect(forgeAnotherButton).toBeVisible();
    await forgeAnotherButton.click();

    // Verify modal is closed and wallet is still connected
    await expect(page.getByRole('heading', { name: 'Review Token Blueprint' })).not.toBeVisible();
    await expect(page.getByText('0x7099...79C8').first()).toBeVisible();
  });

  test('enforces Sepolia network and disables confirm when on wrong network', async ({ page }) => {
    // 1. Connect wallet first
    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    await connectButton.click();
    await page.locator('button:has-text("MetaMask")').click();
    await expect(page.getByText('0x7099...79C8').first()).toBeVisible();

    // 2. Simulate wallet switching to Ethereum Mainnet (Chain ID 1)
    await page.evaluate(() => {
      window['__chainId'] = '0x1';
      window['__stayOnWrongChain'] = true;
      // @ts-ignore
      window['__mockProvider'].emit('chainChanged', '0x1');
    });

    // 3. Open Forge Modal
    const forgeButton = page.getByRole('button', { name: /review & forge token/i });
    await forgeButton.click();

    // 4. Assert Unsupported Network notice and disabled confirm
    const modal = page.locator('div[role="dialog"]');
    await expect(modal.getByText('Unsupported Network', { exact: true })).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Switch to Sepolia' })).toBeVisible();

    const confirmButton = page.getByRole('button', { name: /confirm & forge/i });
    await expect(confirmButton).toBeDisabled();

    // 5. Verify switching back to Sepolia restores ready state
    await page.evaluate(() => {
      window['__stayOnWrongChain'] = false;
    });
    await modal.getByRole('button', { name: 'Switch to Sepolia' }).click();
    await expect(modal.getByText('Unsupported Network', { exact: true })).not.toBeVisible();
    await expect(confirmButton).toBeEnabled();
  });

  test('handles wallet rejection gracefully with clear message', async ({ page }) => {
    // Set rejection in mock
    await page.evaluate(() => {
      window['__rejectDeployment'] = true;
    });

    // Connect wallet
    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    await connectButton.click();
    await page.locator('button:has-text("MetaMask")').click();
    await expect(page.getByText('0x7099...79C8').first()).toBeVisible();

    // Click Forge
    const forgeButton = page.getByRole('button', { name: /review & forge token/i });
    await forgeButton.click();

    // Confirm
    const confirmButton = page.getByRole('button', { name: /confirm & forge/i });
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // Assert rejection banner
    await expect(page.getByText('Deployment request was rejected in your wallet.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Review & Try Again' })).toBeVisible();
  });

  test('handles reverted on-chain deployment transaction receipt', async ({ page }) => {
    // Set reverted receipt in mock
    await page.evaluate(() => {
      window['__revertDeployment'] = true;
    });

    // Connect wallet
    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    await connectButton.click();
    await page.locator('button:has-text("MetaMask")').click();
    await expect(page.getByText('0x7099...79C8').first()).toBeVisible();

    // Click Forge
    const forgeButton = page.getByRole('button', { name: /review & forge token/i });
    await forgeButton.click();

    // Confirm
    const confirmButton = page.getByRole('button', { name: /confirm & forge/i });
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // Assert reverted banner
    await expect(
      page.getByText(/Transaction was reverted on-chain by the Ethereum Sepolia network/i)
    ).toBeVisible({ timeout: 10000 });
  });
});
