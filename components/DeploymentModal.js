"use client";

import { useState, useEffect, useMemo, useRef, useSyncExternalStore, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAccount, useDeployContract, usePublicClient, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { createPublicClient, custom } from "viem";
import { useQuery } from "@tanstack/react-query";
import artifact from "@/lib/contracts/ERC20FixedSupply.json";
import {
  SEPOLIA_CHAIN_ID,
  getSepoliaExplorerTxUrl,
  getSepoliaExplorerAddressUrl,
  estimateDeploymentGas,
  verifyDeployedToken,
} from "@/lib/tokenDeployment";
import { formatBigIntWithCommas, getSupplyScaleLabel } from "@/lib/formatters";
import { TOKEN_DECIMALS } from "@/lib/tokenValidation";

/**
 * DeploymentModal:
 * Manages the token deployment flow on Ethereum Sepolia:
 * Review -> Estimating -> Awaiting wallet approval -> Forging token... -> Confirmed / Failed.
 */
export default function DeploymentModal({
  isOpen,
  onClose,
  name,
  symbol,
  supply,
  supplyBigInt,
  onResetBlueprint,
}) {
  const { address, isConnected, chainId, connector } = useAccount();
  const publicClient = usePublicClient();
  const { switchChain, isPending: isSwitchPending } = useSwitchChain();
  const { deployContractAsync } = useDeployContract();

  // Snapshot of parameters captured on modal mount
  const [snapshot, setSnapshot] = useState(() => ({
    name: name.trim(),
    symbol: symbol.trim().toUpperCase(),
    supply: supply.trim(),
    supplyBigInt,
    address,
    chainId,
  }));

  // Flow State: 'ready' | 'awaiting-approval' | 'forging' | 'confirmed' | 'failed'
  const [deploymentState, setDeploymentState] = useState("ready");

  // Deployment Results
  const [txHash, setTxHash] = useState(null);
  const [contractAddress, setDeployedAddress] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [verificationError, setVerificationError] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isConfirmationTimedOut, setIsConfirmationTimedOut] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Clipboard copy state
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedTxHash, setCopiedTxHash] = useState(false);

  // Modal references
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);

  // Client mounting tracking for Portal
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Helper to obtain client for receipt & verification (uses selected wallet connector provider if available, falls back to publicClient)
  const getTrackingClient = useCallback(async () => {
    try {
      let provider = null;
      if (connector && typeof connector.getProvider === "function") {
        provider = await connector.getProvider();
      } else if (typeof window !== "undefined" && window.ethereum) {
        provider = window.ethereum;
      }
      if (provider && typeof provider.request === "function") {
        return createPublicClient({
          chain: sepolia,
          transport: custom(provider),
          pollingInterval: 500,
        });
      }
    } catch {
      // Fallback to publicClient
    }
    return publicClient;
  }, [connector, publicClient]);

  // Check if reviewed parameters or wallet changed while modal was open
  const hasParametersChanged = useMemo(() => {
    if (!snapshot) return false;
    return (
      name.trim() !== snapshot.name ||
      symbol.trim().toUpperCase() !== snapshot.symbol ||
      supply.trim() !== snapshot.supply ||
      address !== snapshot.address ||
      chainId !== snapshot.chainId
    );
  }, [snapshot, name, symbol, supply, address, chainId]);

  // Gas estimation query using TanStack React Query (no setState in useEffect)
  const {
    data: gasEstimate,
    isLoading: isEstimating,
    error: estimationError,
    refetch: refetchGasEstimate,
  } = useQuery({
    queryKey: [
      "deploymentGasEstimate",
      snapshot?.name,
      snapshot?.symbol,
      snapshot?.supply,
      address,
      chainId,
    ],
    queryFn: async () => {
      if (!address || !snapshot) return null;
      const client = await getTrackingClient();
      if (!client) return null;
      return estimateDeploymentGas({
        publicClient: client,
        name: snapshot.name,
        symbol: snapshot.symbol,
        supplyWhole: snapshot.supply,
        account: address,
      });
    },
    enabled: Boolean(
      isOpen &&
        snapshot &&
        address &&
        chainId === SEPOLIA_CHAIN_ID &&
        deploymentState === "ready"
    ),
    staleTime: 30_000,
    retry: false,
  });

  // Background scroll lock
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Focus trap and initial focus
  useEffect(() => {
    if (!isOpen) return;
    const modal = modalRef.current;
    if (!modal) return;

    closeButtonRef.current?.focus();

    const handleTabKey = (e) => {
      if (e.key !== "Tab") return;
      const focusable = modal.querySelectorAll(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    modal.addEventListener("keydown", handleTabKey);
    return () => modal.removeEventListener("keydown", handleTabKey);
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        // Prevent accidental closing while awaiting approval or waiting for receipt
        if (deploymentState === "awaiting-approval" || deploymentState === "forging") {
          return;
        }
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, deploymentState, onClose]);

  // Handle explicit confirmation to deploy
  const handleConfirmDeploy = async () => {
    if (!isConnected || !address) {
      setErrorMessage("Wallet is not connected. Please connect your wallet first.");
      setDeploymentState("failed");
      return;
    }

    if (chainId !== SEPOLIA_CHAIN_ID) {
      setErrorMessage("Deployment is strictly restricted to Ethereum Sepolia (Chain ID: 11155111).");
      setDeploymentState("failed");
      return;
    }

    // Verify provider's actual chain ID directly to ensure network switch has fully completed
    if (connector && typeof connector.getProvider === "function") {
      try {
        const provider = await connector.getProvider();
        if (provider && typeof provider.request === "function") {
          const providerChainIdHex = await provider.request({ method: "eth_chainId" });
          const providerChainId = parseInt(providerChainIdHex, 16);
          if (providerChainId !== SEPOLIA_CHAIN_ID) {
            setErrorMessage(
              `Wallet is currently on chain ID ${providerChainId} (0x${providerChainId.toString(16)}). Please switch your wallet to Ethereum Sepolia (11155111 / 0xaa36a7) and try again.`
            );
            setDeploymentState("failed");
            return;
          }
        }
      } catch {
        // Fall back to React state check
      }
    }

    if (hasParametersChanged) {
      setSnapshot({
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        supply: supply.trim(),
        supplyBigInt,
        address,
        chainId,
      });
      return;
    }

    setDeploymentState("awaiting-approval");
    setErrorMessage(null);
    setIsConfirmationTimedOut(false);

    try {
      // 1. Dispatch contract creation transaction to connected wallet with explicit account, value, and pre-calculated gas
      const hash = await deployContractAsync({
        abi: artifact.abi,
        bytecode: artifact.bytecode,
        args: [snapshot.name, snapshot.symbol, BigInt(snapshot.supply)],
        chainId: SEPOLIA_CHAIN_ID,
        account: address,
        value: 0n,
        ...(gasEstimate?.gasLimit ? { gas: gasEstimate.gasLimit } : {}),
        ...(connector ? { connector } : {}),
      });

      setTxHash(hash);
      setDeploymentState("forging");

      // 2. Track transaction receipt on Sepolia
      const trackingClient = await getTrackingClient();
      try {
        const receipt = await trackingClient.waitForTransactionReceipt({
          hash,
          confirmations: 1,
          timeout: 90_000,
        });

        if (receipt.status === "reverted") {
          setDeploymentState("failed");
          setErrorMessage(
            "Transaction was reverted on-chain by the Ethereum Sepolia network. Gas was consumed but the contract was not deployed."
          );
          return;
        }

        const deployed = receipt.contractAddress;
        if (!deployed) {
          setDeploymentState("failed");
          setErrorMessage("Receipt confirmed, but contract address was not returned by the network.");
          return;
        }

        setDeployedAddress(deployed);
        setDeploymentState("confirmed");

        // 3. Execute on-chain verification readback
        try {
          const verification = await verifyDeployedToken({
            publicClient: trackingClient,
            contractAddress: deployed,
            expectedName: snapshot.name,
            expectedSymbol: snapshot.symbol,
            expectedWholeSupply: snapshot.supply,
            deployerAddress: address,
          });
          setVerificationResult(verification);
        } catch {
          setVerificationError(
            "On-chain readback verification timed out. Contract address is valid on Sepolia."
          );
        }
      } catch (receiptErr) {
        if (receiptErr?.name === "WaitForTransactionReceiptTimeoutError") {
          setIsConfirmationTimedOut(true);
        } else {
          setDeploymentState("failed");
          const msg = receiptErr?.shortMessage || receiptErr?.message || "";
          if (
            msg.toLowerCase().includes("revert") ||
            receiptErr?.name === "TransactionReceiptRevertedError"
          ) {
            setErrorMessage(
              "Transaction was reverted on-chain by the Ethereum Sepolia network. Gas was consumed but the contract was not deployed."
            );
          } else {
            setErrorMessage(
              receiptErr?.shortMessage ||
                receiptErr?.message ||
                "Failed waiting for transaction receipt on Sepolia."
            );
          }
        }
      }
    } catch (deployErr) {
      const isRejected =
        deployErr?.code === 4001 ||
        deployErr?.name === "UserRejectedRequestError" ||
        deployErr?.message?.toLowerCase().includes("rejected") ||
        deployErr?.message?.toLowerCase().includes("denied");

      setDeploymentState("failed");

      if (isRejected) {
        setErrorMessage("Deployment request was rejected in your wallet.");
      } else {
        setErrorMessage(
          deployErr?.shortMessage ||
            deployErr?.message ||
            "Failed to send contract deployment transaction."
        );
      }
    }
  };

  // Recheck transaction receipt if timeout occurred
  const handleRecheckReceipt = async () => {
    if (!txHash) return;
    setIsCheckingStatus(true);
    try {
      const trackingClient = await getTrackingClient();
      const receipt = await trackingClient.getTransactionReceipt({ hash: txHash });
      if (receipt) {
        if (receipt.status === "reverted") {
          setDeploymentState("failed");
          setErrorMessage("Transaction was reverted on-chain by the Ethereum Sepolia network.");
          setIsConfirmationTimedOut(false);
        } else if (receipt.contractAddress) {
          setDeployedAddress(receipt.contractAddress);
          setDeploymentState("confirmed");
          setIsConfirmationTimedOut(false);
          // Run verification
          try {
            const verification = await verifyDeployedToken({
              publicClient: trackingClient,
              contractAddress: receipt.contractAddress,
              expectedName: snapshot.name,
              expectedSymbol: snapshot.symbol,
              expectedWholeSupply: snapshot.supply,
              deployerAddress: address,
            });
            setVerificationResult(verification);
          } catch {
            setVerificationError("Readback verification encountered network delay.");
          }
        }
      } else {
        alert("Transaction is still pending on Sepolia. Please check again in a few moments.");
      }
    } catch {
      alert("Receipt not yet found on Sepolia RPC. It may still be processing.");
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Retry verification readback
  const handleRetryVerification = async () => {
    if (!contractAddress || !snapshot) return;
    setVerificationError(null);
    try {
      const trackingClient = await getTrackingClient();
      const verification = await verifyDeployedToken({
        publicClient: trackingClient,
        contractAddress,
        expectedName: snapshot.name,
        expectedSymbol: snapshot.symbol,
        expectedWholeSupply: snapshot.supply,
        deployerAddress: address,
      });
      setVerificationResult(verification);
    } catch {
      setVerificationError("Verification retry timed out. Contract address is valid.");
    }
  };

  // Copy helpers
  const handleCopyAddress = () => {
    if (!contractAddress) return;
    navigator.clipboard.writeText(contractAddress).then(() => {
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    });
  };

  const handleCopyTxHash = () => {
    if (!txHash) return;
    navigator.clipboard.writeText(txHash).then(() => {
      setCopiedTxHash(true);
      setTimeout(() => setCopiedTxHash(false), 2000);
    });
  };

  // Reset blueprint and start fresh
  const handleForgeAnother = () => {
    if (onResetBlueprint) onResetBlueprint();
    onClose();
  };

  const isWrongNetwork = isConnected && chainId !== SEPOLIA_CHAIN_ID;
  const isPending = deploymentState === "awaiting-approval" || deploymentState === "forging";

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="deployment-modal-title"
    >
      <div className="flex min-h-full items-center justify-center p-3 sm:p-6 text-center">
        <div
          ref={modalRef}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3.5rem)] flex flex-col rounded-2xl bg-forge-surface border border-forge-border p-5 sm:p-6 shadow-2xl text-left my-auto animate-in fade-in zoom-in-95 duration-150 relative"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-forge-border flex-shrink-0">
            <div>
              <h3
                id="deployment-modal-title"
                className="text-lg font-bold text-forge-textPrimary tracking-tight flex items-center gap-2"
              >
                <span>
                  {deploymentState === "confirmed"
                    ? "Token Forged Successfully"
                    : deploymentState === "forging"
                    ? "Forging Token on Sepolia"
                    : deploymentState === "awaiting-approval"
                    ? "Awaiting Wallet Approval"
                    : deploymentState === "failed"
                    ? "Deployment Failed"
                    : "Review Token Blueprint"}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-950/40 text-orange-300 border border-orange-500/30">
                  Sepolia
                </span>
              </h3>
              <p className="text-xs text-forge-textSecondary mt-0.5">
                Fixed-Supply ERC-20 • Chain ID 11155111
              </p>
            </div>
            {!isPending && (
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-forge-textMuted hover:text-forge-textPrimary hover:bg-forge-surfaceElevated transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
                aria-label="Close deployment dialog"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto pr-1 -mr-1 mt-4 space-y-4">
            {/* Wrong Network Notice */}
            {isWrongNetwork && (
              <div className="p-3.5 rounded-xl bg-orange-950/30 border border-orange-500/40 text-xs text-orange-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-semibold block text-orange-300">Unsupported Network</span>
                    <span>Deployment is restricted to Ethereum Sepolia. Your wallet is currently on Chain ID {chainId}.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => switchChain({ chainId: SEPOLIA_CHAIN_ID })}
                    disabled={isSwitchPending}
                    className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs transition-colors flex-shrink-0"
                  >
                    {isSwitchPending ? "Switching..." : "Switch to Sepolia"}
                  </button>
                </div>
              </div>
            )}

            {/* Parameter Change Notice */}
            {hasParametersChanged && deploymentState === "ready" && (
              <div className="p-3 rounded-xl bg-yellow-950/30 border border-yellow-500/40 text-xs text-yellow-200">
                <span className="font-semibold block text-yellow-300">Blueprint Parameters Changed</span>
                <span>The parameters in the form changed since opening this review. Please review the updated specifications below before confirming.</span>
              </div>
            )}

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-950/25 border border-red-500/40 text-xs text-red-200">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <div>
                    <p className="font-semibold text-red-300">Action Required</p>
                    <p className="text-forge-textSecondary mt-0.5">{errorMessage}</p>
                  </div>
                </div>
              </div>
            )}

            {/* STATE: READY TO REVIEW */}
            {deploymentState === "ready" && snapshot && (
              <div className="space-y-3.5">
                <div className="rounded-xl bg-forge-surfaceElevated border border-forge-border p-4 space-y-3 text-xs">
                  <div className="flex justify-between items-baseline border-b border-forge-border pb-2.5">
                    <span className="text-forge-textMuted uppercase font-mono tracking-wider">Token Name</span>
                    <span className="font-semibold text-sm text-forge-textPrimary">{snapshot.name}</span>
                  </div>
                  <div className="flex justify-between items-baseline border-b border-forge-border pb-2.5">
                    <span className="text-forge-textMuted uppercase font-mono tracking-wider">Token Symbol</span>
                    <span className="font-mono font-bold text-orange-400">{snapshot.symbol}</span>
                  </div>
                  <div className="flex justify-between items-baseline border-b border-forge-border pb-2.5">
                    <div>
                      <span className="text-forge-textMuted uppercase font-mono tracking-wider block">Whole-Token Supply</span>
                      <span className="text-[10px] text-forge-textMuted">Passed directly to constructor</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-sm text-forge-textPrimary block">
                        {formatBigIntWithCommas(BigInt(snapshot.supply))} {snapshot.symbol}
                      </span>
                      <span className="text-[10px] font-mono text-orange-400">
                        {getSupplyScaleLabel(BigInt(snapshot.supply))}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-baseline border-b border-forge-border pb-2.5">
                    <span className="text-forge-textMuted uppercase font-mono tracking-wider">Decimals</span>
                    <span className="font-mono text-forge-textPrimary">{TOKEN_DECIMALS} (Fixed ERC-20)</span>
                  </div>
                  <div className="flex justify-between items-baseline border-b border-forge-border pb-2.5">
                    <div>
                      <span className="text-forge-textMuted uppercase font-mono tracking-wider block">Recipient Wallet</span>
                      <span className="text-[10px] text-forge-textMuted">Receives 100% of supply</span>
                    </div>
                    <span className="font-mono text-xs text-orange-300 truncate max-w-[200px]" title={address}>
                      {address ? `${address.slice(0, 8)}...${address.slice(-6)}` : "Not connected"}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline border-b border-forge-border pb-2.5">
                    <span className="text-forge-textMuted uppercase font-mono tracking-wider">Target Network</span>
                    <span className="font-semibold text-forge-textPrimary">Ethereum Sepolia (11155111)</span>
                  </div>
                  <div className="flex justify-between items-baseline border-b border-forge-border pb-2.5">
                    <span className="text-forge-textMuted uppercase font-mono tracking-wider">Transaction Value</span>
                    <span className="font-mono font-semibold text-emerald-400">0.0 ETH (Gas only)</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-0.5">
                    <span className="text-forge-textMuted uppercase font-mono tracking-wider">Estimated Gas Fee</span>
                    <div className="text-right font-mono">
                      {isEstimating ? (
                        <span className="text-orange-400 animate-pulse">Estimating network gas...</span>
                      ) : gasEstimate ? (
                        <div>
                          <span className="text-orange-300 font-semibold">~{Number(gasEstimate.estimatedFeeEth).toFixed(5)} Sepolia ETH</span>
                          <span className="text-[10px] text-forge-textMuted block font-normal">
                            ({Number(gasEstimate.gasLimit).toLocaleString()} gas units)
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 justify-end">
                          <span className="text-forge-textMuted">Standard deployment gas</span>
                          <button
                            type="button"
                            onClick={() => refetchGasEstimate()}
                            className="text-[10px] text-orange-400 hover:underline"
                          >
                            Retry
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {estimationError && (
                  <p className="text-[11px] text-forge-textMuted leading-relaxed bg-forge-surfaceHighlight/60 p-2.5 rounded-lg border border-forge-border">
                    Gas estimation notice: Could not simulate deployment gas automatically (likely 0 testnet ETH balance or RPC delay). You can still proceed to confirm in your wallet.
                  </p>
                )}

                {/* Sepolia Testnet Notice */}
                <div className="p-3 rounded-xl bg-orange-950/20 border border-orange-500/30 text-xs text-orange-200">
                  <span className="font-semibold block text-orange-300">Ethereum Sepolia Testnet Only</span>
                  <span>
                    No real funds or mainnet assets are involved. The initial supply is minted exclusively to your connected Sepolia testnet address.
                  </span>
                </div>
              </div>
            )}

            {/* STATE: AWAITING APPROVAL */}
            {deploymentState === "awaiting-approval" && (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-orange-950/40 border border-orange-500/40 flex items-center justify-center">
                  <svg className="w-6 h-6 text-orange-400 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                </div>
                <h4 className="font-bold text-base text-forge-textPrimary">Approve Transaction in Wallet</h4>
                <p className="text-xs text-forge-textSecondary max-w-sm mx-auto leading-relaxed">
                  Please review the contract creation request and approve the deployment in your connected wallet.
                </p>
                <div className="pt-2 text-xs font-mono text-orange-300">
                  Deploying {snapshot?.name} ({snapshot?.symbol})
                </div>
              </div>
            )}

            {/* STATE: FORGING TOKEN ON SEPOLIA */}
            {deploymentState === "forging" && (
              <div className="py-5 text-center space-y-4">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-orange-950 via-forge-surfaceHighlight to-orange-900 border border-orange-500/40 flex items-center justify-center text-orange-400 shadow-lg animate-pulse">
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-lg text-forge-textPrimary">Forging Token on Sepolia…</h4>
                  <p className="text-xs text-forge-textSecondary mt-1 max-w-sm mx-auto">
                    Transaction broadcast to network. Waiting for block inclusion and receipt confirmation...
                  </p>
                </div>

                {txHash && (
                  <div className="p-3 rounded-xl bg-forge-surfaceElevated border border-forge-border text-xs text-left space-y-1.5">
                    <span className="text-forge-textMuted uppercase font-mono tracking-wider block">Transaction Hash</span>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-orange-300 truncate">{txHash}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={handleCopyTxHash}
                          className="px-2 py-0.5 rounded bg-forge-surfaceHighlight border border-forge-border text-forge-textSecondary hover:text-forge-textPrimary font-mono text-[11px]"
                        >
                          {copiedTxHash ? "Copied" : "Copy"}
                        </button>
                        <a
                          href={getSepoliaExplorerTxUrl(txHash)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-orange-400 hover:underline inline-flex items-center gap-1 font-semibold"
                        >
                          <span>Etherscan</span>
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {isConfirmationTimedOut && (
                  <div className="p-3 rounded-xl bg-yellow-950/30 border border-yellow-500/40 text-xs text-yellow-200 text-left space-y-2">
                    <span className="font-semibold block text-yellow-300">Confirmation Timeout Notice</span>
                    <span>
                      Sepolia receipt confirmation took longer than 90 seconds. Your transaction was broadcast and has not failed. You can recheck status now.
                    </span>
                    <button
                      type="button"
                      onClick={handleRecheckReceipt}
                      disabled={isCheckingStatus}
                      className="w-full py-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-300 font-semibold transition-colors"
                    >
                      {isCheckingStatus ? "Checking Status..." : "Recheck Receipt Status"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STATE: CONFIRMED (SUCCESS) */}
            {deploymentState === "confirmed" && contractAddress && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-center space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-full bg-emerald-900/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-base text-emerald-300">Token Successfully Deployed!</h4>
                  <p className="text-xs text-forge-textSecondary max-w-sm mx-auto">
                    Your ERC-20 fixed-supply token has been forged on Ethereum Sepolia and 100% of supply was minted to your wallet.
                  </p>
                </div>

                {/* Contract Address Card */}
                <div className="p-4 rounded-xl bg-forge-surfaceElevated border border-forge-border space-y-2">
                  <span className="text-xs font-mono uppercase tracking-wider text-forge-textMuted block">
                    Deployed Contract Address
                  </span>
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-forge-surfaceHighlight border border-forge-border">
                    <span className="font-mono text-xs text-orange-300 break-all select-all font-semibold">
                      {contractAddress}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyAddress}
                      className="px-3 py-1 rounded bg-forge-surfaceElevated hover:bg-forge-surface border border-forge-border hover:border-orange-500/50 text-xs font-mono text-forge-textPrimary transition-all flex-shrink-0"
                    >
                      {copiedAddress ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                {/* On-Chain Verification Readback Card */}
                <div className="p-3.5 rounded-xl bg-forge-surfaceElevated border border-forge-border text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-forge-textPrimary">On-Chain Parameter Readback</span>
                    {verificationResult?.isFullyVerified ? (
                      <span className="inline-flex items-center gap-1 font-mono text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>Verified</span>
                      </span>
                    ) : (
                      <span className="text-forge-textMuted font-mono">Pending Check</span>
                    )}
                  </div>

                  {verificationResult ? (
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-forge-textSecondary pt-1">
                      <div>Name: <span className="text-forge-textPrimary">{verificationResult.name}</span></div>
                      <div>Symbol: <span className="text-orange-400">{verificationResult.symbol}</span></div>
                      <div>Decimals: <span className="text-forge-textPrimary">{verificationResult.decimals}</span></div>
                      <div>Total Supply: <span className="text-forge-textPrimary">{formatBigIntWithCommas(verificationResult.totalSupply / 10n ** 18n)}</span></div>
                      <div className="col-span-2 text-emerald-300">
                        Deployer Balance: {formatBigIntWithCommas(verificationResult.deployerBalance / 10n ** 18n)} {verificationResult.symbol} (100%)
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-forge-textMuted">
                      <span>{verificationError || "Reading parameters back from Ethereum Sepolia..."}</span>
                      {verificationError && (
                        <button
                          type="button"
                          onClick={handleRetryVerification}
                          className="mt-1 block text-orange-400 hover:underline font-semibold"
                        >
                          Retry Verification Readback
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Sepolia Etherscan Links */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <a
                    href={getSepoliaExplorerAddressUrl(contractAddress)}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 rounded-xl bg-forge-surfaceElevated hover:bg-forge-surfaceHighlight border border-forge-border text-center font-semibold text-orange-300 hover:text-orange-200 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>View Contract</span>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                  {txHash && (
                    <a
                      href={getSepoliaExplorerTxUrl(txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 rounded-xl bg-forge-surfaceElevated hover:bg-forge-surfaceHighlight border border-forge-border text-center font-semibold text-forge-textSecondary hover:text-forge-textPrimary transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>View Transaction</span>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer Controls */}
          <div className="mt-4 pt-3.5 border-t border-forge-border flex items-center justify-between gap-3 flex-shrink-0">
            {deploymentState === "confirmed" ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-forge-border hover:bg-forge-surfaceElevated text-xs font-semibold text-forge-textSecondary hover:text-forge-textPrimary transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleForgeAnother}
                  className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  Forge Another Token
                </button>
              </>
            ) : deploymentState === "failed" ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-forge-border hover:bg-forge-surfaceElevated text-xs font-semibold text-forge-textSecondary hover:text-forge-textPrimary transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => setDeploymentState("ready")}
                  className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  Review & Try Again
                </button>
              </>
            ) : deploymentState === "forging" || deploymentState === "awaiting-approval" ? (
              <div className="w-full text-center text-xs text-forge-textMuted font-mono">
                Transaction in progress — please keep this window open.
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-forge-border hover:bg-forge-surfaceElevated text-xs font-semibold text-forge-textSecondary hover:text-forge-textPrimary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeploy}
                  disabled={isWrongNetwork || !isConnected || isPending}
                  className={`px-6 py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center gap-2 shadow-md ${
                    isWrongNetwork || !isConnected || isPending
                      ? "bg-forge-surfaceElevated text-forge-textMuted border border-forge-border cursor-not-allowed"
                      : "bg-orange-500 hover:bg-orange-600 text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500"
                  }`}
                >
                  <span>Confirm & Forge</span>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
