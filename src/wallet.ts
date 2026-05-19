import type { ChainNamespace, WalletAdapter } from "./types.js";
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

/**
 * Wallet adapter for Solana wallets implementing the wallet-adapter-base interface.
 * Works with Phantom, Solflare, Backpack, etc. via @solana/wallet-adapter.
 *
 * @example
 * ```ts
 * import { useWallet } from "@solana/wallet-adapter-react";
 * import { SolanaWalletAdapter, OrderlyPredict } from "@orderly-predict/sdk";
 *
 * const { publicKey, signMessage, connected } = useWallet();
 * const predict = new OrderlyPredict({ apiUrl: "...", chainNamespace: "solana" });
 * await predict.connect(new SolanaWalletAdapter({ publicKey, signMessage, connected }));
 * ```
 */
export class SolanaWalletAdapter implements WalletAdapter {
	readonly chainNamespace: ChainNamespace = "solana";
	private _connected = false;

	constructor(private readonly solana: SolanaWalletLike) {}

	async connect(): Promise<string> {
		if (this.solana.connect) {
			await this.solana.connect();
		}
		this._connected = true;
		return this.getAddress();
	}

	async getAddress(): Promise<string> {
		const pubkey = this.solana.publicKey;
		if (!pubkey) throw new WalletError("Solana wallet not connected — no publicKey");
		return typeof pubkey === "string" ? pubkey : pubkey.toBase58();
	}

	async signMessage(message: string): Promise<string> {
		if (!this.solana.signMessage) {
			throw new WalletError("Solana wallet does not support signMessage");
		}
		const encoded = new TextEncoder().encode(message);
		const signatureBytes = await this.solana.signMessage(encoded);
		return encodeBase58(signatureBytes);
	}

	isConnected(): boolean {
		return this._connected || !!this.solana.connected;
	}

	async disconnect(): Promise<void> {
		if (this.solana.disconnect) {
			await this.solana.disconnect();
		}
		this._connected = false;
	}
}

/**
 * Bridge adapter for @orderly.network/js-sdk Account instances.
 * Allows reusing an already-connected Orderly JS SDK wallet with the Predict SDK.
 *
 * @example
 * ```ts
 * import { useAccountInstance } from "@orderly.network/hooks";
 * import { bridgeOrderlyWallet, OrderlyPredict } from "@orderly-predict/sdk";
 *
 * const account = useAccountInstance();
 * const predict = new OrderlyPredict({ apiUrl: "..." });
 * await predict.connect(bridgeOrderlyWallet(account));
 * ```
 */
export function bridgeOrderlyWallet(orderlyAccount: OrderlyAccountLike): WalletAdapter {
	return new CustomWalletAdapter({
		address: orderlyAccount.address,
		signMessage: (message: string) => orderlyAccount.signMessage(message),
		onConnect: async () => {
			if (!orderlyAccount.address) {
				throw new WalletError("Orderly account not connected");
			}
		},
	});
}

/**
 * Minimal interface describing what we need from an @orderly.network/core Account.
 * Avoids a hard dependency on the Orderly JS SDK package.
 */
export interface OrderlyAccountLike {
	address: string;
	signMessage(message: string): Promise<string>;
}

// ─── Minimal type declarations for injected providers ──────────────────────────

interface EIP1193Provider {
	request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

interface ViemWalletClient {
	getAddresses(): Promise<`0x${string}`[]>;
	signMessage(args: { account: `0x${string}`; message: string }): Promise<string>;
}

/**
 * Minimal interface for Solana wallet-adapter compatible wallets.
 * Matches the shape from @solana/wallet-adapter-base / useWallet().
 */
export interface SolanaWalletLike {
	publicKey: { toBase58(): string } | string | null;
	signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
	connected?: boolean;
	connect?: () => Promise<void>;
	disconnect?: () => Promise<void>;
}

declare global {
	interface Window {
		ethereum?: EIP1193Provider;
	}
}

// ─── Base58 encoder (no external dependency) ────────────────────────────────────

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function encodeBase58(bytes: Uint8Array): string {
	const digits: number[] = [0];
	for (const byte of bytes) {
		let carry = byte;
		for (let j = 0; j < digits.length; j++) {
			carry += digits[j]! * 256;
			digits[j] = carry % 58;
			carry = (carry / 58) | 0;
		}
		while (carry > 0) {
			digits.push(carry % 58);
			carry = (carry / 58) | 0;
		}
	}
	let result = "";
	for (const byte of bytes) {
		if (byte === 0) result += BASE58_ALPHABET[0];
		else break;
	}
	for (let i = digits.length - 1; i >= 0; i--) {
		result += BASE58_ALPHABET[digits[i]!];
	}
	return result;
}
