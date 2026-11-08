"use client";

import WalletConnect from "./WalletConnect";

export default function Header() {
  return (
    <header className="border-b border-orange-950/50 bg-black/40 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        {/* Brand identity: Dragoon's Blacksmith */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 via-forge-surfaceHighlight to-orange-950/40 border border-orange-500/30 flex items-center justify-center shadow-inner">
            {/* Restrained original Anvil & Hammer brand mark */}
            <svg
              className="w-5 h-5 text-orange-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {/* Anvil horn, face and body */}
              <path d="M4 10h14l2 2v1H7.5C5.5 13 4 12 2 10h2Z" />
              <path d="M7.5 13v2c0 1.5-1 2.5-2.5 3.5V20h14v-1.5c-1.5-1-2.5-2-2.5-3.5v-2" />
              {/* Smithing hammer */}
              <path d="M14 4l4 4" />
              <path d="M12.5 5.5l1.5-1.5a1 1 0 0 1 1.4 0l1.6 1.6a1 1 0 0 1 0 1.4L15.5 8.5" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-forge-textPrimary">
                DRAGOON&apos;s
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-forge-badgeBg border border-forge-badgeBorder text-orange-300 tracking-wider uppercase">
                Blacksmith
              </span>
            </div>
            <p className="text-xs text-forge-textMuted hidden sm:block">
              Standard Fixed-Supply ERC-20 Blueprint
            </p>
          </div>
        </div>

        {/* Sepolia Wallet Integration */}
        <WalletConnect />
      </div>
    </header>
  );
}
