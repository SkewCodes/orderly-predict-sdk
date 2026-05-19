// Core client
export { OrderlyPredict } from "./client.js";

// API & WebSocket
export { ApiClient } from "./api.js";
export { WebSocketManager } from "./websocket.js";

// Wallet adapters
export {
	InjectedWalletAdapter,
	ViemWalletAdapter,
	CustomWalletAdapter,
	SolanaWalletAdapter,
	bridgeOrderlyWallet,
} from "./wallet.js";
export type { OrderlyAccountLike, SolanaWalletLike } from "./wallet.js";

// Session
export { SessionManager } from "./session.js";

// Errors
export {
	OrderlyPredictError,
	AuthenticationError,
	SessionExpiredError,
	ApiError,
	WalletError,
	WebSocketError,
} from "./errors.js";

// Types
export type {
	Market,
	MarketCategory,
	MarketStatus,
	MarketOutcome,
	ResolutionCondition,
	CreateMarketRequest,
	Order,
	OrderSide,
	OrderType,
	OrderStatus,
	PlaceOrderRequest,
	PlaceOrderResponse,
	CancelOrderResponse,
	Position,
	Balance,
	Fill,
	OrderFill,
	PriceLevel,
	OrderbookSnapshot,
	TradeMessage,
	WsMessage,
	OrderlyPredictConfig,
	AuthMode,
	ChainNamespace,
	WalletAdapter,
	Session,
	OrderlyPredictEvents,
} from "./types.js";

// Constants
export {
	PRICE_MIN_BPS,
	PRICE_MAX_BPS,
	PRICE_COMPLEMENT_BPS,
	USDC_DECIMALS,
	USDC_UNIT,
	FEE_MINT_BPS,
	FEE_TRADE_BPS,
	FEE_SETTLE_BPS,
	FEE_BROKER_SHARE_BPS,
	FEE_PROTOCOL_SHARE_BPS,
	FEE_BASE_BPS,
	MARKET_CATEGORIES,
	ORDER_SIDES,
	ORDER_TYPES,
	MARKET_STATUSES,
	ORDER_STATUSES,
	MARKET_OUTCOMES,
} from "./constants.js";
