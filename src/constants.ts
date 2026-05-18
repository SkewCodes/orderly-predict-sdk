export const PRICE_MIN_BPS = 1;
export const PRICE_MAX_BPS = 99;
export const PRICE_COMPLEMENT_BPS = 100;

export const USDC_DECIMALS = 6;
export const USDC_UNIT = 10 ** USDC_DECIMALS;

export const FEE_MINT_BPS = 0;
export const FEE_TRADE_BPS = 50;
export const FEE_SETTLE_BPS = 100;
export const FEE_BROKER_SHARE_BPS = 6000;
export const FEE_PROTOCOL_SHARE_BPS = 4000;
export const FEE_BASE_BPS = 10_000;

export const MARKET_CATEGORIES = ["crypto", "macro", "protocol", "other"] as const;
export const ORDER_SIDES = ["YES", "NO"] as const;
export const ORDER_TYPES = ["LIMIT", "MARKET"] as const;
export const MARKET_STATUSES = ["OPEN", "TRADING", "RESOLVING", "SETTLED"] as const;
export const ORDER_STATUSES = ["OPEN", "PARTIALLY_FILLED", "FILLED", "CANCELLED"] as const;
export const MARKET_OUTCOMES = ["YES", "NO"] as const;
