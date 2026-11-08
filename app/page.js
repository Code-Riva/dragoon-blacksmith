"use client";

import { useState, useMemo } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TokenForm from "@/components/TokenForm";
import TokenPreview from "@/components/TokenPreview";
import DeploymentModal from "@/components/DeploymentModal";
import {
  validateTokenName,
  validateTokenSymbol,
  validateSupply,
} from "@/lib/tokenValidation";

const DEFAULT_STATE = {
  name: "Dragoon Token",
  symbol: "DRGN",
  supply: "1000000",
};

export default function Home() {
  const [name, setName] = useState(DEFAULT_STATE.name);
  const [symbol, setSymbol] = useState(DEFAULT_STATE.symbol);
  const [supply, setSupply] = useState(DEFAULT_STATE.supply);

  const [touched, setTouched] = useState({
    name: false,
    symbol: false,
    supply: false,
  });

  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);

  // Pure validation computations using string & BigInt arithmetic
  const nameValidation = useMemo(() => validateTokenName(name), [name]);
  const symbolValidation = useMemo(() => validateTokenSymbol(symbol), [symbol]);
  const supplyValidation = useMemo(() => validateSupply(supply), [supply]);

  const errors = {
    name: nameValidation.error,
    symbol: symbolValidation.error,
    supply: supplyValidation.error,
  };

  const isFormValid =
    nameValidation.isValid && symbolValidation.isValid && supplyValidation.isValid;

  const handleNameChange = (val) => {
    setName(val);
    if (!touched.name) {
      setTouched((prev) => ({ ...prev, name: true }));
    }
  };

  const handleSymbolChange = (val) => {
    setSymbol(val.toUpperCase());
    if (!touched.symbol) {
      setTouched((prev) => ({ ...prev, symbol: true }));
    }
  };

  const handleSupplyChange = (val) => {
    setSupply(val);
    if (!touched.supply) {
      setTouched((prev) => ({ ...prev, supply: true }));
    }
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleReset = () => {
    setName(DEFAULT_STATE.name);
    setSymbol(DEFAULT_STATE.symbol);
    setSupply(DEFAULT_STATE.supply);
    setTouched({
      name: false,
      symbol: false,
      supply: false,
    });
  };

  const handleOpenDeployModal = () => {
    if (isFormValid) {
      setIsDeployModalOpen(true);
    }
  };

  const handleCloseDeployModal = () => {
    setIsDeployModalOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col text-forge-textPrimary">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Intro section with Dragoon's Blacksmith branding */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-forge-textPrimary">
            Dragoon’s Blacksmith
          </h1>
          <p className="mt-2 text-base font-medium text-orange-400 max-w-2xl">
            Create a fixed-supply ERC-20 token on Ethereum Sepolia.
          </p>
          <p className="mt-1.5 text-sm text-forge-textSecondary max-w-2xl leading-relaxed">
            Configure immutable parameters in the token blueprint. Preview metadata, scale calculations,
            and token base units in real time before deployment.
          </p>
        </div>

        {/* Responsive Two-Column Desktop Layout: Blueprint on Left, Overview on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* Left Column: Token Blueprint */}
          <TokenForm
            name={name}
            symbol={symbol}
            supply={supply}
            errors={errors}
            touched={touched}
            isFormValid={isFormValid}
            supplyBigInt={supplyValidation.isValid ? supplyValidation.supplyBigInt : null}
            onNameChange={handleNameChange}
            onSymbolChange={handleSymbolChange}
            onSupplyChange={handleSupplyChange}
            onReset={handleReset}
            onBlur={handleBlur}
          />

          {/* Right Column: Token Overview */}
          <TokenPreview
            name={name}
            symbol={symbol}
            supply={supply}
            isFormValid={isFormValid}
            supplyBigInt={supplyValidation.isValid ? supplyValidation.supplyBigInt : null}
            weiBigInt={supplyValidation.isValid ? supplyValidation.weiBigInt : null}
            onOpenDeployModal={handleOpenDeployModal}
          />
        </div>
      </main>

      <Footer />

      {/* Deployment Modal */}
      {isDeployModalOpen && (
        <DeploymentModal
          isOpen={isDeployModalOpen}
          onClose={handleCloseDeployModal}
          name={name}
          symbol={symbol}
          supply={supply}
          supplyBigInt={supplyValidation.isValid ? supplyValidation.supplyBigInt : null}
          onResetBlueprint={handleReset}
        />
      )}
    </div>
  );
}
