import { ApiError } from "./errors.js";
import type {
	Balance,
	CancelOrderResponse,
	CreateMarketRequest,
	Market,
	Order,
	OrderlyPredictConfig,
	PlaceOrderRequest,
	PlaceOrderResponse,
	OrderbookSnapshot,
	Position,
} from "./types.js";
import type { SessionManager } from "./session.js";

export class ApiClient {
	private readonly baseUrl: string;
	private readonly adminApiKey?: string;
	private readonly brokerId?: string;

	constructor(
		config: OrderlyPredictConfig,
		private readonly sessionManager: SessionManager,
	) {
		this.baseUrl = config.apiUrl.replace(/\/$/, "");
		this.adminApiKey = config.adminApiKey;
		this.brokerId = config.brokerId;
	}

	// ─── Markets ───────────────────────────────────────────────────────────────

	async getMarkets(status = "TRADING"): Promise<Market[]> {
		const data = await this.get<{ markets: Market[] }>(`/markets?status=${status}`);
		return data.markets;
	}

	async getMarket(id: string): Promise<Market> {
		const data = await this.get<{ market: Market }>(`/markets/${id}`);
		return data.market;
	}

	async createMarket(req: CreateMarketRequest): Promise<Market> {
		const data = await this.post<{ market: Market }>("/markets", req, {
			admin: true,
		});
		return data.market;
	}

	// ─── Orderbook ─────────────────────────────────────────────────────────────

	async getOrderbook(marketId: string): Promise<OrderbookSnapshot> {
		return this.get<OrderbookSnapshot>(`/orderbook/${marketId}`);
	}

	// ─── Orders ────────────────────────────────────────────────────────────────

	async placeOrder(req: PlaceOrderRequest): Promise<PlaceOrderResponse> {
		return this.post<PlaceOrderResponse>("/orders", req, { auth: true });
	}

	async cancelOrder(orderId: string): Promise<CancelOrderResponse> {
		return this.delete<CancelOrderResponse>(`/orders/${orderId}`, { auth: true });
	}

	async getOrders(params?: { address?: string; marketId?: string }): Promise<Order[]> {
		const searchParams = new URLSearchParams();
		if (params?.address) searchParams.set("address", params.address);
		if (params?.marketId) searchParams.set("market_id", params.marketId);
		const query = searchParams.toString();
		const data = await this.get<{ orders: Order[] }>(`/orders${query ? `?${query}` : ""}`);
		return data.orders;
	}

	// ─── Positions & Balance ───────────────────────────────────────────────────

	async getPositions(address: string): Promise<Position[]> {
		const data = await this.get<{ positions: Position[] }>(
			`/positions?address=${address}`,
		);
		return data.positions;
	}

	async getBalance(address: string): Promise<Balance> {
		const data = await this.get<{ balance: Balance }>(
			`/positions/balance?address=${address}`,
		);
		return data.balance;
	}

	// ─── Admin ─────────────────────────────────────────────────────────────────

	async resolveMarket(
		marketId: string,
		outcome: "YES" | "NO",
	): Promise<{ resolved: boolean }> {
		return this.post<{ resolved: boolean }>(
			`/admin/resolve/${marketId}`,
			{ outcome },
			{ admin: true },
		);
	}

	// ─── Health ────────────────────────────────────────────────────────────────

	async health(): Promise<{ status: string; timestamp: number }> {
		return this.get<{ status: string; timestamp: number }>("/health");
	}

	// ─── Internal HTTP methods ─────────────────────────────────────────────────

	private async get<T>(path: string, opts?: RequestOpts): Promise<T> {
		return this.request<T>("GET", path, undefined, opts);
	}

	private async post<T>(path: string, body: unknown, opts?: RequestOpts): Promise<T> {
		return this.request<T>("POST", path, body, opts);
	}

	private async delete<T>(path: string, opts?: RequestOpts): Promise<T> {
		return this.request<T>("DELETE", path, undefined, opts);
	}

	private async request<T>(
		method: string,
		path: string,
		body?: unknown,
		opts?: RequestOpts,
	): Promise<T> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};

		if (this.brokerId) {
			headers["x-broker-id"] = this.brokerId;
		}

		if (opts?.auth) {
			const authHeaders = this.sessionManager.getAuthHeaders();
			Object.assign(headers, authHeaders);
		}

		if (opts?.admin && this.adminApiKey) {
			headers["x-admin-key"] = this.adminApiKey;
		}

		const res = await fetch(`${this.baseUrl}${path}`, {
			method,
			headers,
			body: body ? JSON.stringify(body) : undefined,
		});

		if (!res.ok) {
			const errorBody = await res.json().catch(() => ({ error: res.statusText }));
			throw new ApiError(
				(errorBody as { error?: string }).error ?? `HTTP ${res.status}`,
				res.status,
				errorBody,
			);
		}

		return res.json() as Promise<T>;
	}
}

interface RequestOpts {
	auth?: boolean;
	admin?: boolean;
}
