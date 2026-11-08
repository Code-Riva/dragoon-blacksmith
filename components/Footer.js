export default function Footer() {
  return (
    <footer className="mt-auto border-t border-forge-border bg-forge-surface/60 backdrop-blur-sm py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-forge-textSecondary">
        <p className="tracking-wide text-forge-textPrimary font-medium">
          Independent Portfolio Demo — by Qamra Ariva.
        </p>
        <div className="flex items-center gap-4 text-forge-textMuted">
          <span>ERC-20 Fixed Standard</span>
          <span>•</span>
          <span>Ethereum Sepolia Testnet</span>
          <span>•</span>
          <span>BigInt uint256 Arithmetic</span>
        </div>
      </div>
    </footer>
  );
}
