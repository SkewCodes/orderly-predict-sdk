import EventEmitter from "eventemitter3";
import { ApiClient } from "./api.js";
import { AuthenticationError, SessionExpiredError } from "./errors.js";
import { SessionManager } from "./session.js";
import { WebSocketManager } from "./websocket.js";
import type {
	Balance,
	CancelOrderResponse,
	CreateMarketRequest,
	Market,
	Order,
	OrderbookSnapshot,
	OrderlyPredictConfig,
	OrderlyPredictEvents,
	PlaceOrderRequest,
	PlaceOrderResponse,
	Position,
	Session,
	WalletAdapter,
} from "./types.js";

const DEFAULT_CHAIN_ID = 42161;
const DEFAULT_SESSION_DURATION_SEC = 86400;

export class OrderlyPredict extends EventEmitter<OrderlyPredictEvents> {
	public readonly api: ApiClient;
	public readonly ws: WebSocketManager;
	private readonly sessionManager: SessionManager;
	private wallet: WalletAdapter | null = null;
	private readonly config: Required<
		Pick<OrderlyPredictConfig, "apiUrl" | "wsUrl" | "chainId" | "sessionDurationSec">
	>;

	constructor(config: OrderlyPredictConfig) {
		super();

		const wsUrl =
			config.wsUrl ?? config.apiUrl.replace(/^http/, "ws").replace(/\/$/, "");

		this.config = {
			apiUrl: config.apiUrl.replace(/\/$/, ""),
			wsUrl,
			chainId: config.chainId ?? DEFAULT_CHAIN_ID,
			sessionDurationSec: config.sessionDurationSec ?? DEFAULT_SESSION_DURATION_SEC,
		};

		this.sessionManager = new SessionManager(
			this.config.chainId,
			this.config.sessionDurationSec,
			this.config.apiUrl,
		);

		this.api = new ApiClient(config, this.sessionManager);
		this.ws = new WebSocketManager(this.config.wsUrl);

		this.ws.on("orderbook", (snapshot) => this.emit("orderbookUpdate", snapshot));
		this.ws.on("trade", (trade) => this.emit("trade", trade));
		this.ws.on("connected", (marketId) => this.emit("wsConnected", marketId));
		this.ws.on("disconnected", (marketId) => this.emit("wsDisconnected", marketId));
		this.ws.on("error", (err) => this.emit("error", err));
	}

	// ─── Wallet & Auth ─────────────────────────────────────────────────────────

	async connect(wallet: WalletAdapter): Promise<Session> {
		this.wallet = wallet;
		const address = await wallet.connect();
		this.emit("connected", address);

		const session = await this.sessionManager.createSession(wallet);
		this.emit("sessionCreated", session);

		return session;
	}

	async disconnect(): Promise<void> {
		if (this.wallet) {
			await this.wallet.disconnect();
			this.wallet = null;
		}
		this.sessionManager.clearSession();
		this.ws.unsubscribeAll();
		this.emit("disconnected");
	}

	get isAuthenticated(): boolean {
		return this.sessionManager.isAuthenticated();
	}

	get session(): Session | null {
		return this.sessionManager.getSession();
	}

	get address(): string | null {
		return this.session?.address ?? null;
	}

	async refreshSession(): Promise<Session> {
		if (!this.wallet) throw new AuthenticationError("No wallet connected");
		const session = await this.sessionManager.createSession(this.wallet);
		this.emit("sessionCreated", session);
		return session;
	}

	// ─── Markets (public) ──────────────────────────────────────────────────────

	async getMarkets(status?: string): Promise<Market[]> {
		return this.api.getMarkets(status);
	}

	async getMarket(id: string): Promise<Market> {
		return this.api.getMarket(id);
	}

	async getOrderbook(marketId: string): Promise<OrderbookSnapshot> {
		return this.api.getOrderbook(marketId);
	}

	// ─── Trading (authenticated) ──────────────────────────────────────────────

	async placeOrder(req: PlaceOrderRequest): Promise<PlaceOrderResponse> {
		this.requireAuth();
		return this.api.placeOrder(req);
	}

	async cancelOrder(orderId: string): Promise<CancelOrderResponse> {
		this.requireAuth();
		return this.api.cancelOrder(orderId);
	}

	async getOrders(params?: { marketId?: string }): Promise<Order[]> {
		this.requireAuth();
		return this.api.getOrders({
			address: this.address!,
			...params,
		});
	}

	async getPositions(): Promise<Position[]> {
		this.requireAuth();
		return this.api.getPositions(this.address!);
	}

	async getBalance(): Promise<Balance> {
		this.requireAuth();
		return this.api.getBalance(this.address!);
	}

	// ─── WebSocket (real-time) ─────────────────────────────────────────────────

	subscribeOrderbook(marketId: string): void {
		this.ws.subscribe(marketId);
	}

	unsubscribeOrderbook(marketId: string): void {
		this.ws.unsubscribe(marketId);
	}

	// ─── Admin ─────────────────────────────────────────────────────────────────

	async createMarket(req: CreateMarketRequest): Promise<Market> {
		return this.api.createMarket(req);
	}

	async resolveMarket(
		marketId: string,
		outcome: "YES" | "NO",
	): Promise<{ resolved: boolean }> {
		return this.api.resolveMarket(marketId, outcome);
	}

	// ─── Health ────────────────────────────────────────────────────────────────

	async health(): Promise<{ status: string; timestamp: number }> {
		return this.api.health();
	}

	// ─── Cleanup ───────────────────────────────────────────────────────────────

	destroy(): void {
		this.ws.destroy();
		this.sessionManager.clearSession();
		this.removeAllListeners();
	}

	// ─── Internal ──────────────────────────────────────────────────────────────

	private requireAuth(): void {
		if (!this.sessionManager.isAuthenticated()) {
			if (this.sessionManager.getSession()) {
				this.emit("sessionExpired");
				throw new SessionExpiredError();
			}
			throw new AuthenticationError();
		}
	}
}
