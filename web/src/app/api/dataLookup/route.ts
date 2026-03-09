import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

type ExchangeRecord = {
  Name: string;
  Code: string;
  Country?: string;
  Currency?: string;
};

type EodCandle = {
  date: string;
  adjusted_close?: number;
  close?: number;
};

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
const EXCHANGE_DATA_PATH = path.resolve(
  process.cwd(),
  "..",
  "data",
  "exchangedata.json"
);

async function loadExchanges(): Promise<ExchangeRecord[]> {
  const raw = await fs.readFile(EXCHANGE_DATA_PATH, "utf8");
  return JSON.parse(raw) as ExchangeRecord[];
}

function normalizeDate(date: string): string {
  return date.slice(0, 10);
}

function isUsExchange(exchange: ExchangeRecord | undefined): boolean {
  if (!exchange) return false;
  return (
    exchange.Code.toUpperCase() === "US" ||
    exchange.Country?.toUpperCase() === "USA" ||
    exchange.Currency?.toUpperCase() === "USD"
  );
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`EODHD request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

async function fetchAdjustedCloseForDate(
  eodSymbol: string,
  date: string,
  eodApiToken: string
): Promise<{ adjustedClose: number; actualDate: string }> {
  const normalizedDate = normalizeDate(date);

  const exactUrl =
    `https://eodhd.com/api/eod/${encodeURIComponent(eodSymbol)}` +
    `?from=${normalizedDate}&to=${normalizedDate}&api_token=${encodeURIComponent(eodApiToken)}&fmt=json`;

  const exactData = await fetchJson<EodCandle[]>(exactUrl);
  const exact = exactData?.[0];
  const exactAdjusted = exact?.adjusted_close ?? exact?.close;
  if (typeof exactAdjusted === "number") {
    return { adjustedClose: exactAdjusted, actualDate: exact.date };
  }

  // If requested date is non-trading day, get the latest available close up to that date.
  const fallbackFrom = new Date(normalizedDate);
  fallbackFrom.setDate(fallbackFrom.getDate() - 14);
  const fromString = fallbackFrom.toISOString().slice(0, 10);

  const windowUrl =
    `https://eodhd.com/api/eod/${encodeURIComponent(eodSymbol)}` +
    `?from=${fromString}&to=${normalizedDate}&api_token=${encodeURIComponent(eodApiToken)}&fmt=json`;

  const windowData = await fetchJson<EodCandle[]>(windowUrl);
  const latest = [...(windowData ?? [])]
    .reverse()
    .find(
      (row) =>
        typeof (row.adjusted_close ?? row.close) === "number" && !!row.date
    );

  if (!latest) {
    throw new Error(`No price data found for ${eodSymbol} on or before ${date}.`);
  }

  return {
    adjustedClose: latest.adjusted_close ?? (latest.close as number),
    actualDate: latest.date,
  };
}

async function fetchFxToUsd(
  quoteCurrency: string,
  date: string,
  eodApiToken: string
): Promise<{ fxRateToUsd: number; actualDate: string }> {
  if (quoteCurrency.toUpperCase() === "USD") {
    return { fxRateToUsd: 1, actualDate: normalizeDate(date) };
  }

  const normalizedDate = normalizeDate(date);
  const pair = `USD${quoteCurrency.toUpperCase()}.FOREX`;
  const fromDate = new Date(normalizedDate);
  fromDate.setDate(fromDate.getDate() - 7);
  const from = fromDate.toISOString().slice(0, 10);

  const url =
    `https://eodhd.com/api/eod/${pair}` +
    `?from=${from}&to=${normalizedDate}&api_token=${encodeURIComponent(eodApiToken)}&fmt=json`;

  const fxData = await fetchJson<EodCandle[]>(url);
  const latest = [...(fxData ?? [])]
    .reverse()
    .find((row) => typeof (row.adjusted_close ?? row.close) === "number");

  if (!latest) {
    throw new Error(`No FX data found for USD/${quoteCurrency}.`);
  }

  return {
    fxRateToUsd: latest.adjusted_close ?? (latest.close as number),
    actualDate: latest.date,
  };
}

async function fetchSharesOutstanding(
  eodSymbol: string,
  eodApiToken: string
): Promise<number> {
  const url =
    `https://eodhd.com/api/fundamentals/${encodeURIComponent(eodSymbol)}` +
    `?api_token=${encodeURIComponent(eodApiToken)}&fmt=json&filter=SharesStats`;

  const sharesStats = await fetchJson<Record<string, unknown>>(url);
  const shares = Number(sharesStats?.SharesOutstanding);
  if (!Number.isFinite(shares) || shares <= 0) {
    throw new Error(`Missing SharesOutstanding for ${eodSymbol}.`);
  }
  return shares;
}

type LookupParams = {
  ticker?: string;
  exchange?: string;
  quarterEndDate?: string;
  currentDate?: string;
  eodApiToken?: string;
};

async function runLookup(params: LookupParams) {
  const ticker = (params.ticker ?? "").trim().toUpperCase();
  const exchangeCode = (params.exchange ?? "").trim().toUpperCase();
  const quarterEndDate = (params.quarterEndDate ?? "").trim();
  const currentDate = (params.currentDate ?? "").trim();
  const eodApiToken = ( process.env.EXCHANGE_API_TOKEN ?? "").trim();

  if (!ticker || !exchangeCode || !quarterEndDate || !currentDate) {
    return NextResponse.json(
      {
        error:
          "Missing required params: ticker, exchange, quarterEndDate, currentDate.",
      },
      { status: 400 }
    );
  }

  if (!eodApiToken) {
    return NextResponse.json(
      { error: "Missing exchange API token. Backend Process." },
      { status: 400 }
    );
  }

  const exchanges = await loadExchanges();
  const exchange = exchanges.find((ex) => ex.Code.toUpperCase() === exchangeCode);

  if (!exchange) {
    return NextResponse.json(
      { error: `Unknown exchange code: ${exchangeCode}` },
      { status: 400 }
    );
  }

  const eodSymbol = `${ticker}.${exchangeCode}`;
  const quoteCurrency = (exchange.Currency ?? "USD").toUpperCase();
  const usExchange = isUsExchange(exchange);

  const quarterPrice = await fetchAdjustedCloseForDate(
    eodSymbol,
    quarterEndDate,
    eodApiToken
  );
  const currentPrice = await fetchAdjustedCloseForDate(
    eodSymbol,
    currentDate,
    eodApiToken
  );
  const sharesOutstanding = await fetchSharesOutstanding(eodSymbol, eodApiToken);

  const fxQuarter = usExchange
    ? { fxRateToUsd: 1, actualDate: quarterPrice.actualDate }
    : await fetchFxToUsd(quoteCurrency, quarterPrice.actualDate, eodApiToken);

  const fxCurrent = usExchange
    ? { fxRateToUsd: 1, actualDate: currentPrice.actualDate }
    : await fetchFxToUsd(quoteCurrency, currentPrice.actualDate, eodApiToken);

  const quarterAdjustedCloseUsd = quarterPrice.adjustedClose / fxQuarter.fxRateToUsd;
  const currentAdjustedCloseUsd = currentPrice.adjustedClose / fxCurrent.fxRateToUsd;
  const marketCapUsd =
    (currentPrice.adjustedClose * sharesOutstanding) / fxCurrent.fxRateToUsd;

  return NextResponse.json({
    ticker,
    exchange: exchangeCode,
    eodSymbol,
    exchangeName: exchange.Name,
    quarterEndDateRequested: normalizeDate(quarterEndDate),
    quarterEndDateUsed: quarterPrice.actualDate,
    currentDateRequested: normalizeDate(currentDate),
    currentDateUsed: currentPrice.actualDate,
    quoteCurrency,
    fxApplied: !usExchange,
    quarterEnd: {
      adjustedCloseLocal: quarterPrice.adjustedClose,
      adjustedCloseUsd: quarterAdjustedCloseUsd,
      fxRateToUsd: fxQuarter.fxRateToUsd,
    },
    current: {
      adjustedCloseLocal: currentPrice.adjustedClose,
      adjustedCloseUsd: currentAdjustedCloseUsd,
      fxRateToUsd: fxCurrent.fxRateToUsd,
      sharesOutstanding,
      marketCapUsd,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      apikey?: string;
      ticker?: string;
      exchange?: string;
      quarterEndDate?: string;
      currentDate?: string;
    };

    if (body.apikey !== INTERNAL_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return await runLookup(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch exchange data", details: message },
      { status: 500 }
    );
  }
}
