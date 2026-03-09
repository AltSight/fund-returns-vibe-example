## Fund Returns Web App

Next.js app for the AltSight fund returns dashboard and supporting APIs.

## Getting Started

Run the development server from `web`:

```bash
yarn dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Configure these in `web/.env`:

```env
# Internal key required by /api/dataLookup requests
INTERNAL_API_KEY=your_internal_key

# API token used for price/fundamental/FX calls
EXCHANGE_API_TOKEN=your_eodhd_token

# Optional: API key for exchange code matching endpoint
OPENAI_API_KEY=your_openai_key
```

## API: `POST` / `GET` `/api/dataLookup`

Fetches quarter-end and current adjusted close prices, plus current market cap in USD.

- **Required params:** `apikey`, `ticker`, `exchange`, `quarterEndDate`, `currentDate`
- **Auth check:** `apikey` must equal `INTERNAL_API_KEY`

### Request (POST)

```json
{
  "apikey": "your_internal_key",
  "ticker": "7203",
  "exchange": "TSE",
  "quarterEndDate": "2024-03-31",
  "currentDate": "2024-06-30"
}
```

### Response (example)

```json
{
  "ticker": "7203",
  "exchange": "TSE",
  "eodSymbol": "7203.TSE",
  "exchangeName": "Tokyo Stock Exchange",
  "quarterEndDateRequested": "2024-03-31",
  "quarterEndDateUsed": "2024-03-29",
  "currentDateRequested": "2024-06-30",
  "currentDateUsed": "2024-06-28",
  "quoteCurrency": "JPY",
  "fxApplied": true,
  "quarterEnd": {
    "adjustedCloseLocal": 3576,
    "adjustedCloseUsd": 23.62,
    "fxRateToUsd": 151.35
  },
  "current": {
    "adjustedCloseLocal": 3850,
    "adjustedCloseUsd": 24.88,
    "fxRateToUsd": 154.73,
    "sharesOutstanding": 1628600000,
    "marketCapUsd": 40520000000
  }
}
```

### Behavior Notes

- **Adjusted close:** Uses `adjusted_close` from EODHD, falling back to `close` if missing.
- **Non-trading day fallback:** If the exact date has no bar, it uses the latest prior trading day in a lookback window.
- **US exchanges:** If exchange is U.S. (from `data/exchangedata.json`), no FX conversion is applied (`fxRateToUsd = 1`).
- **Market cap (USD):** `(current adjusted close local * shares outstanding) / fxRateToUsd`.
