/**
 * Token Configuration & Validation Logic
 * Uses strictly string and BigInt arithmetic without floating-point math.
 */

// 18 decimals standard
export const TOKEN_DECIMALS = 18;

// Maximum value for an unsigned 256-bit integer (2^256 - 1)
export const MAX_UINT256 = (1n << 256n) - 1n;

// Maximum whole tokens permitted such that (supply * 10^18) <= MAX_UINT256
export const MAX_WHOLE_SUPPLY = MAX_UINT256 / (10n ** 18n);

// Network information
export const NETWORK_INFO = {
  name: "Ethereum Sepolia",
  chainId: 11155111,
  currencySymbol: "SEP",
  isTestnet: true,
  standard: "ERC-20",
  decimals: 18,
};

/**
 * Validates token name
 * @param {string} name
 * @returns {{ isValid: boolean, error: string }}
 */
export function validateTokenName(name) {
  if (name === undefined || name === null || name.trim() === "") {
    return { isValid: false, error: "Token name is required." };
  }
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { isValid: false, error: "Token name must be at least 2 characters." };
  }
  if (trimmed.length > 50) {
    return { isValid: false, error: "Token name must not exceed 50 characters." };
  }
  return { isValid: true, error: "" };
}

/**
 * Validates token symbol
 * @param {string} symbol
 * @returns {{ isValid: boolean, error: string }}
 */
export function validateTokenSymbol(symbol) {
  if (symbol === undefined || symbol === null || symbol.trim() === "") {
    return { isValid: false, error: "Token symbol is required." };
  }
  const trimmed = symbol.trim();
  if (trimmed.length < 1) {
    return { isValid: false, error: "Token symbol is required." };
  }
  if (trimmed.length > 11) {
    return { isValid: false, error: "Token symbol must not exceed 11 characters." };
  }
  if (!/^[A-Za-z0-9]+$/.test(trimmed)) {
    return { isValid: false, error: "Token symbol may only contain letters and numbers." };
  }
  return { isValid: true, error: "" };
}

/**
 * Validates initial supply using pure string & BigInt arithmetic
 * @param {string} supplyStr
 * @returns {{ isValid: boolean, error: string, supplyBigInt: bigint|null, weiBigInt: bigint|null }}
 */
export function validateSupply(supplyStr) {
  if (supplyStr === undefined || supplyStr === null || supplyStr.trim() === "") {
    return {
      isValid: false,
      error: "Initial supply is required.",
      supplyBigInt: null,
      weiBigInt: null,
    };
  }

  const trimmed = supplyStr.trim();

  // Explicit check for decimals
  if (trimmed.includes(".") || trimmed.includes(",")) {
    return {
      isValid: false,
      error: "Decimals and commas are not permitted. Enter a positive whole integer.",
      supplyBigInt: null,
      weiBigInt: null,
    };
  }

  // Explicit check for negative sign
  if (trimmed.startsWith("-")) {
    return {
      isValid: false,
      error: "Negative numbers are not permitted. Supply must be a positive whole integer.",
      supplyBigInt: null,
      weiBigInt: null,
    };
  }

  // Digits only regex
  if (!/^\d+$/.test(trimmed)) {
    return {
      isValid: false,
      error: "Initial supply must contain digits only (positive whole numbers).",
      supplyBigInt: null,
      weiBigInt: null,
    };
  }

  // Leading zeros check (disallow "00", "0123" unless just "0" which is caught next)
  if (trimmed.length > 1 && trimmed.startsWith("0")) {
    return {
      isValid: false,
      error: "Leading zeros are not permitted.",
      supplyBigInt: null,
      weiBigInt: null,
    };
  }

  try {
    const supplyBigInt = BigInt(trimmed);

    if (supplyBigInt === 0n) {
      return {
        isValid: false,
        error: "Initial supply must be greater than zero.",
        supplyBigInt: null,
        weiBigInt: null,
      };
    }

    const multiplier = 10n ** BigInt(TOKEN_DECIMALS);
    const weiBigInt = supplyBigInt * multiplier;

    if (weiBigInt > MAX_UINT256) {
      return {
        isValid: false,
        error: "Initial supply exceeds maximum uint256 limit (~1.1579 × 10⁵⁹ tokens).",
        supplyBigInt: null,
        weiBigInt: null,
      };
    }

    return {
      isValid: true,
      error: "",
      supplyBigInt,
      weiBigInt,
    };
  } catch {
    return {
      isValid: false,
      error: "Invalid number value.",
      supplyBigInt: null,
      weiBigInt: null,
    };
  }
}
