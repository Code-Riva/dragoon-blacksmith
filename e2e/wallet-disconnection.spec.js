// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Wallet Disconnection Confirmation Dialog & Safeguards', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window['__sentTransactions'] = [];
      window['__disconnectCalls'] = 0;

      const listeners = {
        accountsChanged: [],
        chainChanged: [],
      };

      const mockProvider = {
        isMetaMask: true,
        request: async ({ method, params }) => {
          if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
            if (window['__disconnectedExternally']) return [];
            return ['0x70997970C51812dc3A010C7d01b50e0d17dc79C8'];
          }
          if (method === 'eth_chainId') return '0xaa36a7'; // Sepolia
          if (method === 'eth_getBalance') return '0xde0b6b3a7640000'; // 1 ETH
          if (method === 'eth_blockNumber') {
            if (window['__mockConfirmedReceipt']) return '0x106';
            return '0x105';
          }
          if (method === 'eth_getBlockByNumber') {
            return {
              number: '0x105',
              hash: '0x1234567890123456789012345678901234567890123456789012345678901234',
              timestamp: '0x654321',
              baseFeePerGas: '0x3b9aca00',
            };
          }
          if (method === 'eth_maxPriorityFeePerGas') return '0x59682f00';
          if (method === 'eth_gasPrice') return '0x59682f00';
          if (method === 'eth_estimateGas') return '0x138800';
          if (method === 'eth_call') return '0x0000000000000000000000000000000000000000000000000000000000000000';
          if (method === 'eth_sendTransaction') {
            window['__sentTransactions'].push(params?.[0]);
            return '0xabcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234';
          }
          if (method === 'eth_getTransactionByHash') {
            return {
              hash: '0xabcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234',
              blockHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
              blockNumber: '0x100',
              from: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
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
            if (window['__mockReceiptRpcError']) {
              throw new Error('Temporary RPC failure: node unreachable');
            }
            if (window['__mockConfirmedReceipt']) {
              return {
                transactionHash: '0xabcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234',
                blockHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
                blockNumber: '0x100',
                from: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
                to: null,
                cumulativeGasUsed: '0x124f80',
                gasUsed: '0x124f80',
                effectiveGasPrice: '0x59682f00',
                status: '0x1',
                contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
                logs: [],
                logsBloom: '0x0000000000000000000000000000000000000000000000000000000000000000',
                type: '0x2',
                transactionIndex: '0x0',
              };
            }
            return null; // Unsettled / still pending
          }
          if (method === 'wallet_revokePermissions') {
            window['__disconnectCalls']++;
            return null;
          }
          return null;
        },
        on: (event, handler) => {
          if (listeners[event]) listeners[event].push(handler);
        },
        removeListener: (event, handler) => {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter((h) => h !== handler);
          }
        },
        emit: (event, data) => {
          if (listeners[event]) {
            listeners[event].forEach((h) => h(data));
          }
        },
      };

      window.ethereum = mockProvider;
      window['__mockProvider'] = mockProvider;

      function dispatchAnnounce() {
        window.dispatchEvent(
          new CustomEvent('eip6963:announceProvider', {
            detail: Object.freeze({
              info: {
                uuid: 'mock-metamask-uuid',
                name: 'MetaMask',
                icon: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
                rdns: 'io.metamask',
              },
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

  test('clicking Disconnect action opens confirmation dialog with exact wording without disconnecting', async ({
    page,
  }) => {
    // 1. Connect wallet
    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    await connectButton.click();
    await page.locator('button:has-text("MetaMask")').click();
    await expect(page.getByText('0x7099...79C8').first()).toBeVisible();

    // 2. Open Account details dropdown
    const accountButton = page.getByRole('button', { name: /account details menu/i });
    await accountButton.click();

    // 3. Click Disconnect action in menu
    const disconnectButton = page.getByRole('button', { name: /^disconnect$/i });
    await expect(disconnectButton).toBeVisible();
    await disconnectButton.click();

    // 4. Verify confirmation dialog opens with exact copy
    const dialog = page.getByRole('dialog', { name: /disconnect wallet\?/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Disconnect wallet?' })).toBeVisible();
    await expect(dialog.getByText('You can reconnect anytime.')).toBeVisible();
    await expect(dialog.getByText('Your submitted transaction will continue.')).not.toBeVisible();

    // 5. Verify buttons exist
    await expect(dialog.getByRole('button', { name: 'Keep Connected' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Disconnect' })).toBeVisible();

    // 6. Verify wallet is NOT disconnected yet
    await expect(page.getByText('0x7099...79C8').first()).toBeVisible();
  });

  test('moves initial focus to "Keep Connected", traps focus, and restores focus on cancellation', async ({
    page,
  }) => {
    // 1. Connect wallet and open details
    await page.getByRole('button', { name: /connect wallet/i }).click();
    await page.locator('button:has-text("MetaMask")').click();
    await page.getByRole('button', { name: /account details menu/i }).click();

    // 2. Click Disconnect
    const disconnectAction = page.getByRole('button', { name: /^disconnect$/i });
    await disconnectAction.click();

    const dialog = page.getByRole('dialog', { name: /disconnect wallet\?/i });
    await expect(dialog).toBeVisible();

    // 3. Verify initial focus is on "Keep Connected"
    const keepConnectedButton = dialog.getByRole('button', { name: 'Keep Connected' });
    await expect(keepConnectedButton).toBeFocused();

    // 4. Verify Tab key traps focus to "Disconnect" button
    await page.keyboard.press('Tab');
    const confirmDisconnectButton = dialog.getByRole('button', { name: 'Disconnect' });
    await expect(confirmDisconnectButton).toBeFocused();

    // Tab again wraps back to "Keep Connected"
    await page.keyboard.press('Tab');
    await expect(keepConnectedButton).toBeFocused();

    // Shift+Tab wraps back to "Disconnect"
    await page.keyboard.press('Shift+Tab');
    await expect(confirmDisconnectButton).toBeFocused();

    // 5. Click "Keep Connected" to cancel
    await keepConnectedButton.click();
    await expect(dialog).not.toBeVisible();

    // 6. Verify wallet remains connected
    await expect(page.getByText('0x7099...79C8').first()).toBeVisible();
  });

  test('dismisses confirmation without disconnecting via Escape key and backdrop click', async ({
    page,
  }) => {
    // 1. Connect wallet
    await page.getByRole('button', { name: /connect wallet/i }).click();
    await page.locator('button:has-text("MetaMask")').click();

    // 2. Open confirmation dialog
    await page.getByRole('button', { name: /account details menu/i }).click();
    await page.getByRole('button', { name: /^disconnect$/i }).click();

    const dialog = page.getByRole('dialog', { name: /disconnect wallet\?/i });
    await expect(dialog).toBeVisible();

    // 3. Test Escape key dismissal
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText('0x7099...79C8').first()).toBeVisible();

    // 4. Re-open confirmation dialog
    await page.getByRole('button', { name: /account details menu/i }).click();
    await page.getByRole('button', { name: /^disconnect$/i }).click();
    await expect(dialog).toBeVisible();

    // 5. Test backdrop click dismissal (click top-left corner of overlay)
    const overlay = page.locator('div[role="dialog"][aria-modal="true"]').last();
    await overlay.click({ position: { x: 10, y: 10 } });
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText('0x7099...79C8').first()).toBeVisible();
  });

  test('only explicit confirmation executes disconnection and updates the app', async ({ page }) => {
    // 1. Connect wallet
    await page.getByRole('button', { name: /connect wallet/i }).click();
    await page.locator('button:has-text("MetaMask")').click();
    await expect(page.getByText('0x7099...79C8').first()).toBeVisible();

    // 2. Open confirmation dialog
    await page.getByRole('button', { name: /account details menu/i }).click();
    await page.getByRole('button', { name: /^disconnect$/i }).click();

    const dialog = page.getByRole('dialog', { name: /disconnect wallet\?/i });
    await expect(dialog).toBeVisible();

    // 3. Explicitly confirm disconnection
    const confirmButton = dialog.getByRole('button', { name: 'Disconnect' });
    await confirmButton.click();

    // 4. Verify confirmation dialog closes and app returns to disconnected state
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: /connect wallet/i })).toBeVisible();
    await expect(page.getByText('0x7099...79C8')).not.toBeVisible();
  });

  test('disconnecting invalidates unsubmitted deployment review and blocks deployment', async ({ page }) => {
    // 1. Connect wallet
    await page.getByRole('button', { name: /connect wallet/i }).click();
    await page.locator('button:has-text("MetaMask")').click();
    await expect(page.getByText('0x7099...79C8').first()).toBeVisible();

    // 2. Open Review & Forge Token modal (unsubmitted review snapshot)
    const forgeButton = page.getByRole('button', { name: /review & forge token/i });
    await forgeButton.click();
    await expect(page.getByRole('heading', { name: 'Review Token Blueprint' })).toBeVisible();

    // 3. Disconnect wallet while review modal is open (simulating external wallet extension disconnect)
    await page.evaluate(() => {
      window['__disconnectedExternally'] = true;
      window['__mockProvider'].emit('accountsChanged', []);
    });

    // 4. Verify deployment review is invalidated with notification banner
    await expect(page.getByText('Wallet Context Changed')).toBeVisible();
    await expect(
      page.getByText(/The wallet was disconnected while this review was open/i)
    ).toBeVisible();

    // 5. Verify Confirm & Forge button is disabled
    const confirmForgeButton = page.getByRole('button', { name: /confirm & forge/i });
    await expect(confirmForgeButton).toBeDisabled();

    // 6. Verify zero deployment transactions were sent
    const sentCount = await page.evaluate(() => window['__sentTransactions'].length);
    expect(sentCount).toBe(0);
  });

  test('dismisses confirmation dialog automatically when wallet disconnects externally', async ({
    page,
  }) => {
    // 1. Connect wallet
    await page.getByRole('button', { name: /connect wallet/i }).click();
    await page.locator('button:has-text("MetaMask")').click();
    await expect(page.getByText('0x7099...79C8').first()).toBeVisible();

    // 2. Open confirmation dialog
    await page.getByRole('button', { name: /account details menu/i }).click();
    await page.getByRole('button', { name: /^disconnect$/i }).click();

    const dialog = page.getByRole('dialog', { name: /disconnect wallet\?/i });
    await expect(dialog).toBeVisible();

    // 3. Trigger external disconnect from the wallet extension
    await page.evaluate(() => {
      window['__disconnectedExternally'] = true;
      window['__mockProvider'].emit('accountsChanged', []);
    });

    // 4. Verify confirmation dialog is automatically dismissed and UI shows Connect Wallet
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: /connect wallet/i })).toBeVisible();
  });

  test('shows "Your submitted transaction will continue." only when a transaction is pending', async ({
    page,
  }) => {
    // 1. Connect wallet
    await page.getByRole('button', { name: /connect wallet/i }).click();
    await page.locator('button:has-text("MetaMask")').click();
    await expect(page.getByText('0x7099...79C8').first()).toBeVisible();

    // 2. Open confirmation dialog without pending transaction
    await page.getByRole('button', { name: /account details menu/i }).click();
    await page.getByRole('button', { name: /^disconnect$/i }).click();

    const dialog = page.getByRole('dialog', { name: /disconnect wallet\?/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('You can reconnect anytime.')).toBeVisible();
    await expect(dialog.getByText('Your submitted transaction will continue.')).not.toBeVisible();

    // 3. Dismiss confirmation dialog
    await dialog.getByRole('button', { name: 'Keep Connected' }).click();
    await expect(dialog).not.toBeVisible();

    // 4. Submit a deployment transaction through the UI
    await page.getByRole('button', { name: /review & forge token/i }).click();
    await expect(page.getByRole('heading', { name: 'Review Token Blueprint' })).toBeVisible();
    await page.getByRole('button', { name: /confirm & forge/i }).click();

    await expect(page.getByRole('heading', { name: /forging token on sepolia/i }).first()).toBeVisible();
    await expect(page.getByText(/0xabcd1234/i)).toBeVisible();

    // 5. Close the review modal while transaction is pending
    await page.getByRole('button', { name: 'Close deployment dialog' }).click();
    await expect(page.getByRole('heading', { name: /forging token on sepolia/i })).not.toBeVisible();

    // 6. Open confirmation dialog while transaction is pending
    await page.getByRole('button', { name: /account details menu/i }).click();
    await page.getByRole('button', { name: /^disconnect$/i }).click();

    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('You can reconnect anytime.')).toBeVisible();
    await expect(dialog.getByText('Your submitted transaction will continue.')).toBeVisible();

    // 7. Dismiss confirmation dialog
    await dialog.getByRole('button', { name: 'Keep Connected' }).click();
    await expect(dialog).not.toBeVisible();

    // 8. Settle pending transaction via test harness mockProvider confirmed receipt
    await page.evaluate(() => {
      window['__mockConfirmedReceipt'] = true;
    });

    // 9. Re-open confirmation dialog and verify conditional message is cleared
    await page.getByRole('button', { name: /account details menu/i }).click();
    await page.getByRole('button', { name: /^disconnect$/i }).click();

    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('You can reconnect anytime.')).toBeVisible();
    await expect(dialog.getByText('Your submitted transaction will continue.')).not.toBeVisible({ timeout: 5000 });
    await dialog.getByRole('button', { name: 'Keep Connected' }).click();
  });

  test('closing, resetting, or unmounting deployment modal while transaction is pending preserves continuation notice in disconnect dialog', async ({
    page,
  }) => {
    // 1. Connect wallet
    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    await connectButton.click();
    await page.locator('button:has-text("MetaMask")').click();
    await expect(page.getByText('0x7099...79C8').first()).toBeVisible();

    // 2. Open Review & Forge Token modal
    const forgeButton = page.getByRole('button', { name: /review & forge token/i });
    await forgeButton.click();
    await expect(page.getByRole('heading', { name: 'Review Token Blueprint' })).toBeVisible();

    // 3. Confirm & Forge to dispatch deployment transaction
    const confirmButton = page.getByRole('button', { name: /confirm & forge/i });
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // 4. Modal enters "Forging Token on Sepolia" state with active tx hash
    await expect(page.getByRole('heading', { name: /forging token on sepolia/i }).first()).toBeVisible();
    await expect(page.getByText(/0xabcd1234/i)).toBeVisible();

    // 5. Close the deployment modal while transaction is still forging (pending on network)
    const closeDialogButton = page.getByRole('button', { name: 'Close deployment dialog' });
    await expect(closeDialogButton).toBeVisible();
    await closeDialogButton.click();

    // 6. Verify modal is closed / unmounted
    await expect(page.getByRole('heading', { name: /forging token on sepolia/i })).not.toBeVisible();

    // 7. Open account details menu and click Disconnect
    await page.getByRole('button', { name: /account details menu/i }).click();
    await page.getByRole('button', { name: /^disconnect$/i }).click();

    // 8. Verify Disconnect confirmation dialog displays the continuation notice
    const disconnectDialog = page.getByRole('dialog', { name: /disconnect wallet\?/i });
    await expect(disconnectDialog).toBeVisible();
    await expect(disconnectDialog.getByRole('heading', { name: 'Disconnect wallet?' })).toBeVisible();
    await expect(disconnectDialog.getByText('You can reconnect anytime.')).toBeVisible();
    await expect(disconnectDialog.getByText('Your submitted transaction will continue.')).toBeVisible();

    // 9. Dismiss dialog via "Keep Connected"
    await disconnectDialog.getByRole('button', { name: 'Keep Connected' }).click();
    await expect(disconnectDialog).not.toBeVisible();

    // 10. Simulate temporary RPC error in test harness provider (must NOT settle or clear pending status)
    await page.evaluate(() => {
      window['__mockReceiptRpcError'] = true;
    });
    await page.waitForTimeout(600);

    // 11. Re-open disconnect dialog: continuation notice remains visible
    await page.getByRole('button', { name: /account details menu/i }).click();
    await page.getByRole('button', { name: /^disconnect$/i }).click();
    await expect(disconnectDialog.getByText('Your submitted transaction will continue.')).toBeVisible();
    await disconnectDialog.getByRole('button', { name: 'Keep Connected' }).click();

    // 12. Settle transaction via test harness provider confirmed receipt
    await page.evaluate(() => {
      window['__mockReceiptRpcError'] = false;
      window['__mockConfirmedReceipt'] = true;
    });

    // 13. Re-open disconnect dialog: continuation notice is now cleared
    await page.getByRole('button', { name: /account details menu/i }).click();
    await page.getByRole('button', { name: /^disconnect$/i }).click();
    await expect(disconnectDialog.getByText('Your submitted transaction will continue.')).not.toBeVisible({ timeout: 5000 });
    await disconnectDialog.getByRole('button', { name: 'Keep Connected' }).click();
  });
});
