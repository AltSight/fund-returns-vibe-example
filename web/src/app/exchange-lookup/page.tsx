"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type ExchangeRecord = {
  Name: string;
  Code: string;
  OperatingMIC?: string;
  Country?: string;
  Currency?: string;
};

type LookupResult = {
  code: string | null;
  name: string | null;
  confidence: "high" | "medium" | "low";
  reason: string;
};

export default function ExchangeLookupPage() {
  const [query, setQuery] = useState("");
  const [exchanges, setExchanges] = useState<ExchangeRecord[]>([]);
  const [loadingExchanges, setLoadingExchanges] = useState(true);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/exchange-lookup")
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to fetch exchanges.");
        return (await r.json()) as { exchanges: ExchangeRecord[] };
      })
      .then((data) => setExchanges(data.exchanges ?? []))
      .catch((e: unknown) => {
        const message =
          e instanceof Error ? e.message : "Failed to load exchanges.";
        setError(message);
      })
      .finally(() => setLoadingExchanges(false));
  }, []);

  const sortedExchanges = useMemo(
    () => [...exchanges].sort((a, b) => a.Name.localeCompare(b.Name)),
    [exchanges]
  );

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setIsLookingUp(true);

    try {
      const res = await fetch("/api/exchange-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const data = (await res.json()) as {
        error?: string;
        result?: LookupResult;
      };

      if (!res.ok) {
        throw new Error(data.error || "Lookup failed.");
      }

      if (!data.result) {
        throw new Error("No lookup result was returned.");
      }

      setResult(data.result);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Lookup failed.";
      setError(message);
    } finally {
      setIsLookingUp(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <main className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-slate-900">
            Exchange Code Lookup
          </h1>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            Back to dashboard
          </Link>
        </div>

        <form
          onSubmit={handleLookup}
          className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
        >
          <label htmlFor="exchange-query" className="block text-sm font-medium">
            Enter an exchange name
          </label>
          <div className="flex gap-2">
            <input
              id="exchange-query"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Frankfurt Exchange"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={isLookingUp || !query.trim()}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {isLookingUp ? "Looking up..." : "Lookup"}
            </button>
          </div>
        </form>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {result && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Most likely exchange code</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {result.code ?? "No strong match"}
            </p>
            <p className="text-sm text-slate-700">
              {result.name ?? "Unknown exchange"}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Confidence: {result.confidence}
            </p>
            <p className="mt-1 text-xs text-slate-500">{result.reason}</p>
          </div>
        )}

        <section className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="text-lg font-medium text-slate-900">
            All Exchanges ({sortedExchanges.length})
          </h2>
          {loadingExchanges ? (
            <p className="mt-3 text-sm text-slate-500">Loading exchanges...</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Code</th>
                    <th className="py-2 pr-3">Country</th>
                    <th className="py-2 pr-3">Currency</th>
                    <th className="py-2 pr-3">MIC</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedExchanges.map((exchange) => (
                    <tr
                      key={`${exchange.Code}-${exchange.Name}`}
                      className="border-b border-slate-100"
                    >
                      <td className="py-2 pr-3">{exchange.Name}</td>
                      <td className="py-2 pr-3 font-medium">{exchange.Code}</td>
                      <td className="py-2 pr-3">{exchange.Country ?? "-"}</td>
                      <td className="py-2 pr-3">{exchange.Currency ?? "-"}</td>
                      <td className="py-2 pr-3">
                        {exchange.OperatingMIC ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
