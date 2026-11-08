import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { fallback } from "viem";

const customRpc = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL : undefined;

export const wagmiConfig = createConfig({
  chains: [sepolia],
  transports: {
    [sepolia.id]: fallback([
      ...(customRpc ? [http(customRpc)] : []),
      http("https://ethereum-sepolia-rpc.publicnode.com"),
      http("https://rpc.sepolia.org"),
      http("https://sepolia.drpc.org"),
    ]),
  },
  connectors: [
    injected(),
  ],
  multiInjectedProviderDiscovery: true,
  ssr: true,
});
