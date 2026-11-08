// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Token Deployment Flow — Review, Validation & Simulation', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', (err) => console.log('BROWSER ERROR:', err.message));

    await page.addInitScript(() => {
      window['__deployRequests'] = [];
      window['__sentTransactions'] = [];
      window['__rejectDeployment'] = false;
      window['__revertDeployment'] = false;
      window['__stayOnWrongChain'] = false;
      window['__noAuthorizedAccounts'] = false;
      window['__customAccounts'] = null;
      window['__activeAccount'] = null;
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

          if (method === 'eth_requestAccounts') {
            if (window['__noAuthorizedAccounts']) {
              return [];
            }
            return [window['__activeAccount'] || DEPLOYER_ADDRESS];
          }
          if (method === 'eth_accounts') {
            if (window['__noAuthorizedAccounts']) {
              return [];
            }
            if (window['__customAccounts']) {
              return window['__customAccounts'];
            }
            return [window['__activeAccount'] || DEPLOYER_ADDRESS];
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
              baseFeePerGas: '0x3b9aca00',
            };
          }
          if (method === 'eth_maxPriorityFeePerGas') {
            return '0x59682f00';
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
            window['__sentTransactions'].push(params?.[0]);
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
          if (method === 'wallet_watchAsset') {
            if (window['__rejectWatchAsset']) {
              const error = new Error('User rejected the request.');
              error.code = 4001;
              throw error;
            }
            if (window['__unsupportedWatchAsset']) {
              const error = new Error('Method not supported.');
              error.code = 4200;
              throw error;
            }
            if (window['__returnFalseWatchAsset']) {
              return false;
            }
            window['__watchAssetParams'] = params;
            return true;
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

    // 7. Verify "Add Token to Wallet" button and watchAsset integration
    const addToWalletButton = page.getByRole('button', { name: /add to wallet/i });
    await expect(addToWalletButton).toBeVisible();
    await addToWalletButton.click();

    // Verify button transitions to "In Wallet" and is disabled
    await expect(page.getByRole('button', { name: /in wallet/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /in wallet/i })).toBeDisabled();

    // Verify watchAsset params received by mock provider
    const watchParams = await page.evaluate(() => window['__watchAssetParams']);
    expect(watchParams).toBeTruthy();
    expect(watchParams.type).toBe('ERC20');
    expect(watchParams.options.address).toBe('0x5FbDB2315678afecb367f032d93F642f64180aa3');
    expect(watchParams.options.symbol).toBe('DRGN');
    expect(watchParams.options.decimals).toBe(18);
    expect(watchParams.options.image).toContain('/dragoon-coin.svg');

    // 8. Verify "Forge Another Token" button works and resets blueprint
    const forgeAnotherButton = page.getByRole('button', { name: /forge another token/i });
    await expect(forgeAnotherButton).toBeVisible();
    await forgeAnotherButton.click();

    // Verify modal is closed and wallet is still connected
    await expect(page.getByRole('heading', { name: 'Review Token Blueprint' })).not.toBeVisible();
    await expect(page.getByText('0x7099...79C8').first()).toBeVisible();
  });

  test('handles wallet_watchAsset user rejection and unsupported method gracefully', async ({ page }) => {
    // 1. Configure watchAsset rejection
    await page.evaluate(() => {
      window['__rejectWatchAsset'] = true;
    });

    // Connect wallet
    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    await connectButton.click();
    await page.locator('button:has-text("MetaMask")').click();
    await expect(page.getByText('0x7099...79C8').first()).toBeVisible();

    // Open forge modal and confirm
    const forgeButton = page.getByRole('button', { name: /review & forge token/i });
    await forgeButton.click();
    const confirmButton = page.getByRole('button', { name: /confirm & forge/i });
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // Wait for deployment confirmation
    await expect(page.getByText('Token Successfully Deployed!')).toBeVisible({ timeout: 10000 });

    // Click Add to Wallet
    const addBtn = page.getByRole('button', { name: /add to wallet/i });
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Assert rejection notice
    await expect(page.getByText('Add token request was declined in your wallet.')).toBeVisible();

    // 2. Test unsupported method
    await page.evaluate(() => {
      window['__rejectWatchAsset'] = false;
      window['__unsupportedWatchAsset'] = true;
    });

    await addBtn.click();
    await expect(
      page.getByText(/Your wallet does not support EIP-747 \(wallet_watchAsset\)/i)
    ).toBeVisible();

    // 3. Test provider returning false without showing success
    await page.evaluate(() => {
      window['__unsupportedWatchAsset'] = false;
      window['__returnFalseWatchAsset'] = true;
    });

    await addBtn.click();
    await expect(page.getByText('Token was not added to the wallet.')).toBeVisible();
    await expect(page.getByRole('button', { name: /in wallet/i })).not.toBeVisible();
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

  test('unchanged-account submission succeeds with multi-account authorized provider', async ({ page }) => {
    // 1. Configure provider to return multiple authorized accounts with reviewed account at index 1
    const SECONDARY_ACCOUNT = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
    const PRIMARY_ACCOUNT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    await page.evaluate(({ secondary, primary }) => {
      window['__customAccounts'] = [secondary, primary];
      window['__activeAccount'] = primary;
    }, { secondary: SECONDARY_ACCOUNT, primary: PRIMARY_ACCOUNT });

    // 2. Connect wallet
    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    await connectButton.click();
    await page.locator('button:has-text("MetaMask")').click();
    await expect(page.getByText('0x7099...79C8').first()).toBeVisible();

    // 3. Open forge modal
    const forgeButton = page.getByRole('button', { name: /review & forge token/i });
    await forgeButton.click();

    // 4. Confirm & Forge
    const confirmButton = page.getByRole('button', { name: /confirm & forge/i });
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // 5. Verify deployment successfully completes
    await expect(page.getByText('Token Successfully Deployed!')).toBeVisible({ timeout: 10000 });

    // 6. Verify outgoing transaction had exact reviewed from account
    const sentTx = await page.evaluate(() => window['__sentTransactions']);
    expect(sentTx.length).toBe(1);
    expect(sentTx[0].from.toLowerCase()).toBe(PRIMARY_ACCOUNT.toLowerCase());
  });

  test('invalidates review and prevents silent substitution when account changes while modal is open', async ({ page }) => {
    const ACCOUNT_A = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    const ACCOUNT_B = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

    // 1. Connect wallet with Account A
    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    await connectButton.click();
    await page.locator('button:has-text("MetaMask")').click();
    await expect(page.getByText('0x7099...79C8').first()).toBeVisible();

    // 2. Open forge modal (review captures Account A)
    const forgeButton = page.getByRole('button', { name: /review & forge token/i });
    await forgeButton.click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal.getByText('0x709979...dc79C8')).toBeVisible();

    // 3. Switch account in wallet while modal is open
    await page.evaluate((newAccount) => {
      window['__activeAccount'] = newAccount;
      window['__customAccounts'] = [newAccount];
      // @ts-ignore
      window['__mockProvider'].emit('accountsChanged', [newAccount]);
    }, ACCOUNT_B);

    // 4. Assert "Wallet Context Changed" notice appears in the modal
    await expect(modal.getByText('Wallet Context Changed')).toBeVisible();

    // 5. Click "Confirm & Forge" - MUST NOT dispatch transaction, MUST invalidate review
    const confirmButton = page.getByRole('button', { name: /confirm & forge/i });
    await confirmButton.click();

    // Verify ZERO transactions were dispatched
    const sentCountBefore = await page.evaluate(() => window['__sentTransactions'].length);
    expect(sentCountBefore).toBe(0);

    // Verify notice disappears and reviewed recipient updates to Account B
    await expect(modal.getByText('Wallet Context Changed')).not.toBeVisible();
    await expect(modal.getByText('0x3C44Cd...4293BC')).toBeVisible();

    // 6. Explicitly confirm with the updated reviewed account
    await confirmButton.click();

    // Verify deployment succeeds with Account B as sender
    await expect(page.getByText('Token Successfully Deployed!')).toBeVisible({ timeout: 10000 });
    const sentTx = await page.evaluate(() => window['__sentTransactions']);
    expect(sentTx.length).toBe(1);
    expect(sentTx[0].from.toLowerCase()).toBe(ACCOUNT_B.toLowerCase());
  });

  test('blocks deployment when provider returns missing authorization or unauthorized account', async ({ page }) => {
    // 1. Connect wallet
    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    await connectButton.click();
    await page.locator('button:has-text("MetaMask")').click();
    await expect(page.getByText('0x7099...79C8').first()).toBeVisible();

    // 2. Open forge modal
    const forgeButton = page.getByRole('button', { name: /review & forge token/i });
    await forgeButton.click();

    // 3. Simulate wallet provider returning no authorized accounts (locked wallet)
    await page.evaluate(() => {
      window['__noAuthorizedAccounts'] = true;
    });

    // 4. Attempt to confirm
    const confirmButton = page.getByRole('button', { name: /confirm & forge/i });
    await confirmButton.click();

    // 5. Assert authorization error banner is displayed and no tx was sent
    await expect(
      page.getByText(/No authorized accounts returned by the connected wallet provider/i)
    ).toBeVisible();

    const sentCount = await page.evaluate(() => window['__sentTransactions'].length);
    expect(sentCount).toBe(0);
  });

  test('blocks deployment when eth_accounts returns a nonempty list that excludes the reviewed sender', async ({ page }) => {
    const REVIEWED_ACCOUNT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    const UNAUTHORIZED_ACCOUNT = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

    // 1. Connect wallet with REVIEWED_ACCOUNT
    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    await connectButton.click();
    await page.locator('button:has-text("MetaMask")').click();
    await expect(page.getByText('0x7099...79C8').first()).toBeVisible();

    // 2. Open forge modal
    const forgeButton = page.getByRole('button', { name: /review & forge token/i });
    await forgeButton.click();
    await expect(page.getByRole('button', { name: /confirm & forge/i })).toBeEnabled();

    // 3. Provider returns a non-empty list that excludes the reviewed sender
    await page.evaluate(({ unauthorized }) => {
      window['__customAccounts'] = [unauthorized];
    }, { unauthorized: UNAUTHORIZED_ACCOUNT });

    // 4. Click confirm & forge
    const confirmButton = page.getByRole('button', { name: /confirm & forge/i });
    await confirmButton.click();

    // 5. Verify deployment is blocked with unauthorized sender message
    await expect(
      page.getByText(/is not among the authorized accounts in your connected wallet/i)
    ).toBeVisible();

    // 6. Verify zero transactions were dispatched
    const sentCount = await page.evaluate(() => window['__sentTransactions'].length);
    expect(sentCount).toBe(0);
  });

  test('captures comprehensive preflight diagnostics via opt-in UI and global window helper', async ({ page }) => {
    // 1. Connect wallet
    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    await connectButton.click();
    await page.locator('button:has-text("MetaMask")').click();
    await expect(page.getByText('0x7099...79C8').first()).toBeVisible();

    // 2. Open forge modal
    const forgeButton = page.getByRole('button', { name: /review & forge token/i });
    await forgeButton.click();

    // 3. Trigger opt-in diagnostics via UI
    const diagnosticsButton = page.getByRole('button', { name: /run preflight diagnostics/i });
    await expect(diagnosticsButton).toBeVisible();
    await diagnosticsButton.click();

    // 4. Verify UI diagnostics panel rendered observed vs estimated sections
    await expect(page.getByText('Preflight Diagnostics')).toBeVisible();
    await expect(page.getByText('Observed Parameters')).toBeVisible();
    await expect(page.getByText('Simulation & Estimates')).toBeVisible();
    await expect(page.getByText(/eth_call: SUCCESS/i)).toBeVisible();
    await expect(page.getByText(/eth_estimateGas: SUCCESS/i)).toBeVisible();

    // 5. Verify programmatic capture via window.__dragoonCaptureDiagnostics()
    const report = await page.evaluate(async () => {
      return await window['__dragoonCaptureDiagnostics']();
    });

    expect(report).toBeTruthy();
    expect(report._securityNotice).toContain('SAFE DIAGNOSTIC');
    expect(report.network.providerChainId).toBe(11155111);
    expect(report.accounts.reviewedSender.toLowerCase()).toBe('0x70997970c51812dc3a010c7d01b50e0d17dc79c8');
    expect(report.accounts.isSenderConsistent).toBe(true);
    expect(report.accounts.isReviewedAccountAuthorized).toBe(true);
    expect(report.deploymentPayload.data).toBeTruthy();
    expect(report.deploymentPayload.to).toBeNull();
    expect(report.deploymentPayload.value).toBe('0x0');
    expect(report.observedBalance.balanceEth).toBe('1');
    expect(report.observedFeeParameters.gasPriceGwei).toBeTruthy();
    expect(report.freshRpcSimulations.eth_call.status).toBe('SUCCESS');
    expect(report.freshRpcSimulations.eth_estimateGas.status).toBe('SUCCESS');
    expect(report.feeAnalysis.balanceSufficiency.hasSufficientFundsForGas).toBe(true);
  });
});
