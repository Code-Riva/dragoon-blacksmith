# Dragoon’s Blacksmith

**Dragoon’s Blacksmith** is an interactive portfolio web application and smart contract infrastructure for configuring, testing, previewing, and deploying a standard fixed-supply ERC-20 token on the Ethereum Sepolia testnet.

---

## 1. Architecture & Design

### Smart Contract: `ERC20FixedSupply.sol`
- **Base Implementation**: OpenZeppelin Contracts v5.2.0 (`@openzeppelin/contracts/token/ERC20/ERC20.sol`).
- **Compiler Configuration & EVM Target**:
  - **Solidity Version**: `0.8.28` (pinned)
  - **Optimizer**: Enabled (`runs: 200`)
  - **EVM Target**: `paris` (Hardhat default)
- **Token Supply Units & Scaling**:
  - Constructor accepts the initial supply in **WHOLE TOKENS** as a `BigInt` uint256 (e.g., `1000000` for 1 million whole tokens).
  - The contract scales whole tokens by $10^{18}$ base units **once** internally within the Solidity constructor:
    $$\text{totalBaseUnits} = \text{initialWholeSupply} \times 10^{18}$$
  - No frontend pre-scaling is applied before passing arguments to the deployment transaction.
- **Allocation & Value**:
  - Mints 100% of the initial supply directly to the deployer's address (`msg.sender`).
  - Contract deployment transaction value is strictly **0 native ETH** ($value = 0$). Gas is consumed only for bytecode deployment and contract initialization.
- **Fixed Supply & Security Boundaries**:
  - Fixed 18 decimals (`decimals() == 18`).
  - Reverts on zero initial supply (`ZeroInitialSupply()`).
  - Reverts when whole supply exceeds $\lfloor \text{type(uint256).max} / 10^{18} \rfloor$ (`ExceedsMaxSupply()`).
  - Reverts on empty or whitespace-only names and symbols (`EmptyOrWhitespaceName()`, `EmptyOrWhitespaceSymbol()`).
  - **No external mint function**: Total supply is immutable post-deployment.
  - **No administrative roles**: `Ownable` and `AccessControl` are omitted.
  - No pause, fee, tax, or upgradeable proxies.

---

## 2. Frontend Features & Web3 Stack

- **Stack**: Next.js 16.4.3 (App Router with Turbopack), React 19, Tailwind CSS, Wagmi v2, Viem v2, TanStack Query v5.
- **Theme**: Ember-orange-to-black blacksmith aesthetic (`#080706` background, `#F97316` primary accent, deep burnt-orange glow, near-black card surfaces, high-contrast accessible typography).
- **Branding**:
  - Website: **Dragoon’s Blacksmith**
  - Subtitle: *Create a fixed-supply ERC-20 token on Ethereum Sepolia.*
  - Left Panel: **Token Blueprint** (configuration form)
  - Right Panel: **Token Overview** (real-time scale preview and base units calculator)
  - Footer Signature: `Independent Portfolio Demo — by Qamra Ariva.`
- **Precision Arithmetic**:
  - Pure string and native `BigInt` uint256 arithmetic preventing precision loss or floating-point rounding errors.
  - Dynamic scale formatting (`thousands`, `millions`, `billions`, `trillions`, `quadrillions+`).
- **UI & UX Refinements**:
  - **Dynamic Deployment Status**: Deployment callout reflects actual wallet connection and network state:
    - *Disconnected*: Displays `"Connect a wallet to continue"`.
    - *Unsupported Network*: Displays `"Switch to Ethereum Sepolia"`.
    - *Invalid Form (on Sepolia)*: Displays `"Complete token configuration"`.
    - *Ready to Forge*: Displays `"Ready to Forge"` strictly when connected to Sepolia with a valid form.
    - *Configuration Status*: The independent `"Config Valid"` / `"Awaiting Input"` badge provides distinct form-level validation feedback.
  - **Forged Hammer Action Icon**: Stylized blacksmith hammer vector icon on the `"Review & Forge Token"` button.
  - **Minted Dragon Coin Avatar**: Token Overview features a local vector coin avatar (`/dragoon-coin.svg`) with a minted rim, dragon silhouette shade, engraved "D", and restrained warm glow (marked `aria-hidden="true"` as decorative).
  - **Advanced Supply Details Disclosure**: The raw token base units (`weiBigInt`) and copy action are tucked into a keyboard-accessible disclosure, collapsed by default, while formatted total supply remains prominent.
  - **Tightened Natural Panel Layout**: Balanced vertical form spacing (`gap-5` / `20px`) with natural desktop panel sizing and aligned top/bottom edges.
  - **Clean Local Wallet Assets**: High-resolution local SVG icons for MetaMask, Brave, Phantom, and Coinbase, plus a clean wallet outline on the Connect button.
- **EIP-6963 Multi-Wallet Integration**:
  - Pinned strictly to **Ethereum Sepolia** (`chainId: 11155111`).
  - Supported wallets in fixed order: **MetaMask**, **Brave Wallet**, **Phantom**, and **Coinbase Wallet**.
  - Dynamic discovery via EIP-6963 (`eip6963:requestProvider` / `eip6963:announceProvider`).
  - Clear availability indicators: "Available" or "Unavailable".
  - Built-in provider setup guidance displayed upon selecting an unavailable wallet.
  - Native Brave Wallet integration with guidance to browser settings rather than extension store.
  - Insecure HTTP origin detection (explains Brave Wallet requirements on non-localhost HTTP).
  - No auto-connection or network-switch prompts on page load (`reconnectOnMount: false`).
  - User-initiated "Switch to Sepolia" action when an unsupported chain is detected.
- **Sepolia Deployment Modal**:
  - Rendered through a React portal directly to `document.body`.
  - **Pre-submission Review**: Displays token name, symbol, whole-token supply, constructor whole-token note, recipient address, network, and estimated gas fee.
  - **In-flight Submission Lock**: Disables action buttons during signing and broadcasting to prevent duplicate transactions.
  - **Receipt Tracking & Readback**: Directly queries provider transport (`custom(provider)`) with a 500ms polling interval.
  - **On-chain Verification**: Reads back `name()`, `symbol()`, `decimals()`, `totalSupply()`, and `balanceOf(deployer)` on-chain post-deployment.
  - **Error Recovery**: Handles user rejections (EIP-1193 code 4001), on-chain reverts, RPC timeouts (with hash retention & recheck), and parameter changes.
  - **Workflow Reset**: "Forge Another Token" button resets the blueprint while keeping the wallet connected.

---

## 3. Environment Variables Supported

The application is fully zero-config and operates out-of-the-box with public Sepolia RPCs, but supports optional environment overrides:

| Variable | Required | Default / Fallback | Description |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SEPOLIA_RPC_URL` | No | Public endpoints (`ethereum-sepolia-rpc.publicnode.com`, `rpc.sepolia.org`, `sepolia.drpc.org`) | Optional custom Sepolia JSON-RPC endpoint (e.g., Infura, Alchemy, QuickNode) for enhanced rate limits and reliability. |
| `CI` | No | `undefined` | Used by Playwright test runner in CI environments to disallow `test.only` flags. |

---

## 4. Installation & Workflow Commands

### Requirements
- Node.js `v18.0.0` or higher
- npm `v9.0.0` or higher

```bash
# 1. Install dependencies
npm install

# 2. Compile smart contracts with Hardhat (Solidity 0.8.28, Paris target)
npm run compile

# 3. Run local Hardhat unit & deployment tests (20 passing)
npm test

# 4. Export contract ABI & bytecode artifacts for frontend consumption
npm run export-artifacts

# 5. Run ESLint code quality checks
npm run lint

# 6. Build optimized Next.js production bundle
npm run build

# 7. Start Next.js local development server (http://localhost:3000)
npm run dev

# 8. Start Next.js production server (requires prior build)
npm start

# 9. Run full Playwright end-to-end test suite (28 passing)
npx playwright test
```

---

## 5. Test & Verification Status

Testing and verification are categorized into four distinct tiers:

### Tier 1: Local Smart Contract Tests (Automated — PASSED)
- **Suite**: `test/ERC20FixedSupply.test.cjs` & `test/TokenDeploymentHelper.test.cjs` (Hardhat local network, Chain ID 31337).
- **Result**: **20 passing tests** (463ms).
- **Scope**:
  - Contract initialization, whole-token constructor supply scaling, 100% allocation to deployer, zero initial balance for other accounts.
  - Boundary reverts: zero supply, supply exceeding `MAX_WHOLE_SUPPLY`, empty/whitespace names and symbols, max whole supply deployment.
  - ERC-20 standard compliance: transfer, approval, allowance, transferFrom, insufficient balance/allowance reverts.
  - Artifact integrity: ABI, bytecode, and EVM configuration.
  - Deployment helper: constructor argument encoding, 0 ETH value, gas estimation buffer.

### Tier 2: Simulated Browser Tests (Automated — PASSED)
- **Suite**: Playwright Chromium test suites (`e2e/`).
- **Result**: **28 passing tests** (29.7s).
- **Scope**:
  - `e2e/blacksmith.spec.js` (3 tests): Branding, headings, live blueprint calculations, reset function, wallet picker layout.
  - `e2e/deployment-status-and-avatar.spec.js` (2 tests): Dynamic deployment status across all 4 wallet states (disconnected, wrong-network, invalid-form, ready-to-forge), hammer action icon, and decorative dragon coin avatar.
  - `e2e/panel-layout.spec.js` (8 tests): Desktop, laptop, and mobile panel alignment, tightened vertical gaps (20px), "Advanced details" disclosure toggle, wallet selector local icons, single primary action button, "Config Valid" badge positioning.
  - `e2e/presentation-fixes.spec.js` (4 tests): Viewport boundary containment, responsive dialog scrolling across mobile (390×844), laptop (1366×768), desktop (1440×900), Escape key dismissal, focus trap containment.
  - `e2e/wallet-providers.spec.js` (5 tests): EIP-6963 dual provider isolation (Brave Wallet vs MetaMask), tile dispatch accuracy, unavailable provider guidance, rejection guidance.
  - `e2e/token-deployment.spec.js` (4 tests): Full forge lifecycle (review $\to$ approval $\to$ receipt $\to$ verified address display $\to$ explorer links $\to$ reset), network mismatch enforcement (disables button on Chain ID 1, restores on switch), user rejection (code 4001), on-chain reverted receipt handling.
  - `e2e/capture-verification-screenshots.spec.js` (2 tests): Desktop and mobile visual snapshot captures.

### Tier 3: Staging & Interface Verification (Manual — PASSED)
- **Status**: Verified in local browser environments.
- **Scope**:
  - Responsive layout integrity at standard mobile and desktop viewports.
  - Smooth animation of the "Advanced details" disclosure with respect for reduced motion.
  - Visual fidelity of the minted dragon coin avatar and forge hammer icon.

### Tier 4: Public Sepolia Deployment (Live Testnet — PENDING REAL-WALLET VERIFICATION)
- **Status**: **PENDING / MANUAL CHECK REQUIRED**.
- **Reason**: Automated test suites use mock provider bridges and simulated transactions to test deployment flows deterministically without consuming real Sepolia testnet ETH or exposing private keys.
- **Pending Real-Wallet Checks**:
  1. **Live Gas Payment**: Deploying a live token on Ethereum Sepolia testnet requires ~0.005 Sepolia testnet ETH in the connected wallet to pay for transaction gas.
  2. **Wallet Extension Signature**: Signing and broadcasting the contract creation transaction via a real browser extension wallet (MetaMask, Brave Wallet, Phantom, or Coinbase Wallet).
  3. **Sepolia Etherscan Verification**: Confirming the transaction hash and viewing the deployed contract bytecode on the public Sepolia block explorer (`https://sepolia.etherscan.io/address/<deployedAddress>`).

---

## 6. Sepolia Testnet Requirements & Known Boundaries

### Wallet Requirements
1. **Network**: Ethereum Sepolia Testnet only (Chain ID `11155111`). The application will prompt a chain switch if connected to any other network.
2. **Supported Wallets**: MetaMask, Brave Wallet, Phantom, Coinbase Wallet (discovered via EIP-6963).
3. **Security Context**: Brave Wallet and browser extensions require HTTPS or `http://localhost`. Insecure non-localhost HTTP origins disable extension provider injection.
4. **Funding**: Requires a small amount of Sepolia ETH (typically ~0.005 ETH) in the deploying wallet to pay for transaction gas.

### Known Boundaries
- **Educational / Demo Purpose**: This is an independent portfolio project. The contract is educational and has **not** undergone a formal external third-party security audit.
- **Testnet Only**: Strictly restricted to Ethereum Sepolia. Mainnet deployment is intentionally not supported.
- **No Monetary Value**: Testnet ERC-20 tokens have no financial value and are intended solely for testing and demonstration.
- **Fixed Supply**: Once deployed, the supply cannot be increased, decreased, or paused.

---

## 7. License & Credits

- **Author**: Qamra Ariva
- **Footer Signature**: `Independent Portfolio Demo — by Qamra Ariva.`
- **License**: MIT
