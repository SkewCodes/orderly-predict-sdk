import EventEmitter from "eventemitter3";
import { WebSocketError } from "./errors.js";
import type { OrderbookSnapshot, TradeMessage, WsMessage } from "./types.js";

type WsEvents = {
	orderbook: (snapshot: OrderbookSnapshot) => void;
	trade: (trade: TradeMessage) => void;
	connected: (marketId: string) => void;
	disconnected: (marketId: string) => void;
	error: (error: Error) => void;
};

const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000];

export class WebSocketManager extends EventEmitter<WsEvents> {
	private connections = new Map<string, WebSocket>();
	private reconnectAttempts = new Map<string, number>();
	private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
	private intentionalClose = new Set<string>();

	constructor(private readonly wsBaseUrl: string) {
		super();
	}

	subscribe(marketId: string): void {
		if (this.connections.has(marketId)) return;
		this.connect(marketId);
	}

	unsubscribe(marketId: string): void {
		this.intentionalClose.add(marketId);
		this.closeConnection(marketId);
	}

	unsubscribeAll(): void {
		for (const marketId of this.connections.keys()) {
			this.unsubscribe(marketId);
		}
	}

	isSubscribed(marketId: string): boolean {
		const ws = this.connections.get(marketId);
		return ws?.readyState === WebSocket.OPEN;
	}

	getSubscriptions(): string[] {
		return [...this.connections.keys()];
	}

	private connect(marketId: string): void {
		const url = `${this.wsBaseUrl}/ws/${marketId}`;

		let ws: WebSocket;
		try {
			ws = new WebSocket(url);
		} catch (err) {
			this.emit(
				"error",
				new WebSocketError(`Failed to create WebSocket for ${marketId}: ${err}`),
			);
			return;
		}

		this.connections.set(marketId, ws);

		ws.onopen = () => {
			this.reconnectAttempts.set(marketId, 0);
			this.emit("connected", marketId);
		};

		ws.onmessage = (event) => {
			try {
				const msg = JSON.parse(event.data as string) as WsMessage;
				if (msg.type === "orderbook") {
					this.emit("orderbook", msg);
				} else if (msg.type === "trade") {
					this.emit("trade", msg);
				}
			} catch (err) {
				this.emit(
					"error",
					new WebSocketError(`Failed to parse WS message: ${err}`),
				);
			}
		};

		ws.onerror = () => {
			this.emit("error", new WebSocketError(`WebSocket error for market ${marketId}`));
		};

		ws.onclose = () => {
			this.connections.delete(marketId);
			this.emit("disconnected", marketId);

			if (!this.intentionalClose.has(marketId)) {
				this.scheduleReconnect(marketId);
			} else {
				this.intentionalClose.delete(marketId);
			}
		};
	}

	private closeConnection(marketId: string): void {
		const timer = this.reconnectTimers.get(marketId);
		if (timer) {
			clearTimeout(timer);
			this.reconnectTimers.delete(marketId);
		}

		const ws = this.connections.get(marketId);
		if (ws) {
			ws.close();
			this.connections.delete(marketId);
		}

		this.reconnectAttempts.delete(marketId);
	}

	private scheduleReconnect(marketId: string): void {
		const attempts = this.reconnectAttempts.get(marketId) ?? 0;
		const delay = RECONNECT_DELAYS[Math.min(attempts, RECONNECT_DELAYS.length - 1)]!;

		const timer = setTimeout(() => {
			this.reconnectTimers.delete(marketId);
			this.reconnectAttempts.set(marketId, attempts + 1);
			this.connect(marketId);
		}, delay);

		this.reconnectTimers.set(marketId, timer);
	}

	destroy(): void {
		for (const marketId of [...this.connections.keys()]) {
			this.intentionalClose.add(marketId);
			this.closeConnection(marketId);
		}
		this.removeAllListeners();
	}
}
