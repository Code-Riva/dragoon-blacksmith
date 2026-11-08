import "./globals.css";
import Web3Provider from "@/components/Web3Provider";

export const metadata = {
  title: "Dragoon’s Blacksmith — Fixed-Supply ERC-20 Token Blueprint",
  description:
    "Create a fixed-supply ERC-20 token on Ethereum Sepolia.",
  keywords: [
    "Dragoon's Blacksmith",
    "ERC-20",
    "Ethereum Sepolia",
    "Token Blueprint",
    "Token Overview",
    "Portfolio",
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col font-sans selection:bg-orange-950/50">
        <Web3Provider>
          {children}
        </Web3Provider>
      </body>
    </html>
  );
}
