import { encodeDeployData, formatEther, getAddress } from "viem";
import artifact from "./contracts/ERC20FixedSupply.json";

export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_EXPLORER_BASE = "https://sepolia.etherscan.io";

/**
 * Returns the Sepolia Etherscan transaction link.
 * @param {string} txHash
 * @returns {string}
 */
export function getSepoliaExplorerTxUrl(txHash) {
  if (!txHash) return "";
  return `${SEPOLIA_EXPLORER_BASE}/tx/${txHash}`;
}

/**
 * Returns the Sepolia Etherscan contract address link.
 * @param {string} address
 * @returns {string}
 */
export function getSepoliaExplorerAddressUrl(address) {
  if (!address) return "";
  return `${SEPOLIA_EXPLORER_BASE}/address/${address}`;
}

/**
 * Encodes the contract deployment bytecode with constructor arguments.
 * Supply is passed as WHOLE TOKENS (BigInt) without scaling.
 *
 * @param {object} params
 * @param {string} params.name
 * @param {string} params.symbol
 * @param {string|number|bigint} params.supplyWhole
 * @returns {`0x${string}`}
 */
export function buildDeploymentData({ name, symbol, supplyWhole }) {
  const cleanName = String(name || "").trim();
  const cleanSymbol = String(symbol || "").trim().toUpperCase();
  const wholeSupplyBigInt = BigInt(supplyWhole);

  return encodeDeployData({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [cleanName, cleanSymbol, wholeSupplyBigInt],
  });
}

/**
 * Estimates deployment gas and fee for the token contract.
 *
 * @param {object} params
 * @param {object} params.publicClient - viem public client
 * @param {string} params.name
 * @param {string} params.symbol
 * @param {string|number|bigint} params.supplyWhole
 * @param {string} params.account - deployer address
 * @returns {Promise<{ gasLimit: bigint, gasPrice: bigint, estimatedFeeWei: bigint, estimatedFeeEth: string }>}
 */
export async function estimateDeploymentGas({
  publicClient,
  name,
  symbol,
  supplyWhole,
  account,
}) {
  if (!publicClient) {
    throw new Error("Public client is required for gas estimation.");
  }
  if (!account) {
    throw new Error("Account is required for gas estimation.");
  }

  const data = buildDeploymentData({ name, symbol, supplyWhole });

  // Estimate gas units required for deployment
  const gasLimit = await publicClient.estimateGas({
    account: getAddress(account),
    data,
    value: 0n,
  });

  // Add 10% buffer for execution safety
  const bufferedGasLimit = (gasLimit * 110n) / 100n;

  // Retrieve current gas price from network
  let gasPrice;
  try {
    gasPrice = await publicClient.getGasPrice();
  } catch {
    gasPrice = 1_500_000_000n; // 1.5 gwei fallback
  }

  const estimatedFeeWei = bufferedGasLimit * gasPrice;
  const estimatedFeeEth = formatEther(estimatedFeeWei);

  return {
    gasLimit: bufferedGasLimit,
    gasPrice,
    estimatedFeeWei,
    estimatedFeeEth,
  };
}

/**
 * Reads back deployed contract parameters from Ethereum Sepolia
 * and verifies that name, symbol, decimals, total supply and deployer balance match.
 *
 * @param {object} params
 * @param {object} params.publicClient
 * @param {string} params.contractAddress
 * @param {string} params.expectedName
 * @param {string} params.expectedSymbol
 * @param {string|number|bigint} params.expectedWholeSupply
 * @param {string} params.deployerAddress
 * @returns {Promise<object>}
 */
export async function verifyDeployedToken({
  publicClient,
  contractAddress,
  expectedName,
  expectedSymbol,
  expectedWholeSupply,
  deployerAddress,
}) {
  if (!publicClient || !contractAddress) {
    throw new Error("Public client and contract address are required for verification.");
  }

  const checksummedAddress = getAddress(contractAddress);
  const checksummedDeployer = deployerAddress ? getAddress(deployerAddress) : null;
  const expectedWholeBigInt = BigInt(expectedWholeSupply);
  const expectedScaledSupply = expectedWholeBigInt * (10n ** 18n);

  const [name, symbol, decimals, totalSupply] = await Promise.all([
    publicClient.readContract({
      address: checksummedAddress,
      abi: artifact.abi,
      functionName: "name",
    }),
    publicClient.readContract({
      address: checksummedAddress,
      abi: artifact.abi,
      functionName: "symbol",
    }),
    publicClient.readContract({
      address: checksummedAddress,
      abi: artifact.abi,
      functionName: "decimals",
    }),
    publicClient.readContract({
      address: checksummedAddress,
      abi: artifact.abi,
      functionName: "totalSupply",
    }),
  ]);

  let deployerBalance = 0n;
  if (checksummedDeployer) {
    deployerBalance = await publicClient.readContract({
      address: checksummedAddress,
      abi: artifact.abi,
      functionName: "balanceOf",
      args: [checksummedDeployer],
    });
  }

  const isNameValid = name === expectedName.trim();
  const isSymbolValid = symbol === expectedSymbol.trim().toUpperCase();
  const isDecimalsValid = decimals === 18;
  const isTotalSupplyValid = totalSupply === expectedScaledSupply;
  const isBalanceValid = checksummedDeployer ? deployerBalance === expectedScaledSupply : true;

  const isFullyVerified =
    isNameValid && isSymbolValid && isDecimalsValid && isTotalSupplyValid && isBalanceValid;

  return {
    contractAddress: checksummedAddress,
    name,
    symbol,
    decimals,
    totalSupply,
    deployerBalance,
    isFullyVerified,
    checks: {
      name: isNameValid,
      symbol: isSymbolValid,
      decimals: isDecimalsValid,
      totalSupply: isTotalSupplyValid,
      deployerBalance: isBalanceValid,
    },
  };
}
