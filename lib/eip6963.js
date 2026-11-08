/**
 * EIP-6963: Multi-Injected Provider Discovery
 * Specification: https://eips.ethereum.org/EIPS/eip-6963
 *
 * Provides typed wallet metadata, EIP-6963 event subscription,
 * legacy injected provider detection, and insecure HTTP context checks.
 */

export const SUPPORTED_WALLETS = [
  {
    id: "com.brave.wallet",
    name: "Brave Wallet",
    rdns: "com.brave.wallet",
    downloadUrl: null, // Built into Brave browser
    isBuiltIn: true,
    missingMessage:
      "Brave Wallet is built directly into the Brave browser. To connect, please enable Web3 provider access in Brave Settings (brave://settings/web3) or access via HTTPS / localhost. No extension installation is required.",
  },
  {
    id: "io.metamask",
    name: "MetaMask",
    rdns: "io.metamask",
    downloadUrl: "https://metamask.io/download/",
    missingMessage:
      "MetaMask is not available. Please verify the extension is installed and enabled in your browser extensions settings.",
  },
  {
    id: "app.phantom",
    name: "Phantom",
    rdns: "app.phantom",
    downloadUrl: "https://phantom.app/download",
    missingMessage:
      "Phantom is not available. Please verify Phantom is installed and enabled in your browser extensions settings.",
  },
  {
    id: "com.coinbase.wallet",
    name: "Coinbase Wallet",
    rdns: "com.coinbase.wallet",
    downloadUrl: "https://www.coinbase.com/wallet",
    missingMessage:
      "Coinbase Wallet is not available. Please verify the extension is installed and enabled in your browser settings.",
  },
];

/**
 * Check if the current origin is an insecure HTTP context (not HTTPS and not localhost).
 * Brave Wallet and several extensions explicitly block provider injection on insecure HTTP.
 * @returns {boolean}
 */
export function isInsecureContext() {
  if (typeof window === "undefined") return false;
  if (window.isSecureContext === false) return true;
  const { protocol, hostname } = window.location;
  if (
    protocol === "http:" &&
    hostname !== "localhost" &&
    hostname !== "127.0.0.1" &&
    hostname !== "[::1]"
  ) {
    return true;
  }
  return false;
}

/**
 * Checks for legacy injected providers when EIP-6963 is not announced or before announcement.
 * Ensures strict provider isolation: never conflates one wallet's provider with another.
 * @param {string} rdns
 * @returns {any|null}
 */
export function getLegacyProviderForRdns(rdns) {
  if (typeof window === "undefined") return null;

  switch (rdns) {
    case "com.brave.wallet": {
      if (window.ethereum?.isBraveWallet) return window.ethereum;
      if (Array.isArray(window.ethereum?.providers)) {
        return window.ethereum.providers.find((p) => p.isBraveWallet) || null;
      }
      return null;
    }
    case "io.metamask": {
      // Disallow Brave and Phantom masquerading as MetaMask
      if (
        window.ethereum?.isMetaMask &&
        !window.ethereum?.isBraveWallet &&
        !window.ethereum?.isPhantom
      ) {
        return window.ethereum;
      }
      if (Array.isArray(window.ethereum?.providers)) {
        return (
          window.ethereum.providers.find(
            (p) => p.isMetaMask && !p.isBraveWallet && !p.isPhantom
          ) || null
        );
      }
      return null;
    }
    case "app.phantom": {
      if (window.phantom?.ethereum?.isPhantom) return window.phantom.ethereum;
      if (window.ethereum?.isPhantom) return window.ethereum;
      if (Array.isArray(window.ethereum?.providers)) {
        return window.ethereum.providers.find((p) => p.isPhantom) || null;
      }
      return null;
    }
    case "com.coinbase.wallet": {
      if (window.coinbaseWalletExtension) return window.coinbaseWalletExtension;
      if (window.ethereum?.isCoinbaseWallet) return window.ethereum;
      if (Array.isArray(window.ethereum?.providers)) {
        return window.ethereum.providers.find((p) => p.isCoinbaseWallet) || null;
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * Determine if a specific wallet is detected in the browser
 * either through EIP-6963 announcements or legacy window object.
 * @param {object} wallet
 * @param {Array} announcedProviders
 * @returns {boolean}
 */
export function isWalletDetected(wallet, announcedProviders = []) {
  if (announcedProviders.some((p) => p.info?.rdns === wallet.rdns)) {
    return true;
  }
  return getLegacyProviderForRdns(wallet.rdns) !== null;
}

/**
 * Subscribe to EIP-6963 announcements and trigger discovery.
 * Returns unsubscribe callback.
 * @param {function} onProvidersChanged
 * @returns {function}
 */
export function subscribeEIP6963(onProvidersChanged) {
  if (typeof window === "undefined") return () => {};

  const discoveredMap = new Map();

  const handleAnnounce = (event) => {
    if (!event.detail || !event.detail.info || !event.detail.provider) return;
    const { info, provider } = event.detail;
    if (!info.rdns) return;

    discoveredMap.set(info.rdns, { info, provider });
    onProvidersChanged(Array.from(discoveredMap.values()));
  };

  window.addEventListener("eip6963:announceProvider", handleAnnounce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));

  return () => {
    window.removeEventListener("eip6963:announceProvider", handleAnnounce);
  };
}
