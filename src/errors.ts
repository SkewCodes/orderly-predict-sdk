export class OrderlyPredictError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly statusCode?: number,
		public readonly details?: unknown,
	) {
		super(message);
		this.name = "OrderlyPredictError";
	}
}

export class AuthenticationError extends OrderlyPredictError {
	constructor(message = "Authentication required") {
		super(message, "AUTH_REQUIRED", 401);
		this.name = "AuthenticationError";
	}
}

export class SessionExpiredError extends OrderlyPredictError {
	constructor() {
		super("Session has expired", "SESSION_EXPIRED", 401);
		this.name = "SessionExpiredError";
	}
}

export class ApiError extends OrderlyPredictError {
	constructor(message: string, statusCode: number, details?: unknown) {
		super(message, "API_ERROR", statusCode, details);
		this.name = "ApiError";
	}
}

export class WalletError extends OrderlyPredictError {
	constructor(message: string) {
		super(message, "WALLET_ERROR");
		this.name = "WalletError";
	}
}

export class WebSocketError extends OrderlyPredictError {
	constructor(message: string) {
		super(message, "WEBSOCKET_ERROR");
		this.name = "WebSocketError";
	}
}
