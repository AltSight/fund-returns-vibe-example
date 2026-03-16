## Fund Returns Web App

App for the AltSight fund returns dashboard and supporting APIs. Enables users to see reported pension data and benchmark against it.

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

# Optional: API key for Perplexity enrichment of fund metadata
PERPLEXITY_API_KEY=your_perplexity_key
```

## API: `GET` `/api/stats`

Returns aggregated dashboard statistics, available quarters, and document metadata.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `as_of_date` | string | `"latest"` | `"latest"` for the most recent quarter per fund, or an exact date string (e.g. `"June 30, 2025"`) |

### Response (shape)

```json
{
  "assetClasses": [{ "asset_class": "Private Equity", "count": 312, "avg_irr": 14.2, "avg_tvpi": 1.45, "total_commitment": 8200000000 }],
  "pensionFunds": [{ "pension_fund": "CalSTRS", "count": 210, "as_of_date": "June 30, 2025" }],
  "documents": [{ "id": 1, "filename": "washington 26.pdf", "pension_fund": "WSIB", "report_date": "December 31, 2024" }],
  "totals": { "total_holdings": 1024, "total_pensions": 5, "total_asset_classes": 6, "avg_irr": 12.5, "avg_tvpi": 1.38 },
  "quarters": [{ "pension_fund": "WSIB", "as_of_date": "June 30, 2025" }, { "pension_fund": "WSIB", "as_of_date": "December 31, 2024" }]
}
```

---

## API: `GET` `/api/holdings`

Returns paginated, sortable, filterable fund holdings.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `as_of_date` | string | `"latest"` | `"latest"` for the most recent quarter per fund, or an exact date string |
| `pension_fund` | string | `"All"` | Filter to a single pension fund |
| `asset_class` | string | `"All"` | Filter to a single asset class |
| `search` | string | | Case-insensitive substring match on `fund_name` |
| `sort_by` | string | `"irr"` | One of: `fund_name`, `irr`, `tvpi`, `dpi`, `commitment`, `contributed`, `distributed`, `market_value`, `vintage_year`, `pension_fund`, `asset_class` |
| `sort_dir` | string | `"desc"` | `"asc"` or `"desc"` |
| `page` | int | `1` | Page number (1-indexed) |
| `limit` | int | `50` | Results per page |
| `min_irr` | float | | Minimum IRR filter |
| `max_irr` | float | | Maximum IRR filter |

### Response (shape)

```json
{
  "data": [{ "id": 1, "fund_name": "Blackstone Capital Partners V", "irr": 18.5, "tvpi": 1.92, "...": "..." }],
  "total": 312,
  "page": 1,
  "limit": 50,
  "totalPages": 7
}
```

---

## API: `POST` `/api/dataLookup`

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
