# @orderly-predict/sdk

TypeScript SDK for [Orderly Predict](https://orderly.network) — a prediction market platform built on Orderly Network infrastructure.

Provides a fully typed API client, real-time WebSocket orderbook streaming, and wallet connectivity with EIP-4361 (SIWE) authentication.

## Installation

```bash
npm install @orderly-predict/sdk viem
```

## Quick Start

```typescript
import { OrderlyPredict, InjectedWalletAdapter } from "@orderly-predict/sdk";

const client = new OrderlyPredict({
  apiUrl: "https://predict-api.orderly.network",
  chainId: 42161, // Arbitrum One
});

// Connect wallet & authenticate (SIWE)
const wallet = new InjectedWalletAdapter(42161);
await client.connect(wallet);

// Browse markets
const markets = await client.getMarkets();

// Place a limit order
const result = await client.placeOrder({
  marketId: "market-uuid-here",
  side: "YES",
  orderType: "LIMIT",
  priceBps: 65, // 65 cents
  quantity: 100,
});

// Subscribe to real-time orderbook
client.on("orderbookUpdate", (snapshot) => {
  console.log("Bids:", snapshot.bids);
  console.log("Asks:", snapshot.asks);
});
client.subscribeOrderbook("market-uuid-here");
```

## Features

- **Typed API Client** — Full coverage of markets, orders, positions, balance, and admin endpoints
- **SIWE Authentication** — EIP-4361 Sign-In with Ethereum for secure session management
- **WebSocket Streaming** — Real-time orderbook snapshots and trade events with auto-reconnect
- **Wallet Adapters** — Injected (MetaMask), viem WalletClient, or bring-your-own
- **Event System** — Subscribe to connection, session, orderbook, and trade events
- **Tree-shakeable** — ESM-only, use only what you need

## Configuration

```typescript
import { OrderlyPredict } from "@orderly-predict/sdk";

const client = new OrderlyPredict({
  apiUrl: "https://predict-api.orderly.network",
  wsUrl: "wss://predict-api.orderly.network", // auto-derived if omitted
  chainId: 42161,              // default: 42161 (Arbitrum One)
  sessionDurationSec: 86400,   // default: 24 hours
  adminApiKey: "...",          // optional, for admin endpoints
});
```

## Wallet Adapters

### Injected Provider (MetaMask, etc.)

```typescript
import { InjectedWalletAdapter } from "@orderly-predict/sdk";

const wallet = new InjectedWalletAdapter(42161);
await client.connect(wallet);
```

### viem WalletClient

```typescript
import { ViemWalletAdapter } from "@orderly-predict/sdk";
import { createWalletClient, http } from "viem";
import { arbitrum } from "viem/chains";

const walletClient = createWalletClient({
  chain: arbitrum,
  transport: http(),
});

const wallet = new ViemWalletAdapter(walletClient, "0xYourAddress");
await client.connect(wallet);
```

### Custom Adapter

```typescript
import { CustomWalletAdapter } from "@orderly-predict/sdk";

const wallet = new CustomWalletAdapter({
  address: "0xYourAddress",
  signMessage: async (message) => {
    // Your signing logic
    return signature;
  },
});
await client.connect(wallet);
```

## API Reference

### Markets

```typescript
// List trading markets
const markets = await client.getMarkets("TRADING");

// Get single market
const market = await client.getMarket("uuid");

// Get orderbook snapshot
const book = await client.getOrderbook("market-uuid");
```

### Trading (requires authentication)

```typescript
// Place a limit order
const order = await client.placeOrder({
  marketId: "uuid",
  side: "YES",       // "YES" | "NO"
  orderType: "LIMIT", // "LIMIT" | "MARKET"
  priceBps: 55,      // 1-99 (cents)
  quantity: 100,
});

// Cancel an order
await client.cancelOrder("order-uuid");

// Get your orders
const orders = await client.getOrders({ marketId: "uuid" });

// Get your positions
const positions = await client.getPositions();

// Get your balance
const balance = await client.getBalance();
```

### Real-time Data

```typescript
// Subscribe to orderbook updates
client.subscribeOrderbook("market-uuid");
client.on("orderbookUpdate", (snapshot) => { /* ... */ });
client.on("trade", (trade) => { /* ... */ });

// Unsubscribe
client.unsubscribeOrderbook("market-uuid");
```

### Events

```typescript
client.on("connected", (address) => { /* wallet connected */ });
client.on("disconnected", () => { /* wallet disconnected */ });
client.on("sessionCreated", (session) => { /* new SIWE session */ });
client.on("sessionExpired", () => { /* session expired, re-auth needed */ });
client.on("orderbookUpdate", (snapshot) => { /* orderbook data */ });
client.on("trade", (trade) => { /* new trade */ });
client.on("wsConnected", (marketId) => { /* ws channel open */ });
client.on("wsDisconnected", (marketId) => { /* ws channel closed */ });
client.on("error", (error) => { /* any SDK error */ });
```

### Session Management

```typescript
// Check auth status
client.isAuthenticated; // boolean
client.address;         // string | null
client.session;         // Session | null

// Refresh session (re-signs SIWE message)
await client.refreshSession();

// Disconnect
await client.disconnect();
```

### Low-level Access

```typescript
// Direct API client (no auth guards)
const markets = await client.api.getMarkets();

// Direct WebSocket manager
client.ws.subscribe("market-uuid");
client.ws.on("orderbook", handler);
```

## Error Handling

```typescript
import {
  AuthenticationError,
  SessionExpiredError,
  ApiError,
  WalletError,
  WebSocketError,
} from "@orderly-predict/sdk";

try {
  await client.placeOrder(req);
} catch (err) {
  if (err instanceof SessionExpiredError) {
    await client.refreshSession();
    // retry
  } else if (err instanceof ApiError) {
    console.error(`API Error ${err.statusCode}: ${err.message}`);
  }
}
```

## Constants

```typescript
import {
  PRICE_MIN_BPS,    // 1
  PRICE_MAX_BPS,    // 99
  FEE_TRADE_BPS,    // 50 (0.5%)
  USDC_DECIMALS,    // 6
  ORDER_SIDES,      // ["YES", "NO"]
  ORDER_TYPES,      // ["LIMIT", "MARKET"]
  MARKET_STATUSES,  // ["OPEN", "TRADING", "RESOLVING", "SETTLED"]
} from "@orderly-predict/sdk";
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Type check
npm run typecheck

# Lint
npm run lint

# Test
npm run test
```

## License

MIT
