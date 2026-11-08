const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ERC20FixedSupply Contract", function () {
  let factory;
  let deployer;
  let recipient;
  let spender;
  let other;

  // Maximum uint256 whole tokens: floor((2^256 - 1) / 10^18)
  const MAX_UINT256 = (1n << 256n) - 1n;
  const MAX_WHOLE_SUPPLY = MAX_UINT256 / 10n ** 18n;
  const SAMPLE_WHOLE_SUPPLY = 1_000_000n;
  const SAMPLE_BASE_UNITS = SAMPLE_WHOLE_SUPPLY * 10n ** 18n;

  beforeEach(async function () {
    [deployer, recipient, spender, other] = await ethers.getSigners();
    factory = await ethers.getContractFactory("ERC20FixedSupply");
  });

  describe("Constructor & Initialization", function () {
    it("matches name, symbol and fixed 18 decimals from constructor inputs", async function () {
      const token = await factory.deploy("Dragoon Token", "DRGN", SAMPLE_WHOLE_SUPPLY);
      await token.waitForDeployment();

      expect(await token.name()).to.equal("Dragoon Token");
      expect(await token.symbol()).to.equal("DRGN");
      expect(await token.decimals()).to.equal(18);
    });

    it("mints totalSupply and deployer's balance equal to whole supply * 10^18", async function () {
      const token = await factory.deploy("Dragoon Token", "DRGN", SAMPLE_WHOLE_SUPPLY);
      await token.waitForDeployment();

      expect(await token.totalSupply()).to.equal(SAMPLE_BASE_UNITS);
      expect(await token.balanceOf(deployer.address)).to.equal(SAMPLE_BASE_UNITS);
    });

    it("ensures another account initially has zero token balance", async function () {
      const token = await factory.deploy("Dragoon Token", "DRGN", SAMPLE_WHOLE_SUPPLY);
      await token.waitForDeployment();

      expect(await token.balanceOf(recipient.address)).to.equal(0n);
      expect(await token.balanceOf(spender.address)).to.equal(0n);
      expect(await token.balanceOf(other.address)).to.equal(0n);
    });

    it("correctly exposes public MAX_WHOLE_SUPPLY constant matching floor(uint256.max / 10^18)", async function () {
      const token = await factory.deploy("Dragoon Token", "DRGN", 100n);
      await token.waitForDeployment();

      expect(await token.MAX_WHOLE_SUPPLY()).to.equal(MAX_WHOLE_SUPPLY);
    });
  });

  describe("Validation & Boundary Reverts", function () {
    it("reverts when initial whole supply is zero", async function () {
      await expect(
        factory.deploy("Dragoon Token", "DRGN", 0n)
      ).to.be.revertedWithCustomError(factory, "ZeroInitialSupply");
    });

    it("reverts when initial whole supply exceeds MAX_WHOLE_SUPPLY", async function () {
      const exceededSupply = MAX_WHOLE_SUPPLY + 1n;
      await expect(
        factory.deploy("Dragoon Token", "DRGN", exceededSupply)
      ).to.be.revertedWithCustomError(factory, "ExceedsMaxSupply")
        .withArgs(exceededSupply, MAX_WHOLE_SUPPLY);
    });

    it("reverts on empty token name", async function () {
      await expect(
        factory.deploy("", "DRGN", SAMPLE_WHOLE_SUPPLY)
      ).to.be.revertedWithCustomError(factory, "EmptyOrWhitespaceName");
    });

    it("reverts on whitespace-only token name", async function () {
      await expect(
        factory.deploy("   \t  \n  ", "DRGN", SAMPLE_WHOLE_SUPPLY)
      ).to.be.revertedWithCustomError(factory, "EmptyOrWhitespaceName");
    });

    it("reverts on empty token symbol", async function () {
      await expect(
        factory.deploy("Dragoon Token", "", SAMPLE_WHOLE_SUPPLY)
      ).to.be.revertedWithCustomError(factory, "EmptyOrWhitespaceSymbol");
    });

    it("reverts on whitespace-only token symbol", async function () {
      await expect(
        factory.deploy("Dragoon Token", "  \r\n\t ", SAMPLE_WHOLE_SUPPLY)
      ).to.be.revertedWithCustomError(factory, "EmptyOrWhitespaceSymbol");
    });

    it("successfully deploys with the exact maximum supported whole supply", async function () {
      const maxToken = await factory.deploy("Max Dragoon", "MDRG", MAX_WHOLE_SUPPLY);
      await maxToken.waitForDeployment();

      const expectedMaxBaseUnits = MAX_WHOLE_SUPPLY * 10n ** 18n;
      expect(await maxToken.totalSupply()).to.equal(expectedMaxBaseUnits);
      expect(await maxToken.balanceOf(deployer.address)).to.equal(expectedMaxBaseUnits);
      expect(expectedMaxBaseUnits <= MAX_UINT256).to.be.true;
    });
  });

  describe("Standard Transfers & Allowances", function () {
    let token;
    const transferAmount = 250n * 10n ** 18n;

    beforeEach(async function () {
      token = await factory.deploy("Dragoon Token", "DRGN", SAMPLE_WHOLE_SUPPLY);
      await token.waitForDeployment();
    });

    it("executes standard transfer correctly between accounts", async function () {
      await expect(token.transfer(recipient.address, transferAmount))
        .to.emit(token, "Transfer")
        .withArgs(deployer.address, recipient.address, transferAmount);

      expect(await token.balanceOf(recipient.address)).to.equal(transferAmount);
      expect(await token.balanceOf(deployer.address)).to.equal(SAMPLE_BASE_UNITS - transferAmount);
    });

    it("reverts transfer when amount exceeds sender's available balance", async function () {
      // Recipient currently has 0 tokens
      await expect(
        token.connect(recipient).transfer(other.address, 1n)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });

    it("manages approvals and transferFrom flow accurately", async function () {
      const allowanceAmount = 500n * 10n ** 18n;

      await expect(token.approve(spender.address, allowanceAmount))
        .to.emit(token, "Approval")
        .withArgs(deployer.address, spender.address, allowanceAmount);

      expect(await token.allowance(deployer.address, spender.address)).to.equal(allowanceAmount);

      // Spend partial allowance
      const spendAmount = 300n * 10n ** 18n;
      await expect(
        token.connect(spender).transferFrom(deployer.address, recipient.address, spendAmount)
      )
        .to.emit(token, "Transfer")
        .withArgs(deployer.address, recipient.address, spendAmount);

      expect(await token.balanceOf(recipient.address)).to.equal(spendAmount);
      expect(await token.allowance(deployer.address, spender.address)).to.equal(allowanceAmount - spendAmount);
    });

    it("reverts transferFrom when amount exceeds granted allowance", async function () {
      const smallAllowance = 50n * 10n ** 18n;
      await token.approve(spender.address, smallAllowance);

      const excessiveSpend = 51n * 10n ** 18n;
      await expect(
        token.connect(spender).transferFrom(deployer.address, recipient.address, excessiveSpend)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });
  });

  describe("Interface & Security Boundaries (No Minting or Administrative Roles)", function () {
    it("exposes no external mint or administrative functions in the contract ABI", async function () {
      const token = await factory.deploy("Dragoon Token", "DRGN", SAMPLE_WHOLE_SUPPLY);
      await token.waitForDeployment();

      // Retrieve all function fragments from the ABI
      const functionNames = token.interface.fragments
        .filter((fragment) => fragment.type === "function")
        .map((fragment) => fragment.name);

      // Verify NO minting function exists in public interface
      const mintFunctions = functionNames.filter((name) =>
        name.toLowerCase().includes("mint")
      );
      expect(mintFunctions).to.deep.equal([], "ABI should not contain any minting functions");

      // Verify NO ownership or administrative functions exist
      const adminKeywords = [
        "owner",
        "renounce",
        "pause",
        "unpause",
        "blacklist",
        "freeze",
        "tax",
        "feerecipient",
        "upgrade",
        "setrole",
        "grantrole",
      ];

      for (const keyword of adminKeywords) {
        const found = functionNames.filter((name) =>
          name.toLowerCase().includes(keyword)
        );
        expect(found).to.deep.equal(
          [],
          `ABI should not contain administrative function containing '${keyword}'`
        );
      }

      // Expected strict set of ERC-20 standard functions + MAX_WHOLE_SUPPLY constant
      const expectedFunctions = [
        "MAX_WHOLE_SUPPLY",
        "allowance",
        "approve",
        "balanceOf",
        "decimals",
        "name",
        "symbol",
        "totalSupply",
        "transfer",
        "transferFrom",
      ].sort();

      expect([...functionNames].sort()).to.deep.equal(expectedFunctions);
    });
  });
});
