"use client";

import { useState, useEffect, useMemo, useRef, useTransition, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useChainId,
  useSwitchChain,
  useBalance,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { sepolia } from "wagmi/chains";
import {
  SUPPORTED_WALLETS,
  subscribeEIP6963,
  isWalletDetected,
  getLegacyProviderForRdns,
  isInsecureContext,
} from "@/lib/eip6963";

export default function WalletConnect() {
  const { address, isConnected, connector: activeConnector, chainId: accountChainId } = useAccount();
  const configChainId = useChainId();
  const chainId = accountChainId ?? configChainId;
  const { connect, connectors, isPending: isConnectPending, reset: resetConnect } =
    useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitchPending } = useSwitchChain();

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [announcedProviders, setAnnouncedProviders] = useState([]);
  const [selectedWalletRdns, setSelectedWalletRdns] = useState(null);
  const [copied, setCopied] = useState(false);
  const [uiError, setUiError] = useState(null);
  const [isRefreshingBalance, startBalanceTransition] = useTransition();

  // References for focus containment and return
  const triggerRef = useRef(null);
  const closeButtonRef = useRef(null);
  const modalRef = useRef(null);
  const detailsRef = useRef(null);

  // Client mounting tracking for Portal via useSyncExternalStore
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Safe external subscription for insecure HTTP context
  const isInsecure = useSyncExternalStore(
    () => () => {},
    () => isInsecureContext(),
    () => false
  );

  // EIP-6963 dynamic provider discovery
  useEffect(() => {
    const unsubscribe = subscribeEIP6963((providers) => {
      setAnnouncedProviders(providers);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Balance query for Sepolia ETH
  const {
    data: balanceData,
    isLoading: isBalanceLoading,
    isError: isBalanceError,
    refetch: refetchBalance,
  } = useBalance({
    address,
    chainId: sepolia.id,
    query: {
      enabled: isConnected && Boolean(address),
      staleTime: 15_000,
    },
  });

  const isUnsupportedNetwork = isConnected && chainId !== sepolia.id;

  // Active connected wallet info (if recognizable)
  const connectedWallet = useMemo(() => {
    if (!isConnected) return null;
    const activeRdns =
      selectedWalletRdns ||
      activeConnector?.rdns ||
      (activeConnector?.id && activeConnector.id !== "injected"
        ? activeConnector.id
        : null);
    if (!activeRdns) return null;
    return SUPPORTED_WALLETS.find((w) => w.rdns === activeRdns) || null;
  }, [isConnected, selectedWalletRdns, activeConnector]);

  // Open & Close handlers preserving focus return
  const handleOpenPicker = (e) => {
    triggerRef.current = e?.currentTarget || document.activeElement;
    setUiError(null);
    setIsPickerOpen(true);
  };

  const handleClosePicker = () => {
    setIsPickerOpen(false);
    setUiError(null);
    // Restore focus to opener element
    setTimeout(() => {
      if (triggerRef.current && typeof triggerRef.current.focus === "function") {
        triggerRef.current.focus();
      }
    }, 0);
  };

  // Lock background body scrolling when picker is open & restore on close
  useEffect(() => {
    if (isPickerOpen) {
      const originalOverflow = document.body.style.overflow;
      const originalPaddingRight = document.body.style.paddingRight;
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;
      };
    }
  }, [isPickerOpen]);

  // Focus containment (trap) & initial focus when dialog opens
  useEffect(() => {
    if (!isPickerOpen) return;
    const modal = modalRef.current;
    if (!modal) return;

    // Focus close button initially
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
  }, [isPickerOpen]);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (isPickerOpen) {
          handleClosePicker();
        }
        if (isDetailsOpen) {
          setIsDetailsOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPickerOpen, isDetailsOpen]);

  // Close details dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (detailsRef.current && !detailsRef.current.contains(e.target)) {
        setIsDetailsOpen(false);
      }
    };
    if (isDetailsOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isDetailsOpen]);

  // Format address (0x1234...5678)
  const formattedAddress = useMemo(() => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, [address]);

  // Handle clipboard copy
  const handleCopyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // User-initiated wallet selection
  const handleSelectWallet = (wallet) => {
    setUiError(null);
    if (resetConnect) resetConnect();

    // 1. Resolve exact target provider: discovered EIP-6963 provider or legacy injected provider
    const discovered = announcedProviders.find((p) => p.info?.rdns === wallet.rdns);
    const legacyProvider = getLegacyProviderForRdns(wallet.rdns);
    const targetProvider = discovered?.provider || legacyProvider;

    if (!targetProvider) {
      // Strictly prevent fallback to another wallet
      setUiError({
        type: "missing-provider",
        walletName: wallet.name,
        message:
          wallet.missingMessage ||
          `${wallet.name} provider is not available. Please verify your provider settings.`,
        downloadUrl: wallet.downloadUrl,
        isBuiltIn: wallet.isBuiltIn,
      });
      return;
    }

    // 2. Locate the matching Wagmi connector for this wallet.
    // Wagmi's multiInjectedProviderDiscovery registers connectors with connector.id = wallet.rdns.
    let matchingConnector = connectors.find(
      (c) => c.id === wallet.rdns || c.rdns === wallet.rdns
    );

    // If Wagmi has not registered the connector yet or if using a legacy provider,
    // construct an injected connector targeting the exact discovered provider directly.
    if (!matchingConnector) {
      matchingConnector = injected({
        target: {
          id: wallet.rdns,
          name: wallet.name,
          icon: discovered?.info?.icon,
          provider: () => targetProvider,
        },
      });
    }

    setSelectedWalletRdns(wallet.rdns);

    // 3. Explicitly connect to the target wallet with Sepolia chainId
    connect(
      { connector: matchingConnector, chainId: sepolia.id },
      {
        onSuccess: () => {
          handleClosePicker();
          setUiError(null);
        },
        onError: (err) => {
          // Check for user rejection (EIP-1193 code 4001 or message)
          const isRejected =
            err?.code === 4001 ||
            err?.name === "UserRejectedRequestError" ||
            err?.message?.toLowerCase().includes("rejected") ||
            err?.message?.toLowerCase().includes("denied");

          if (isRejected) {
            setUiError({
              type: "rejected",
              walletName: wallet.name,
              message: `Connection request was rejected in ${wallet.name}.`,
            });
          } else {
            setUiError({
              type: "error",
              walletName: wallet.name,
              message: err?.shortMessage || err?.message || "Failed to connect wallet.",
            });
          }
        },
      }
    );
  };

  // User-initiated network switch to Sepolia
  const handleSwitchToSepolia = () => {
    setUiError(null);
    switchChain(
      { chainId: sepolia.id },
      {
        onError: (err) => {
          const isRejected =
            err?.code === 4001 ||
            err?.name === "UserRejectedRequestError" ||
            err?.message?.toLowerCase().includes("rejected");
          setUiError({
            type: "switch-error",
            message: isRejected
              ? "Network switch request was rejected in your wallet."
              : err?.shortMessage || err?.message || "Failed to switch network to Sepolia.",
          });
        },
      }
    );
  };

  // Manual balance refresh
  const handleRefreshBalance = () => {
    startBalanceTransition(async () => {
      await refetchBalance();
    });
  };

  // Disconnect handler
  const handleDisconnect = () => {
    disconnect();
    setIsDetailsOpen(false);
    setSelectedWalletRdns(null);
    setUiError(null);
  };

  // Render wallet icon
  const renderWalletIcon = (rdns) => {
    switch (rdns) {
      case "io.metamask":
        return (
          <Image
            src="/wallets/metamask.svg"
            alt="MetaMask"
            width={20}
            height={20}
            className="w-5 h-5 flex-shrink-0 object-contain"
          />
        );
      case "com.brave.wallet":
        return (
          <Image
            src="/wallets/brave.svg"
            alt="Brave Wallet"
            width={20}
            height={20}
            className="w-5 h-5 flex-shrink-0 object-contain"
          />
        );
      case "app.phantom":
        return (
          <Image
            src="/wallets/phantom.svg"
            alt="Phantom"
            width={20}
            height={20}
            className="w-5 h-5 flex-shrink-0 object-contain rounded-[4px]"
          />
        );
      case "com.coinbase.wallet":
        return (
          <Image
            src="/wallets/coinbase.svg"
            alt="Coinbase Wallet"
            width={20}
            height={20}
            className="w-5 h-5 flex-shrink-0 object-contain rounded-[4px]"
          />
        );
      default:
        return (
          <svg
            className="w-5 h-5 text-orange-400 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
            <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
          </svg>
        );
    }
  };

  return (
    <div className="relative">
      {/* =========================================================================
          PRIMARY BAR (HEADER DISPLAY)
          Shows Connect Button or Connected Pill with Network, Balance, Address
         ========================================================================= */}
      {!isConnected ? (
        <button
          type="button"
          onClick={handleOpenPicker}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500/20 via-orange-600/30 to-orange-500/20 hover:from-orange-500/30 hover:to-orange-600/30 border border-orange-500/50 hover:border-orange-500 text-orange-200 font-medium text-xs sm:text-sm tracking-wide transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-forge-bg"
          aria-label="Connect Wallet"
        >
          <svg
            className="w-4 h-4 text-orange-400 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
            <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
          </svg>
          <span>Connect Wallet</span>
        </button>
      ) : (
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Unsupported Network Warning Pill */}
          {isUnsupportedNetwork ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-950/40 border border-red-500/50 text-red-300 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
              <span>Wrong Network</span>
              <button
                type="button"
                onClick={handleSwitchToSepolia}
                disabled={isSwitchPending}
                className="ml-1 px-2 py-0.5 rounded-lg bg-red-900/60 hover:bg-red-800 border border-red-400/40 text-white font-sans text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {isSwitchPending ? "Switching..." : "Switch to Sepolia"}
              </button>
            </div>
          ) : (
            /* Supported Sepolia Network Pill */
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-forge-surfaceElevated border border-forge-border text-xs text-forge-textSecondary">
              <span className="w-2 h-2 rounded-full bg-orange-400" aria-hidden="true" />
              <span className="font-medium text-forge-textPrimary">Sepolia</span>
            </div>
          )}

          {/* Native Sepolia ETH Balance Display */}
          {!isUnsupportedNetwork && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-forge-surfaceElevated border border-forge-border text-xs font-mono">
              <span className="text-forge-textMuted">Balance:</span>
              {isBalanceLoading ? (
                <span className="text-forge-textMuted animate-pulse">Loading...</span>
              ) : isBalanceError ? (
                <span className="text-red-400 text-xs">Error</span>
              ) : (
                <span className="font-semibold text-forge-textPrimary">
                  {balanceData
                    ? `${Number(balanceData.formatted).toFixed(4)} ${balanceData.symbol}`
                    : "0.0000 SEP"}
                </span>
              )}
              {/* Manual refresh button */}
              <button
                type="button"
                onClick={handleRefreshBalance}
                disabled={isRefreshingBalance}
                title="Refresh native Sepolia ETH balance"
                className="text-forge-textMuted hover:text-orange-400 transition-colors ml-0.5 focus:outline-none"
                aria-label="Refresh balance"
              >
                <svg
                  className={`w-3.5 h-3.5 ${isRefreshingBalance ? "animate-spin text-orange-400" : ""}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
              </button>
            </div>
          )}

          {/* Connected Address & Account Details Toggle */}
          <div className="relative" ref={detailsRef}>
            <button
              type="button"
              onClick={() => setIsDetailsOpen(!isDetailsOpen)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-forge-surfaceElevated hover:bg-forge-surfaceHighlight border border-forge-border hover:border-forge-borderHover text-xs font-mono text-forge-textPrimary transition-colors focus:ring-2 focus:ring-orange-500"
              aria-expanded={isDetailsOpen}
              aria-haspopup="true"
              aria-label="Account details menu"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" aria-hidden="true" />
              <span className="font-semibold">{formattedAddress}</span>
              <svg
                className={`w-3.5 h-3.5 text-forge-textMuted transition-transform ${
                  isDetailsOpen ? "rotate-180" : ""
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {/* Account Details Dropdown */}
            {isDetailsOpen && (
              <div
                className="absolute right-0 mt-2 w-72 rounded-2xl bg-forge-surface border border-forge-border p-4 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100"
                role="dialog"
                aria-label="Connected Account Overview"
              >
                <div className="flex items-center justify-between pb-3 border-b border-forge-border">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span className="text-xs font-semibold text-forge-textPrimary uppercase tracking-wider">
                      Connected
                    </span>
                  </div>
                  {connectedWallet && (
                    <span className="text-xs font-mono text-orange-300 px-2 py-0.5 rounded bg-forge-surfaceElevated border border-forge-border">
                      {connectedWallet.name}
                    </span>
                  )}
                </div>

                {/* Address Showcase with Copy */}
                <div className="mt-3 p-3 rounded-xl bg-forge-surfaceElevated border border-forge-border">
                  <span className="text-xs text-forge-textMuted uppercase tracking-wider block font-mono">
                    Account Address
                  </span>
                  <p className="mt-1 font-mono text-xs text-forge-textPrimary break-all select-all">
                    {address}
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyAddress}
                    className="mt-2 text-xs font-mono text-orange-400 hover:text-forge-textPrimary flex items-center gap-1.5 transition-colors focus:outline-none"
                  >
                    {copied ? (
                      <>
                        <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span className="text-emerald-400 font-semibold">Address Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        <span>Copy Address</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Balance Section */}
                <div className="mt-3 p-3 rounded-xl bg-forge-surfaceElevated border border-forge-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-forge-textMuted uppercase tracking-wider font-mono">
                      Sepolia ETH Balance
                    </span>
                    <button
                      type="button"
                      onClick={handleRefreshBalance}
                      disabled={isRefreshingBalance}
                      className="text-xs text-orange-400 hover:text-forge-textPrimary transition-colors flex items-center gap-1"
                    >
                      <svg
                        className={`w-3 h-3 ${isRefreshingBalance ? "animate-spin" : ""}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                      </svg>
                      <span>Refresh</span>
                    </button>
                  </div>
                  <p className="mt-1 text-sm font-bold font-mono text-forge-textPrimary">
                    {isBalanceLoading
                      ? "Loading balance..."
                      : isBalanceError
                      ? "Unable to fetch Sepolia balance"
                      : `${Number(balanceData?.formatted || 0).toFixed(4)} ${balanceData?.symbol || "SEP"}`}
                  </p>
                </div>

                {/* Network Switch Action if on wrong network */}
                {isUnsupportedNetwork && (
                  <div className="mt-3 p-3 rounded-xl bg-red-950/30 border border-red-500/40">
                    <p className="text-xs text-red-300 font-medium">
                      Unsupported network detected (Chain ID: {chainId}).
                    </p>
                    <button
                      type="button"
                      onClick={handleSwitchToSepolia}
                      disabled={isSwitchPending}
                      className="mt-2 w-full py-1.5 px-3 rounded-lg bg-red-900/80 hover:bg-red-800 text-xs font-semibold text-white transition-colors"
                    >
                      {isSwitchPending ? "Switching..." : "Switch to Ethereum Sepolia"}
                    </button>
                  </div>
                )}

                {/* Disconnect Action */}
                <div className="mt-4 pt-3 border-t border-forge-border flex items-center justify-between">
                  <a
                    href={`https://sepolia.etherscan.io/address/${address}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-forge-textSecondary hover:text-orange-400 transition-colors flex items-center gap-1"
                  >
                    <span>Sepolia Etherscan</span>
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="px-3 py-1 rounded-lg border border-red-500/40 bg-red-950/20 hover:bg-red-900/40 text-red-400 text-xs font-semibold transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          WALLET PICKER MODAL (PORTAL OUTSIDE HEADER)
          Rendered through document.body to avoid header/layout clipping contexts.
          Uses fixed full-viewport backdrop with internal scrolling on short screens.
         ========================================================================= */}
      {mounted &&
        isPickerOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] overflow-y-auto bg-black/80 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleClosePicker();
              }
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-picker-title"
          >
            <div className="flex min-h-full items-center justify-center p-3 sm:p-6 text-center">
              <div
                ref={modalRef}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3.5rem)] flex flex-col rounded-2xl bg-forge-surface border border-forge-border p-5 sm:p-6 shadow-2xl text-left my-auto animate-in fade-in zoom-in-95 duration-150 relative"
              >
                {/* Modal Header: Pinned at top, always accessible */}
                <div className="flex items-center justify-between pb-3.5 border-b border-forge-border flex-shrink-0">
                  <div>
                    <h3
                      id="wallet-picker-title"
                      className="text-lg font-bold text-forge-textPrimary tracking-tight"
                    >
                      Connect Wallet
                    </h3>
                    <p className="text-xs text-forge-textSecondary mt-0.5">
                      Ethereum Sepolia Testnet (Chain ID 11155111)
                    </p>
                  </div>
                  <button
                    ref={closeButtonRef}
                    type="button"
                    onClick={handleClosePicker}
                    className="p-1.5 rounded-lg text-forge-textMuted hover:text-forge-textPrimary hover:bg-forge-surfaceElevated transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
                    aria-label="Close wallet selection dialog"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                {/* Modal Scrollable Body: Scrolls internally on short screens */}
                <div className="flex-1 overflow-y-auto pr-1 -mr-1 mt-3 space-y-3">
                  {/* Insecure HTTP Warning Banner for Brave / Extensions */}
                  {isInsecure && !isWalletDetected(SUPPORTED_WALLETS.find((w) => w.id === "com.brave.wallet"), announcedProviders) && (
                    <div className="p-3.5 rounded-xl bg-orange-950/30 border border-orange-500/40 text-xs text-orange-200 leading-relaxed pointer-events-auto">
                      <div className="flex items-start gap-2.5">
                        <svg className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <div>
                          <span className="font-semibold block text-orange-300">Insecure HTTP Origin Notice</span>
                          <span>
                            Brave Wallet and select extensions require HTTPS or localhost. If your wallet is not detected, please access via localhost or HTTPS. Configuration blueprint remains fully functional.
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pending State Banner */}
                  {isConnectPending && (
                    <div className="p-3 rounded-xl bg-orange-950/20 border border-orange-500/40 flex items-center gap-3">
                      <svg className="w-5 h-5 text-orange-400 animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      <div className="text-xs">
                        <p className="font-semibold text-orange-300">Awaiting approval</p>
                        <p className="text-forge-textSecondary">Please confirm the connection request in your wallet extension.</p>
                      </div>
                    </div>
                  )}

                  {/* UI Error / Rejection / Missing Provider Banner */}
                  {uiError && (
                    <div className="p-3 rounded-xl bg-red-950/20 border border-red-500/40 text-xs text-red-200">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          <div>
                            <p className="font-semibold text-red-300">
                              {uiError.type === "rejected"
                                ? "Connection Rejected"
                                : uiError.type === "missing-provider"
                                ? "Provider Not Available"
                                : "Connection Failed"}
                            </p>
                            <p className="text-forge-textSecondary mt-0.5 leading-relaxed">{uiError.message}</p>
                            {uiError.downloadUrl && (
                              <a
                                href={uiError.downloadUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-flex items-center gap-1 font-semibold text-orange-300 hover:underline"
                              >
                                <span>Get {uiError.walletName}</span>
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                  <polyline points="15 3 21 3 21 9" />
                                  <line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                              </a>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setUiError(null)}
                          className="text-forge-textMuted hover:text-forge-textPrimary p-0.5"
                          aria-label="Dismiss error alert"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Wallet Selection List */}
                  <div className="space-y-2">
                    {SUPPORTED_WALLETS.map((wallet) => {
                      const detected = isWalletDetected(wallet, announcedProviders);
                      const isConnectingThis = isConnectPending && selectedWalletRdns === wallet.rdns;

                      return (
                        <button
                          key={wallet.id}
                          type="button"
                          onClick={() => handleSelectWallet(wallet)}
                          disabled={isConnectPending}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                            detected
                              ? "bg-forge-surfaceElevated hover:bg-forge-surfaceHighlight border-forge-border hover:border-orange-500/60 cursor-pointer"
                              : "bg-forge-surface/60 border-forge-border/60 hover:border-forge-border text-forge-textSecondary"
                          } ${isConnectingThis ? "ring-2 ring-orange-500" : ""}`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-9 h-9 rounded-xl bg-forge-surfaceHighlight border border-forge-border flex items-center justify-center flex-shrink-0">
                              {renderWalletIcon(wallet.rdns)}
                            </div>
                            <span className="font-semibold text-sm text-forge-textPrimary truncate sm:whitespace-nowrap">
                              {wallet.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                            {isConnectingThis ? (
                              <span className="inline-flex items-center gap-1 text-xs text-orange-300 font-mono">
                                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                </svg>
                                <span>Connecting...</span>
                              </span>
                            ) : detected ? (
                              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-mono px-2 py-0.5 rounded-full bg-emerald-950/30 border border-emerald-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                <span>Available</span>
                              </span>
                            ) : (
                              <span className="text-xs font-mono text-forge-textMuted px-2 py-0.5 rounded bg-forge-surfaceHighlight border border-forge-border">
                                Unavailable
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Modal Footer Note: Pinned at bottom */}
                <div className="mt-3 pt-3 border-t border-forge-border text-center text-xs text-forge-textMuted flex-shrink-0">
                  <span>Connecting does not move funds.</span>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
