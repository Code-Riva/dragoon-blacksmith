const { expect } = require("chai");
const { ethers } = require("hardhat");
const artifact = require("../lib/contracts/ERC20FixedSupply.json");

describe("Token Deployment Helper & Contract Initialization", function () {
  let deployer;
  let recipient;
  let other;

  const SAMPLE_NAME = "Aethelgard Guild";
  const SAMPLE_SYMBOL = "AGRD";
  const SAMPLE_WHOLE_SUPPLY = 5_000_000n;
  const EXPECTED_SCALED_SUPPLY = SAMPLE_WHOLE_SUPPLY * 10n ** 18n;

  beforeEach(async function () {
    [deployer, recipient, other] = await ethers.getSigners();
  });

  it("verifies exported artifact contains valid ABI, bytecode, and Cancun EVM metadata", function () {
    expect(artifact.abi).to.be.an("array");
    expect(artifact.bytecode).to.be.a("string");
    expect(artifact.bytecode.startsWith("0x")).to.be.true;
    expect(artifact.bytecode.length).to.be.greaterThan(100);
    expect(artifact.compiler.version).to.equal("0.8.28");
    expect(artifact.unitsConvention.inputUnit).to.equal("whole tokens");
    expect(artifact.unitsConvention.decimals).to.equal(18);
  });

  it("deploys token passing WHOLE TOKENS as constructor supply without pre-scaling", async function () {
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);

    // Pass constructor supply in WHOLE TOKENS directly: SAMPLE_WHOLE_SUPPLY
    const token = await factory.deploy(SAMPLE_NAME, SAMPLE_SYMBOL, SAMPLE_WHOLE_SUPPLY);
    await token.waitForDeployment();
    const contractAddress = await token.getAddress();

    expect(contractAddress).to.be.properAddress;

    // Verify on-chain parameters
    expect(await token.name()).to.equal(SAMPLE_NAME);
    expect(await token.symbol()).to.equal(SAMPLE_SYMBOL);
    expect(await token.decimals()).to.equal(18);

    // Total supply must equal initial whole tokens * 10^18
    expect(await token.totalSupply()).to.equal(EXPECTED_SCALED_SUPPLY);

    // Initial supply must be 100% minted directly to the deployer
    expect(await token.balanceOf(deployer.address)).to.equal(EXPECTED_SCALED_SUPPLY);

    // Other addresses must have 0 balance
    expect(await token.balanceOf(recipient.address)).to.equal(0n);
    expect(await token.balanceOf(other.address)).to.equal(0n);
  });

  it("verifies constructor handles maximum whole supply correctly", async function () {
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);

    // Maximum uint256 / 10^18
    const maxUint256 = (1n << 256n) - 1n;
    const maxWholeSupply = maxUint256 / 10n ** 18n;

    const token = await factory.deploy("Max Supply Token", "MAXT", maxWholeSupply);
    await token.waitForDeployment();

    expect(await token.totalSupply()).to.equal(maxWholeSupply * 10n ** 18n);
    expect(await token.balanceOf(deployer.address)).to.equal(maxWholeSupply * 10n ** 18n);
  });

  it("verifies deploy transaction uses 0 value and consumes expected gas range", async function () {
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
    const deployTx = await factory.getDeployTransaction(SAMPLE_NAME, SAMPLE_SYMBOL, SAMPLE_WHOLE_SUPPLY);

    // Value must be 0 (no native ETH transferred into contract)
    expect(deployTx.value || 0n).to.equal(0n);

    // Estimate gas for deployment
    const estimatedGas = await deployer.estimateGas(deployTx);
    expect(estimatedGas).to.be.greaterThan(500_000n);
    expect(estimatedGas).to.be.lessThan(2_000_000n);
  });
});
