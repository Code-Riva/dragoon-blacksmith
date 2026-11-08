"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { useAccount } from "wagmi";
import { sepolia } from "wagmi/chains";
import { formatBigIntWithCommas, getSupplyScaleLabel, formatWeiString } from "@/lib/formatters";

export default function TokenPreview({
  name,
  symbol,
  supply,
  isFormValid,
  supplyBigInt,
  weiBigInt,
  onOpenDeployModal,
}) {
  const [copiedUnits, setCopiedUnits] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const { isConnected, chainId } = useAccount();
  const isSepolia = isConnected && chainId === sepolia.id;

  // Determine dynamic deployment status reflecting wallet connection, network, and form validity
  const statusInfo = useMemo(() => {
    if (!isConnected) {
      return {
        title: "Connect a wallet to continue",
        description: "Connect your Web3 wallet to prepare and forge your ERC-20 token on Ethereum Sepolia.",
        state: "disconnected",
      };
    }
    if (!isSepolia) {
      return {
        title: "Switch to Ethereum Sepolia",
        description: "Your connected wallet is on an unsupported network. Switch to Ethereum Sepolia testnet to continue.",
        state: "wrong-network",
      };
    }
    if (!isFormValid) {
      return {
        title: "Complete token configuration",
        description: "Provide a valid token name, symbol, and initial supply to ready your contract for deployment.",
        state: "invalid-form",
      };
    }
    return {
      title: "Ready to Forge",
      description: "Ethereum Sepolia testnet deployment. Contracts are unaudited educational demos.",
      state: "ready",
    };
  }, [isConnected, isSepolia, isFormValid]);

  // Fallback visual representations when inputs are empty
  const displayName = name.trim() || "Token Name";
  const displaySymbol = symbol.trim() ? symbol.trim().toUpperCase() : "TKN";

  const handleCopyBaseUnits = () => {
    if (!weiBigInt) return;
    navigator.clipboard.writeText(weiBigInt.toString()).then(() => {
      setCopiedUnits(true);
      setTimeout(() => setCopiedUnits(false), 2000);
    });
  };

  return (
    <div
      data-testid="token-overview-card"
      className="bg-forge-surface border border-forge-border rounded-2xl p-6 sm:p-8 shadow-card flex flex-col justify-between h-full"
    >
      <div>
        {/* Section Heading: Required exactly "Token Overview" with top-right status badge */}
        <div className="pb-6 border-b border-forge-border flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-[200px]">
            <h2 className="text-xl font-bold tracking-tight text-forge-textPrimary">
              Token Overview
            </h2>
            <p className="text-[13px] text-forge-textSecondary mt-1">
              Live preview reflecting valid configuration parameters in real time.
            </p>
          </div>
          <span
            className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono border self-start ${
              isFormValid
                ? "bg-orange-950/40 border-orange-500/40 text-orange-300 font-semibold"
                : "bg-forge-surfaceElevated border-forge-border text-forge-textMuted"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isFormValid ? "bg-orange-500" : "bg-neutral-500"
              }`}
            />
            {isFormValid ? "Config Valid" : "Awaiting Input"}
          </span>
        </div>

        {/* Status Callout Banner: Reflects actual wallet state & readiness */}
        <div className="mt-6 rounded-xl border border-forge-border bg-forge-surfaceElevated p-4 flex items-start gap-3.5">
          <div className="p-2 rounded-lg bg-forge-surfaceHighlight border border-forge-border text-orange-400 flex-shrink-0">
            {statusInfo.state === "disconnected" ? (
              <svg
                className="w-4 h-4"
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
            ) : statusInfo.state === "wrong-network" ? (
              <svg
                className="w-4 h-4 text-amber-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            ) : statusInfo.state === "invalid-form" ? (
              <svg
                className="w-4 h-4 text-orange-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            ) : (
              <svg
                className="w-4 h-4 text-emerald-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-400">
              Deployment State
            </p>
            <p className="text-sm font-semibold text-forge-textPrimary mt-0.5">
              {statusInfo.title}
            </p>
            <p className="text-xs text-forge-textSecondary mt-1 leading-relaxed">
              {statusInfo.description}
            </p>
          </div>
        </div>

        {/* Live Token Identity Card */}
        <div className="mt-6 rounded-2xl bg-gradient-to-b from-forge-surfaceElevated via-forge-surface to-forge-surfaceElevated border border-forge-border p-6 relative overflow-hidden shadow-inner">
          {/* Subtle burnt-orange glow behind identity */}
          <div
            className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-orange-500/5 blur-3xl pointer-events-none"
            aria-hidden="true"
          />

          <div className="flex items-center gap-4">
            {/* Custom Dragoon Coin Avatar */}
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-950 via-forge-surfaceHighlight to-forge-border border border-orange-500/40 flex items-center justify-center shadow-md overflow-hidden p-1 relative flex-shrink-0">
              <Image
                src="/dragoon-coin.svg"
                alt=""
                width={48}
                height={48}
                aria-hidden="true"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3
                  className={`text-xl font-bold truncate ${
                    name.trim() ? "text-forge-textPrimary" : "text-forge-textMuted"
                  }`}
                >
                  {displayName}
                </h3>
                <span className="px-2.5 py-0.5 rounded-md bg-orange-950/40 border border-orange-500/30 text-xs font-mono font-bold text-orange-300">
                  {displaySymbol}
                </span>
              </div>
              <p className="text-xs text-forge-textSecondary font-mono mt-1">
                Standard ERC-20
              </p>
            </div>
          </div>

          {/* Supply Showcase */}
          <div className="mt-6 pt-6 border-t border-forge-border">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-forge-textMuted">
                Configured Total Supply
              </span>
              {supplyBigInt && (
                <span className="text-xs font-mono font-semibold text-orange-400">
                  {getSupplyScaleLabel(supplyBigInt)}
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-2 flex-wrap">
              <span
                className={`text-3xl font-extrabold font-mono tracking-tight ${
                  supplyBigInt ? "text-forge-textPrimary" : "text-forge-textMuted"
                }`}
              >
                {supplyBigInt ? formatBigIntWithCommas(supplyBigInt) : "0"}
              </span>
              <span className="text-sm font-semibold font-mono text-orange-400">
                {displaySymbol}
              </span>
            </div>

            {/* Advanced details disclosure */}
            <div className="mt-4 pt-3 border-t border-forge-border/60">
              <button
                type="button"
                onClick={() => setIsAdvancedOpen((prev) => !prev)}
                aria-expanded={isAdvancedOpen}
                aria-controls="advanced-supply-details"
                className="w-full flex items-center justify-between py-1 text-xs text-forge-textSecondary hover:text-forge-textPrimary font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded"
              >
                <span className="flex items-center gap-1.5">
                  <svg
                    className={`w-3.5 h-3.5 text-orange-400 transition-transform duration-200 motion-reduce:transition-none ${
                      isAdvancedOpen ? "rotate-90" : ""
                    }`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span>Advanced details</span>
                </span>
                <span className="text-[11px] text-forge-textMuted font-mono">
                  {isAdvancedOpen ? "Hide base units" : "Raw token base units"}
                </span>
              </button>

              <div
                id="advanced-supply-details"
                className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out motion-reduce:transition-none ${
                  isAdvancedOpen ? "grid-rows-[1fr] opacity-100 mt-2.5" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="p-3 rounded-xl bg-forge-surfaceHighlight border border-forge-border">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-mono font-medium text-forge-textMuted uppercase tracking-wider">
                        Raw Base Units (18 Decimals)
                      </span>
                      {weiBigInt && (
                        <button
                          type="button"
                          onClick={handleCopyBaseUnits}
                          className="pl-1 text-[11px] font-mono font-medium text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1 focus:outline-none focus-visible:underline"
                          title="Copy raw base units integer"
                        >
                          {copiedUnits ? "Copied!" : "Copy Base Units"}
                        </button>
                      )}
                    </div>
                    <p className="font-mono text-xs text-forge-textSecondary break-all leading-relaxed select-all">
                      {weiBigInt ? formatWeiString(weiBigInt) : "0"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Primary Review & Forge Action Trigger beneath Token Overview */}
        <div className="mt-8 pt-6 border-t border-forge-border">
          <button
            type="button"
            onClick={onOpenDeployModal}
            disabled={!isFormValid}
            className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm tracking-wide transition-all shadow-lg flex items-center justify-center gap-2.5 ${
              isFormValid
                ? "bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white cursor-pointer hover:shadow-orange-500/20 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-orange-500"
                : "bg-forge-surfaceElevated border border-forge-border text-forge-textMuted cursor-not-allowed"
            }`}
          >
            {/* Blacksmith forge hammer icon */}
            <svg
              className="w-4 h-4 text-orange-200 flex-shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9" />
              <path d="m18 15 4-4" />
              <path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.242-1.758H11l-2 2 4 4" />
            </svg>
            <span>Review & Forge Token</span>
          </button>
          <p className="mt-2 text-center text-xs text-forge-textMuted font-mono">
            Deploys to Ethereum Sepolia testnet.
          </p>
        </div>
      </div>

      {/* Verification Summary Footer Note */}
      <div className="mt-6 pt-4 border-t border-forge-border text-xs text-forge-textSecondary font-mono flex items-center justify-between">
        <span>Supply within supported range</span>
        <span>Standard ERC-20</span>
      </div>
    </div>
  );
}