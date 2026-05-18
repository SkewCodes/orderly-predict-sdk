import { SiweMessage } from "siwe";
import type { Session, WalletAdapter } from "./types.js";

const DEFAULT_SESSION_DURATION_SEC = 86400; // 24 hours
const DEFAULT_CHAIN_ID = 42161; // Arbitrum One

export class SessionManager {
	private session: Session | null = null;

	constructor(
		private readonly chainId: number = DEFAULT_CHAIN_ID,
		private readonly sessionDurationSec: number = DEFAULT_SESSION_DURATION_SEC,
		private readonly apiUrl: string = "",
	) {}

	async createSession(wallet: WalletAdapter): Promise<Session> {
		const address = await wallet.getAddress();
		const nonce = this.generateNonce();
		const issuedAt = new Date().toISOString();
		const expiresAt = new Date(
			Date.now() + this.sessionDurationSec * 1000,
		).toISOString();

		const domain = this.extractDomain(this.apiUrl);

		const siweMessage = new SiweMessage({
			domain,
			address,
			statement: "Sign in to Orderly Predict",
			uri: this.apiUrl,
			version: "1",
			chainId: this.chainId,
			nonce,
			issuedAt,
			expirationTime: expiresAt,
		});

		const message = siweMessage.prepareMessage();
		const signature = await wallet.signMessage(message);

		this.session = {
			address,
			chainId: this.chainId,
			nonce,
			issuedAt,
			expiresAt,
			signature,
			message,
		};

		return this.session;
	}

	getSession(): Session | null {
		if (!this.session) return null;
		if (this.isExpired()) {
			this.session = null;
			return null;
		}
		return this.session;
	}

	isExpired(): boolean {
		if (!this.session) return true;
		return new Date(this.session.expiresAt).getTime() < Date.now();
	}

	isAuthenticated(): boolean {
		return this.session !== null && !this.isExpired();
	}

	getAuthHeaders(): Record<string, string> {
		if (!this.session || this.isExpired()) {
			return {};
		}
		return {
			"x-user-address": this.session.address,
			"x-auth-signature": this.session.signature,
			"x-auth-message": this.session.message,
			"x-auth-nonce": this.session.nonce,
		};
	}

	clearSession(): void {
		this.session = null;
	}

	private generateNonce(): string {
		const array = new Uint8Array(16);
		crypto.getRandomValues(array);
		return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
	}

	private extractDomain(url: string): string {
		try {
			return new URL(url).host;
		} catch {
			return "localhost";
		}
	}
}
