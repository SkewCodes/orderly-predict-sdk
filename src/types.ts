import type {
	MARKET_CATEGORIES,
	MARKET_OUTCOMES,
	MARKET_STATUSES,
	ORDER_SIDES,
	ORDER_STATUSES,
	ORDER_TYPES,
} from "./constants.js";

// ─── Market ────────────────────────────────────────────────────────────────────

export type MarketCategory = (typeof MARKET_CATEGORIES)[number];
export type MarketStatus = (typeof MARKET_STATUSES)[number];
export type MarketOutcome = (typeof MARKET_OUTCOMES)[number];

export interface ResolutionCondition {
	type: "price_above" | "price_below" | "manual";
	asset?: string;
	targetPrice?: number;
	description?: string;
}

export interface Market {
	id: string;
	question: string;
	category: MarketCategory;
	expiry_at: string;
	oracle_source: string;
	resolution_condition: ResolutionCondition;
	status: MarketStatus;
	outcome: MarketOutcome | null;
	contract_address: string | null;
	collateral_pool: number;
	created_at: string;
}

export interface CreateMarketRequest {
	question: string;
	category: MarketCategory;
	expiryAt: string;
	oracleSource: string;
	resolutionCondition: ResolutionCondition;
}

// ─── Order ─────────────────────────────────────────────────────────────────────

export type OrderSide = (typeof ORDER_SIDES)[number];
export type OrderType = (typeof ORDER_TYPES)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface Order {
	id: string;
	market_id: string;
	user_address: string;
	side: OrderSide;
	order_type: OrderType;
	price_bps: number | null;
	quantity: number;
	filled_quantity: number;
	status: OrderStatus;
	created_at: string;
}

export interface PlaceOrderRequest {
	marketId: string;
	side: OrderSide;
	orderType: OrderType;
	priceBps?: number | null;
	quantity: number;
}

export interface PlaceOrderResponse {
	orderId: string;
	status: OrderStatus;
	fills: Fill[];
}

export interface CancelOrderResponse {
	cancelled: boolean;
	orderId: string;
}

// ─── Position & Balance ────────────────────────────────────────────────────────

export interface Position {
	id: string;
	market_id: string;
	user_address: string;
	side: OrderSide;
	quantity: number;
	avg_entry_bps: number;
	realized_pnl: number;
	markets?: {
		question: string;
		status: MarketStatus;
		outcome: MarketOutcome | null;
		expiry_at: string;
	};
}

export interface Balance {
	user_address?: string;
	available: number;
	locked: number;
}

// ─── Fills ─────────────────────────────────────────────────────────────────────

export interface Fill {
	quantity: string;
	priceBps: number;
	feeAmount: string;
}

// ─── WebSocket Messages ────────────────────────────────────────────────────────

export interface PriceLevel {
	priceBps: number;
	quantity: number;
	orderCount: number;
}

export interface OrderbookSnapshot {
	type: "orderbook";
	marketId: string;
	bids: PriceLevel[];
	asks: PriceLevel[];
	timestamp: number;
}

export interface TradeMessage {
	type: "trade";
	marketId: string;
	priceBps: number;
	quantity: number;
	side: OrderSide;
	timestamp: number;
}

export type WsMessage = OrderbookSnapshot | TradeMessage;

// ─── SDK Config ────────────────────────────────────────────────────────────────

export interface OrderlyPredictConfig {
	/** Base URL for the REST API (e.g. "https://predict-api.orderly.network") */
	apiUrl: string;
	/** Base URL for WebSocket (auto-derived from apiUrl if not provided) */
	wsUrl?: string;
	/** Chain ID for SIWE authentication (default: 42161 for Arbitrum One) */
	chainId?: number;
	/** Session duration in seconds (default: 86400 = 24h) */
	sessionDurationSec?: number;
	/** Admin API key for admin-only endpoints */
	adminApiKey?: string;
}

// ─── Wallet / Auth ─────────────────────────────────────────────────────────────

export interface WalletAdapter {
	/** Get the connected wallet address */
	getAddress(): Promise<string>;
	/** Sign a message and return the signature */
	signMessage(message: string): Promise<string>;
	/** Whether the wallet is currently connected */
	isConnected(): boolean;
	/** Connect the wallet (if not already connected) */
	connect(): Promise<string>;
	/** Disconnect */
	disconnect(): Promise<void>;
}

export interface Session {
	address: string;
	chainId: number;
	nonce: string;
	issuedAt: string;
	expiresAt: string;
	signature: string;
	message: string;
}

// ─── Events ────────────────────────────────────────────────────────────────────

export interface OrderlyPredictEvents {
	connected: (address: string) => void;
	disconnected: () => void;
	sessionCreated: (session: Session) => void;
	sessionExpired: () => void;
	orderbookUpdate: (snapshot: OrderbookSnapshot) => void;
	trade: (trade: TradeMessage) => void;
	wsConnected: (marketId: string) => void;
	wsDisconnected: (marketId: string) => void;
	error: (error: Error) => void;
}
