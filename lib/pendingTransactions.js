/**
 * pendingTransactions.js
 * Tracks active submitted transactions by chain ID and transaction hash.
 * Unsettled transactions remain pending across modal unmount, reset,
 * and wallet disconnection until a confirmed terminal outcome (receipt
 * success or revert) is verified on-chain. Temporary RPC errors do not
 * clear or settle pending transactions.
 */

// In-memory collection of pending transactions: Keyed by `${chainId}:${normalizedHash}`
const pendingTransactions = new Map();
const listeners = new Set();

function notifyListeners() {
  listeners.forEach((callback) => {
    try {
      callback();
    } catch {
      // Listener error guard
    }
  });
}

function normalizeKey(chainId, hash) {
  if (!chainId || !hash) return null;
  return `${Number(chainId)}:${String(hash).toLowerCase()}`;
}

/**
 * Subscribes to pending transaction updates.
 * Compatible with React useSyncExternalStore.
 */
export function subscribePendingTx(callback) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Returns true if any submitted transaction is currently pending.
 */
export function getHasPendingTx() {
  return pendingTransactions.size > 0;
}

/**
 * Returns all currently pending transactions.
 */
export function getPendingTransactions() {
  return Array.from(pendingTransactions.values());
}

/**
 * Checks whether a specific transaction is pending.
 */
export function isTransactionPending(chainId, hash) {
  const key = normalizeKey(chainId, hash);
  return key ? pendingTransactions.has(key) : false;
}

/**
 * Registers a newly submitted transaction as pending.
 * Optionally accepts a publicClient to monitor for terminal outcome in background.
 */
export function trackPendingTransaction({ chainId, hash, publicClient }) {
  const key = normalizeKey(chainId, hash);
  if (!key) return;

  if (!pendingTransactions.has(key)) {
    pendingTransactions.set(key, {
      chainId: Number(chainId),
      hash: String(hash),
      submittedAt: Date.now(),
      status: "pending",
    });
    notifyListeners();
  }

  // If a publicClient is provided, watch for receipt until terminal outcome in background
  if (publicClient && typeof publicClient.waitForTransactionReceipt === "function") {
    (async () => {
      try {
        const receipt = await publicClient.waitForTransactionReceipt({
          hash,
          confirmations: 1,
          timeout: 180_000,
        });

        if (receipt) {
          const terminalStatus =
            receipt.status === "reverted" || receipt.status === 0 || receipt.status === "0x0"
              ? "reverted"
              : "success";

          markTransactionSettled({
            chainId,
            hash,
            status: terminalStatus,
            receipt,
          });
        }
      } catch (err) {
        // If viem throws TransactionReceiptRevertedError, it's a confirmed terminal revert!
        if (
          err?.name === "TransactionReceiptRevertedError" ||
          err?.message?.toLowerCase().includes("revert")
        ) {
          markTransactionSettled({
            chainId,
            hash,
            status: "reverted",
          });
        }
        // Temporary RPC errors, network timeouts, or transient transport drops
        // MUST NOT mark transaction settled! It remains pending.
      }
    })();
  }
}

/**
 * Marks a transaction settled only if it reached a confirmed terminal outcome.
 * Temporary RPC errors, timeouts, or unconfirmed states are ignored.
 */
export function markTransactionSettled({ chainId, hash, status, receipt }) {
  const key = normalizeKey(chainId, hash);
  if (!key) return;

  const isTerminalRevert =
    status === "reverted" ||
    receipt?.status === "reverted" ||
    receipt?.status === 0 ||
    receipt?.status === "0x0";

  const isTerminalSuccess =
    status === "success" ||
    receipt?.status === "success" ||
    receipt?.status === 1 ||
    receipt?.status === "0x1";

  if (!isTerminalRevert && !isTerminalSuccess) {
    // Not a confirmed terminal outcome; do not settle.
    return;
  }

  if (pendingTransactions.has(key)) {
    pendingTransactions.delete(key);
    notifyListeners();
  }
}
