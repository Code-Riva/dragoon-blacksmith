import { formatEther, getAddress } from "viem";
import { buildDeploymentData, SEPOLIA_CHAIN_ID } from "./tokenDeployment";

/**
 * Opt-in diagnostic capture for contract deployment preflight.
 * Queries the connected wallet connector's provider for live chain, account,
 * balance, fee parameters, and fresh eth_call / eth_estimateGas simulations.
 *
 * SECURITY: Collects only public addresses, RPC responses, and calldata.
 * Never accesses, requests, or logs private keys or seed phrases.
 *
 * @param {object} params
 * @param {object} params.connector - Wagmi connector
 * @param {object} params.snapshot - Reviewed token parameters and sender
 * @param {string} params.address - Current connected address
 * @param {object} [params.gasEstimate] - Prior gas estimation (if available)
 * @returns {Promise<object>} Diagnostic report
 */
export async function captureDeploymentDiagnostics({
  connector,
  snapshot,
  address,
  gasEstimate,
}) {
  const timestamp = new Date().toISOString();

  // 1. Resolve underlying EIP-1193 provider
  let provider = null;
  let connectorInfo = {
    id: connector?.id || "unknown",
    name: connector?.name || "unknown",
    type: connector?.type || "unknown",
  };

  try {
    if (connector && typeof connector.getProvider === "function") {
      provider = await connector.getProvider();
    } else if (typeof window !== "undefined" && window.ethereum) {
      provider = window.ethereum;
    }
  } catch (err) {
    // Provider retrieval error
    return {
      timestamp,
      error: `Failed to resolve provider from connector: ${err?.message || String(err)}`,
      connector: connectorInfo,
    };
  }

  if (!provider || typeof provider.request !== "function") {
    return {
      timestamp,
      error: "No EIP-1193 compatible provider found on the selected connector.",
      connector: connectorInfo,
    };
  }

  // 2. Identify reviewed sender and connected address
  const reviewedSender = snapshot?.address || null;
  const connectedAddress = address || null;
  const targetAccount = reviewedSender || connectedAddress;

  // 3. Provider Chain ID query
  let providerChainIdHex = null;
  let providerChainId = null;
  let chainError = null;
  try {
    providerChainIdHex = await provider.request({ method: "eth_chainId" });
    providerChainId = parseInt(providerChainIdHex, 16);
  } catch (err) {
    chainError = err?.message || String(err);
  }

  // 4. Provider Authorized Accounts query
  let authorizedAccounts = null;
  let accountsError = null;
  try {
    authorizedAccounts = await provider.request({ method: "eth_accounts" });
  } catch (err) {
    accountsError = err?.message || String(err);
  }

  // Account consistency verification
  const isReviewedAccountAuthorized = Boolean(
    reviewedSender &&
      Array.isArray(authorizedAccounts) &&
      authorizedAccounts.some(
        (acc) => typeof acc === "string" && acc.toLowerCase() === reviewedSender.toLowerCase()
      )
  );

  const isSenderConsistent = Boolean(
    reviewedSender &&
      connectedAddress &&
      reviewedSender.toLowerCase() === connectedAddress.toLowerCase()
  );

  // 5. Construct exact deployment payload (calldata)
  let deploymentPayload = null;
  let payloadError = null;
  try {
    if (snapshot?.name && snapshot?.symbol && snapshot?.supply) {
      const calldata = buildDeploymentData({
        name: snapshot.name,
        symbol: snapshot.symbol,
        supplyWhole: snapshot.supply,
      });
      deploymentPayload = {
        to: null, // Contract creation transaction
        value: "0x0",
        valueWei: "0",
        data: calldata,
        dataLengthBytes: (calldata.length - 2) / 2,
        constructorArguments: {
          name: snapshot.name,
          symbol: snapshot.symbol,
          supplyWhole: snapshot.supply.toString(),
          supplyScaledWei: (BigInt(snapshot.supply) * 10n ** 18n).toString(),
        },
      };
    } else {
      payloadError = "Snapshot missing name, symbol, or supply; cannot build calldata.";
    }
  } catch (err) {
    payloadError = err?.message || String(err);
  }

  // 6. Query Observed Balance from Provider
  let observedBalance = null;
  if (targetAccount) {
    try {
      const balanceHex = await provider.request({
        method: "eth_getBalance",
        params: [targetAccount, "latest"],
      });
      const balanceWei = BigInt(balanceHex);
      observedBalance = {
        account: targetAccount,
        balanceHex,
        balanceWei: balanceWei.toString(),
        balanceEth: formatEther(balanceWei),
      };
    } catch (err) {
      observedBalance = {
        account: targetAccount,
        error: err?.message || String(err),
      };
    }
  }

  // 7. Query Observed Network Fee Parameters
  let observedFeeParameters = {};
  try {
    const gasPriceHex = await provider.request({ method: "eth_gasPrice" });
    const gasPriceWei = BigInt(gasPriceHex);
    observedFeeParameters.gasPriceHex = gasPriceHex;
    observedFeeParameters.gasPriceWei = gasPriceWei.toString();
    observedFeeParameters.gasPriceGwei = (Number(gasPriceWei) / 1e9).toFixed(4);
  } catch (err) {
    observedFeeParameters.gasPriceError = err?.message || String(err);
  }

  try {
    const priorityFeeHex = await provider.request({ method: "eth_maxPriorityFeePerGas" });
    const priorityFeeWei = BigInt(priorityFeeHex);
    observedFeeParameters.maxPriorityFeePerGasHex = priorityFeeHex;
    observedFeeParameters.maxPriorityFeePerGasWei = priorityFeeWei.toString();
    observedFeeParameters.maxPriorityFeePerGasGwei = (Number(priorityFeeWei) / 1e9).toFixed(4);
  } catch {
    observedFeeParameters.maxPriorityFeePerGas = "Not supported by provider RPC";
  }

  try {
    const block = await provider.request({
      method: "eth_getBlockByNumber",
      params: ["latest", false],
    });
    if (block) {
      observedFeeParameters.latestBlockNumber = block.number ? parseInt(block.number, 16) : null;
      if (block.baseFeePerGas) {
        const baseFeeWei = BigInt(block.baseFeePerGas);
        observedFeeParameters.baseFeePerGasHex = block.baseFeePerGas;
        observedFeeParameters.baseFeePerGasWei = baseFeeWei.toString();
        observedFeeParameters.baseFeePerGasGwei = (Number(baseFeeWei) / 1e9).toFixed(4);
      }
    }
  } catch (err) {
    observedFeeParameters.blockError = err?.message || String(err);
  }

  // 8. Fresh RPC Simulations via selected provider
  let simulationResults = {
    eth_call: null,
    eth_estimateGas: null,
  };

  if (targetAccount && deploymentPayload?.data) {
    // Fresh eth_call simulation
    try {
      const callData = await provider.request({
        method: "eth_call",
        params: [
          {
            from: targetAccount,
            data: deploymentPayload.data,
            value: "0x0",
          },
          "latest",
        ],
      });
      simulationResults.eth_call = {
        success: true,
        status: "SUCCESS",
        returnData: callData,
      };
    } catch (err) {
      simulationResults.eth_call = {
        success: false,
        status: "REVERT_OR_ERROR",
        code: err?.code ?? null,
        message: err?.message || String(err),
        data: err?.data ?? null,
      };
    }

    // Fresh eth_estimateGas simulation
    try {
      const estGasHex = await provider.request({
        method: "eth_estimateGas",
        params: [
          {
            from: targetAccount,
            data: deploymentPayload.data,
            value: "0x0",
          },
        ],
      });
      const estGasInt = parseInt(estGasHex, 16);
      simulationResults.eth_estimateGas = {
        success: true,
        status: "SUCCESS",
        gasLimitHex: estGasHex,
        gasLimitDecimal: estGasInt,
      };
    } catch (err) {
      simulationResults.eth_estimateGas = {
        success: false,
        status: "FAILED_OR_REVERTED",
        code: err?.code ?? null,
        message: err?.message || String(err),
        data: err?.data ?? null,
      };
    }
  }

  // 9. Separate Observed Fee Parameters from Assumed/Estimated Parameters
  let feeAnalysis = null;
  const gasUnitsEstimate = simulationResults.eth_estimateGas?.gasLimitDecimal
    ? BigInt(simulationResults.eth_estimateGas.gasLimitDecimal)
    : gasEstimate?.gasLimit
    ? BigInt(gasEstimate.gasLimit)
    : null;

  const observedGasPriceWei = observedFeeParameters.gasPriceWei
    ? BigInt(observedFeeParameters.gasPriceWei)
    : null;

  if (gasUnitsEstimate && observedGasPriceWei && observedBalance?.balanceWei) {
    const totalEstimatedFeeWei = gasUnitsEstimate * observedGasPriceWei;
    const accountBalanceWei = BigInt(observedBalance.balanceWei);
    const hasSufficientBalance = accountBalanceWei >= totalEstimatedFeeWei;
    const balanceDifferenceWei = accountBalanceWei - totalEstimatedFeeWei;

    feeAnalysis = {
      observedFeeParameters: {
        source: "Live RPC eth_gasPrice & eth_getBlockByNumber",
        gasPriceGwei: observedFeeParameters.gasPriceGwei,
        baseFeePerGasGwei: observedFeeParameters.baseFeePerGasGwei || "N/A",
      },
      estimatedFeeParameters: {
        source: "Calculated from eth_estimateGas * gasPrice",
        estimatedGasUnits: gasUnitsEstimate.toString(),
        totalEstimatedFeeWei: totalEstimatedFeeWei.toString(),
        totalEstimatedFeeEth: formatEther(totalEstimatedFeeWei),
      },
      balanceSufficiency: {
        account: targetAccount,
        balanceEth: observedBalance.balanceEth,
        totalEstimatedFeeEth: formatEther(totalEstimatedFeeWei),
        hasSufficientFundsForGas: hasSufficientBalance,
        marginEth: formatEther(balanceDifferenceWei > 0n ? balanceDifferenceWei : -balanceDifferenceWei),
        marginType: hasSufficientBalance ? "SURPLUS" : "DEFICIT",
      },
    };
  }

  return {
    _securityNotice:
      "SAFE DIAGNOSTIC: Contains only public blockchain parameters, RPC responses, and addresses. Private keys, mnemonics, and secrets are NEVER accessed.",
    timestamp,
    connector: connectorInfo,
    network: {
      expectedChainId: SEPOLIA_CHAIN_ID,
      expectedChainIdHex: "0xaa36a7",
      providerChainId,
      providerChainIdHex,
      isChainMatching: providerChainId === SEPOLIA_CHAIN_ID,
      error: chainError,
    },
    accounts: {
      reviewedSender,
      connectedAddress,
      isSenderConsistent,
      providerAuthorizedAccounts: authorizedAccounts,
      isReviewedAccountAuthorized,
      accountsError,
    },
    deploymentPayload: deploymentPayload || { error: payloadError },
    observedBalance,
    observedFeeParameters,
    freshRpcSimulations: simulationResults,
    feeAnalysis,
  };
}
