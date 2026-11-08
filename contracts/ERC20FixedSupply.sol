// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title ERC20FixedSupply
 * @author Qamra Ariva
 * @notice Standard fixed-supply ERC-20 token contract designed for Dragoon Token Forge.
 * @dev Mints the entire supply directly to msg.sender upon deployment.
 *      Accepts the initial supply in WHOLE TOKENS and scales it by 10^18 base units once during construction.
 *      Exposes no external minting capabilities, ownership roles, administrative controls, taxes, or pause logic.
 */
contract ERC20FixedSupply is ERC20 {
    /// @notice Maximum supported initial whole tokens such that (supply * 10^18) fits within a uint256.
    /// @dev floor(type(uint256).max / 10^18) = 115792089237316195423570985008687907853269984665640564039457
    uint256 public constant MAX_WHOLE_SUPPLY = type(uint256).max / 10**18;

    /// @notice Number of decimal places fixed at standard 18.
    uint8 private constant DECIMALS = 18;

    /// @dev Reverted when initial whole supply is zero.
    error ZeroInitialSupply();

    /// @dev Reverted when initial whole supply exceeds MAX_WHOLE_SUPPLY.
    /// @param requested The requested whole token supply.
    /// @param maxSupported The maximum allowed whole token supply.
    error ExceedsMaxSupply(uint256 requested, uint256 maxSupported);

    /// @dev Reverted when token name is empty or contains only whitespace characters.
    error EmptyOrWhitespaceName();

    /// @dev Reverted when token symbol is empty or contains only whitespace characters.
    error EmptyOrWhitespaceSymbol();

    /**
     * @notice Constructs and mints the fixed-supply ERC-20 token.
     * @param name_ The human-readable name of the token.
     * @param symbol_ The ticker symbol of the token.
     * @param initialWholeSupply_ The total initial supply specified in WHOLE TOKENS (not base units).
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialWholeSupply_
    ) ERC20(name_, symbol_) {
        // Validate name and symbol metadata
        _validateNonEmpty(name_, true);
        _validateNonEmpty(symbol_, false);

        // Validate whole token supply boundaries
        if (initialWholeSupply_ == 0) {
            revert ZeroInitialSupply();
        }

        if (initialWholeSupply_ > MAX_WHOLE_SUPPLY) {
            revert ExceedsMaxSupply(initialWholeSupply_, MAX_WHOLE_SUPPLY);
        }

        // Scale whole tokens to standard 18-decimal base units exactly once
        uint256 totalBaseUnits = initialWholeSupply_ * (10**uint256(DECIMALS));

        // Mint entire supply directly to deploying wallet
        _mint(msg.sender, totalBaseUnits);
    }

    /**
     * @notice Returns standard 18 decimal places.
     * @return uint8 Fixed precision of 18.
     */
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /**
     * @dev Internal helper ensuring string is neither empty nor solely composed of whitespace.
     *      Whitespace includes ASCII space (0x20), tab (0x09), newline (0x0A), carriage return (0x0D).
     * @param str The string to validate.
     * @param isName True if validating name, false if validating symbol.
     */
    function _validateNonEmpty(string memory str, bool isName) private pure {
        bytes memory b = bytes(str);
        if (b.length == 0) {
            if (isName) {
                revert EmptyOrWhitespaceName();
            } else {
                revert EmptyOrWhitespaceSymbol();
            }
        }

        bool hasNonWhitespace = false;
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 char = b[i];
            if (
                char != 0x20 && // Space
                char != 0x09 && // Horizontal Tab (\t)
                char != 0x0a && // Line Feed (\n)
                char != 0x0d    // Carriage Return (\r)
            ) {
                hasNonWhitespace = true;
                break;
            }
        }

        if (!hasNonWhitespace) {
            if (isName) {
                revert EmptyOrWhitespaceName();
            } else {
                revert EmptyOrWhitespaceSymbol();
            }
        }
    }
}
