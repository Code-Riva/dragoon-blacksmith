const fs = require("fs");
const path = require("path");

function exportArtifacts() {
  console.log("==> Exporting ERC20FixedSupply contract artifacts...");

  const hardhatArtifactPath = path.join(
    __dirname,
    "..",
    "artifacts_hardhat",
    "contracts",
    "ERC20FixedSupply.sol",
    "ERC20FixedSupply.json"
  );

  if (!fs.existsSync(hardhatArtifactPath)) {
    console.error("Artifact not found! Run hardhat compile first.");
    process.exit(1);
  }

  const rawArtifact = JSON.parse(fs.readFileSync(hardhatArtifactPath, "utf8"));

  const exportPayload = {
    contractName: rawArtifact.contractName,
    sourceName: rawArtifact.sourceName,
    compiler: {
      version: "0.8.28",
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
    unitsConvention: {
      inputUnit: "whole tokens",
      scaleFactor: "10^18",
      contractOperation: "initialWholeSupply * 10^18 inside constructor",
      decimals: 18,
    },
    abi: rawArtifact.abi,
    bytecode: rawArtifact.bytecode,
    deployedBytecode: rawArtifact.deployedBytecode,
    exportedAt: new Date().toISOString(),
  };

  // Ensure export directories exist
  const outputDirs = [
    path.join(__dirname, "..", "contracts-artifacts"),
    path.join(__dirname, "..", "lib", "contracts"),
  ];

  for (const dir of outputDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const targetFile = path.join(dir, "ERC20FixedSupply.json");
    fs.writeFileSync(targetFile, JSON.stringify(exportPayload, null, 2), "utf8");
    console.log(`Saved artifact to: ${targetFile}`);
  }

  console.log("==> Artifact export completed successfully.");
}

exportArtifacts();
