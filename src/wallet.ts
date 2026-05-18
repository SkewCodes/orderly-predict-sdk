import type { WalletAdapter } from "./types.js";
import { WalletError } from "./errors.js";

/**
 * Wallet adapter for browser-injected EIP-1193 providers (MetaMask, etc.)
 */
export class InjectedWalletAdapter implements WalletAdapter {
	private address: string | null = null;
	private provider: EIP1193Provider | null = null;

	constructor(private readonly requestedChainId?: number) {}

	async connect(): Promise<string> {
		const provider = this.getProvider();
		try {
			const accounts = (await provider.request({
				method: "eth_requestAccounts",
			})) as string[];

			const addr = accounts[0];
			if (!addr) throw new WalletError("No accounts returned from wallet");

			this.address = addr;

			if (this.requestedChainId) {
				await this.switchChain(this.requestedChainId);
			}

			return addr;
		} catch (err) {
			if (err instanceof WalletError) throw err;
			throw new WalletError(
				`Failed to connect wallet: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	async getAddress(): Promise<string> {
		if (this.address) return this.address;
		return this.connect();
	}

	async signMessage(message: string): Promise<string> {
		const provider = this.getProvider();
		const address = await this.getAddress();
		try {
			const signature = (await provider.request({
				method: "personal_sign",
				params: [message, address],
			})) as string;
			return signature;
		} catch (err) {
			throw new WalletError(
				`Failed to sign message: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	isConnected(): boolean {
		return this.address !== null;
	}

	async disconnect(): Promise<void> {
		this.address = null;
		this.provider = null;
	}

	private getProvider(): EIP1193Provider {
		if (this.provider) return this.provider;

		if (typeof window === "undefined" || !window.ethereum) {
			throw new WalletError("No injected wallet provider found (window.ethereum)");
		}

		this.provider = window.ethereum as EIP1193Provider;
		return this.provider;
	}

	private async switchChain(chainId: number): Promise<void> {
		const provider = this.getProvider();
		const hexChainId = `0x${chainId.toString(16)}`;
		try {
			await provider.request({
				method: "wallet_switchEthereumChain",
				params: [{ chainId: hexChainId }],
			});
		} catch {
			// Chain not added — ignore switch failure
		}
	}
}

/**
 * Wallet adapter using viem WalletClient
 */
export class ViemWalletAdapter implements WalletAdapter {
	private connected = false;

	constructor(
		private readonly walletClient: ViemWalletClient,
		private readonly account?: `0x${string}`,
	) {}

	async connect(): Promise<string> {
		this.connected = true;
		return this.getAddress();
	}

	async getAddress(): Promise<string> {
		if (this.account) return this.account;
		const [address] = await this.walletClient.getAddresses();
		if (!address) throw new WalletError("No accounts available in viem wallet client");
		return address;
	}

	async signMessage(message: string): Promise<string> {
		const address = await this.getAddress();
		return this.walletClient.signMessage({
			account: address as `0x${string}`,
			message,
		});
	}

	isConnected(): boolean {
		return this.connected;
	}

	async disconnect(): Promise<void> {
		this.connected = false;
	}
}

/**
 * Custom wallet adapter — bring your own signing function
 */
export class CustomWalletAdapter implements WalletAdapter {
	private connected = false;

	constructor(
		private readonly config: {
			address: string;
			signMessage: (message: string) => Promise<string>;
			onConnect?: () => Promise<void>;
			onDisconnect?: () => Promise<void>;
		},
	) {}

	async connect(): Promise<string> {
		if (this.config.onConnect) await this.config.onConnect();
		this.connected = true;
		return this.config.address;
	}

	async getAddress(): Promise<string> {
		return this.config.address;
	}

	async signMessage(message: string): Promise<string> {
		return this.config.signMessage(message);
	}

	isConnected(): boolean {
		return this.connected;
	}

	async disconnect(): Promise<void> {
		if (this.config.onDisconnect) await this.config.onDisconnect();
		this.connected = false;
	}
}

// ─── Minimal type declarations for injected providers ──────────────────────────

interface EIP1193Provider {
	request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

interface ViemWalletClient {
	getAddresses(): Promise<`0x${string}`[]>;
	signMessage(args: { account: `0x${string}`; message: string }): Promise<string>;
}

declare global {
	interface Window {
		ethereum?: EIP1193Provider;
	}
}
