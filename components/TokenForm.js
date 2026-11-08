"use client";

import { formatBigIntWithCommas } from "@/lib/formatters";

export default function TokenForm({
  name,
  symbol,
  supply,
  errors,
  touched,
  isFormValid,
  supplyBigInt,
  onNameChange,
  onSymbolChange,
  onSupplyChange,
  onReset,
  onBlur,
}) {
  return (
    <div
      data-testid="token-blueprint-card"
      className="bg-forge-surface border border-forge-border rounded-2xl p-6 sm:p-8 shadow-card flex flex-col h-full"
    >
      {/* Panel Header: Token Blueprint */}
      <div className="pb-6 border-b border-forge-border">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-forge-textPrimary">
              Token Blueprint
            </h2>
            <p className="text-sm text-forge-textSecondary mt-1">
              Configure immutable metadata and total initial distribution for the ERC-20 contract.
            </p>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-forge-border bg-forge-surfaceElevated hover:bg-forge-surfaceHighlight hover:border-forge-borderHover text-xs font-medium text-forge-textSecondary hover:text-forge-textPrimary transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-forge-bg"
            aria-label="Reset configuration to defaults"
          >
            <svg
              className="w-3.5 h-3.5 text-orange-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Form Inputs & Token Details with tightened, comfortable spacing */}
      <form
        onSubmit={(e) => e.preventDefault()}
        noValidate
        className="flex-1 flex flex-col justify-between pt-6 gap-6"
      >
        <div className="space-y-4 sm:space-y-5">
          {/* Token Name Input */}
          <div>
            <div className="flex justify-between items-baseline mb-2">
              <label
                htmlFor="token-name"
                className="block text-sm font-semibold text-forge-textPrimary"
              >
                Token Name <span className="text-orange-500">*</span>
              </label>
              <span className="text-xs text-forge-textMuted font-mono">
                {name.length}/50
              </span>
            </div>
            <div className="relative">
              <input
                id="token-name"
                name="token-name"
                type="text"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                onBlur={() => onBlur("name")}
                placeholder="e.g., Dragoon Governance"
                maxLength={50}
                aria-invalid={touched.name && Boolean(errors.name)}
                aria-describedby={
                  touched.name && errors.name ? "token-name-error" : "token-name-hint"
                }
                className={`w-full px-4 py-3 rounded-xl bg-forge-surfaceElevated border text-forge-textPrimary placeholder-forge-textMuted text-sm transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                  touched.name && errors.name
                    ? "border-red-500/60 bg-red-950/10 focus:ring-red-400"
                    : "border-forge-border hover:border-forge-borderHover"
                }`}
              />
            </div>
            {touched.name && errors.name ? (
              <p
                id="token-name-error"
                className="mt-2 text-xs text-red-400 flex items-center gap-1.5"
                role="alert"
              >
                <svg
                  className="w-3.5 h-3.5 flex-shrink-0"
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
                <span>{errors.name}</span>
              </p>
            ) : (
              <p id="token-name-hint" className="mt-1.5 text-xs text-forge-textMuted">
                Descriptive title for your asset (e.g., &quot;Dragoon Protocol&quot;).
              </p>
            )}
          </div>

          {/* Token Symbol Input */}
          <div>
            <div className="flex justify-between items-baseline mb-2">
              <label
                htmlFor="token-symbol"
                className="block text-sm font-semibold text-forge-textPrimary"
              >
                Token Symbol <span className="text-orange-500">*</span>
              </label>
              <span className="text-xs text-forge-textMuted font-mono">
                {symbol.length}/11
              </span>
            </div>
            <div className="relative">
              <input
                id="token-symbol"
                name="token-symbol"
                type="text"
                value={symbol}
                onChange={(e) => onSymbolChange(e.target.value)}
                onBlur={() => onBlur("symbol")}
                placeholder="e.g., DRGN"
                maxLength={11}
                aria-invalid={touched.symbol && Boolean(errors.symbol)}
                aria-describedby={
                  touched.symbol && errors.symbol ? "token-symbol-error" : "token-symbol-hint"
                }
                className={`w-full px-4 py-3 uppercase rounded-xl bg-forge-surfaceElevated border text-forge-textPrimary placeholder-forge-textMuted font-mono text-sm tracking-wider transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                  touched.symbol && errors.symbol
                    ? "border-red-500/60 bg-red-950/10 focus:ring-red-400"
                    : "border-forge-border hover:border-forge-borderHover"
                }`}
              />
            </div>
            {touched.symbol && errors.symbol ? (
              <p
                id="token-symbol-error"
                className="mt-2 text-xs text-red-400 flex items-center gap-1.5"
                role="alert"
              >
                <svg
                  className="w-3.5 h-3.5 flex-shrink-0"
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
                <span>{errors.symbol}</span>
              </p>
            ) : (
              <p id="token-symbol-hint" className="mt-1.5 text-xs text-forge-textMuted">
                Standard ticker identifier (typically 3–5 uppercase characters, e.g., &quot;DRGN&quot;).
              </p>
            )}
          </div>

          {/* Initial Supply Input */}
          <div>
            <div className="flex justify-between items-baseline mb-2">
              <label
                htmlFor="token-supply"
                className="block text-sm font-semibold text-forge-textPrimary"
              >
                Initial Supply (Whole Tokens) <span className="text-orange-500">*</span>
              </label>
              <span className="text-xs text-forge-textMuted">Positive whole integers only</span>
            </div>
            <div className="relative">
              <input
                id="token-supply"
                name="token-supply"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={supply}
                onChange={(e) => onSupplyChange(e.target.value)}
                onBlur={() => onBlur("supply")}
                placeholder="e.g., 1000000"
                aria-invalid={touched.supply && Boolean(errors.supply)}
                aria-describedby={
                  touched.supply && errors.supply ? "token-supply-error" : "token-supply-hint"
                }
                className={`w-full px-4 py-3 rounded-xl bg-forge-surfaceElevated border text-forge-textPrimary placeholder-forge-textMuted font-mono text-sm transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                  touched.supply && errors.supply
                    ? "border-red-500/60 bg-red-950/10 focus:ring-red-400"
                    : "border-forge-border hover:border-forge-borderHover"
                }`}
              />
            </div>
            {touched.supply && errors.supply ? (
              <p
                id="token-supply-error"
                className="mt-2 text-xs text-red-400 flex items-center gap-1.5"
                role="alert"
              >
                <svg
                  className="w-3.5 h-3.5 flex-shrink-0"
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
                <span>{errors.supply}</span>
              </p>
            ) : supplyBigInt ? (
              <p
                id="token-supply-hint"
                className="mt-2 text-xs text-orange-400 font-mono flex items-center gap-1.5"
              >
                <span className="text-forge-textMuted">Formatted:</span>
                <span className="font-semibold text-forge-textPrimary">
                  {formatBigIntWithCommas(supplyBigInt)}
                </span>
                <span className="text-forge-textSecondary">tokens</span>
              </p>
            ) : (
              <p id="token-supply-hint" className="mt-1.5 text-xs text-forge-textMuted">
                Enter whole token amount without decimals or commas.
              </p>
            )}
          </div>
        </div>

        {/* Token details */}
        <div className="pt-6 border-t border-forge-border">
          <div className="rounded-xl p-4 bg-gradient-to-r from-forge-surfaceElevated via-forge-surfaceHighlight to-forge-surfaceElevated border border-forge-border text-xs">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-orange-950/40 border border-orange-500/30 text-orange-400 flex-shrink-0 mt-0.5">
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
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-forge-textPrimary text-sm">
                  Token details
                </p>
                <p className="mt-1 text-forge-textSecondary leading-relaxed">
                  The contract mints the entire fixed supply to the deploying wallet with 18 decimals and no post-deployment mint function.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-mono text-forge-textSecondary">
                  <span className="px-2.5 py-1 rounded bg-forge-surfaceElevated border border-forge-border">
                    Fixed Supply
                  </span>
                  <span className="px-2.5 py-1 rounded bg-forge-surfaceElevated border border-forge-border">
                    18 Decimals
                  </span>
                  <span className="px-2.5 py-1 rounded bg-forge-surfaceElevated border border-forge-border">
                    100% Deployer Allocation
                  </span>
                  <span className="px-2.5 py-1 rounded bg-forge-surfaceElevated border border-forge-border">
                    No Admin Privileges
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}