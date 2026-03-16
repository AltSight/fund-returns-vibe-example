"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Database } from "lucide-react";
import StatsCards from "@/components/StatsCards";
import Filters from "@/components/Filters";
import HoldingsTable from "@/components/HoldingsTable";
import Pagination from "@/components/Pagination";
import AssetClassBreakdown from "@/components/AssetClassBreakdown";
import McpInfoButton from "@/components/McpInfoButton";
import Benchmarking from "@/components/Benchmarking";
import { FundHolding } from "@/lib/db";

interface Quarter {
  pension_fund: string;
  as_of_date: string;
}

interface Stats {
  assetClasses: {
    asset_class: string;
    count: number;
    avg_irr: number | null;
    avg_tvpi: number | null;
    total_commitment: number | null;
  }[];
  pensionFunds: { pension_fund: string; count: number; as_of_date: string }[];
  documents: {
    id: number;
    filename: string;
    pension_fund: string;
    report_date: string;
    document_type: string;
  }[];
  totals: {
    total_holdings: number;
    total_pensions: number;
    total_asset_classes: number;
    avg_irr: number | null;
    avg_tvpi: number | null;
  };
  quarters: Quarter[];
}

interface HoldingsResponse {
  data: FundHolding[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [holdings, setHoldings] = useState<HoldingsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [assetClass, setAssetClass] = useState("All");
  const [pensionFund, setPensionFund] = useState("All");
  const [quarter, setQuarter] = useState("latest");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("irr");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);

  const fetchStats = useCallback(() => {
    const params = new URLSearchParams({ as_of_date: quarter });
    fetch(`/api/stats?${params}`)
      .then((r) => r.json())
      .then(setStats);
  }, [quarter]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const fetchHoldings = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      asset_class: assetClass,
      pension_fund: pensionFund,
      as_of_date: quarter,
      search: searchQuery,
      sort_by: sortBy,
      sort_dir: sortDir,
      page: page.toString(),
      limit: "50",
    });
    fetch(`/api/holdings?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setHoldings(data);
        setLoading(false);
      });
  }, [assetClass, pensionFund, quarter, searchQuery, sortBy, sortDir, page]);

  useEffect(() => {
    fetchHoldings();
  }, [fetchHoldings]);

  useEffect(() => {
    setPage(1);
  }, [assetClass, pensionFund, quarter, searchQuery]);

  // Reset quarter to "latest" when pension fund changes so we don't get
  // stuck on a quarter that doesn't exist for the newly selected fund.
  useEffect(() => {
    setQuarter("latest");
  }, [pensionFund]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDir(column === "fund_name" ? "asc" : "desc");
    }
  };

  const handleAssetClassSelect = (ac: string) => {
    setAssetClass(ac === assetClass ? "All" : ac);
  };

  // Derive the list of quarter options from the stats response, filtered
  // to the selected pension fund when one is chosen.
  const quarterOptions: string[] = [];
  if (stats?.quarters) {
    const relevant =
      pensionFund !== "All"
        ? stats.quarters.filter((q) => q.pension_fund === pensionFund)
        : stats.quarters;

    const unique = [...new Set(relevant.map((q) => q.as_of_date))];

    // Sort chronologically (newest first) by parsing month names.
    unique.sort((a, b) => {
      const da = parseQuarterDate(a);
      const db = parseQuarterDate(b);
      return db.getTime() - da.getTime();
    });

    quarterOptions.push(...unique);
  }

  // Derive one entry per pension fund showing its latest quarter date.
  const latestPerFund: [string, string][] = [];
  if (stats?.quarters) {
    const map = new Map<string, Date>();
    const raw = new Map<string, string>();
    for (const q of stats.quarters) {
      const d = parseQuarterDate(q.as_of_date);
      if (!map.has(q.pension_fund) || d > map.get(q.pension_fund)!) {
        map.set(q.pension_fund, d);
        raw.set(q.pension_fund, q.as_of_date);
      }
    }
    for (const [fund, date] of raw) {
      latestPerFund.push([fund, date]);
    }
    latestPerFund.sort((a, b) => a[0].localeCompare(b[0]));
  }

  return (
    <div className="min-h-screen" style={{ background: "#F7F8FA" }}>
      <header
        className="sticky top-0 z-10 border-b border-gray-200"
        style={{ background: "var(--header-bg)" }}
      >
        <div className="max-w-[1600px] mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link
                href="https://altsight.ai"
                className="flex items-center gap-2"
              >
                <div
                  className="rounded-md p-1"
                  style={{ backgroundColor: "hsl(var(--primary))" }}
                >
                  <Database
                    className="h-5 w-5"
                    style={{ color: "hsl(var(--primary-foreground))" }}
                  />
                </div>
                <span className="text-xl font-bold">AltSight Analytics</span>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              {stats && (
                <div className="hidden lg:flex items-center gap-3 text-[11px] text-slate-400">
                  {latestPerFund.map(([fund, date]) => (
                    <span
                      key={fund}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full inline-block"
                        style={{ background: "var(--accent)" }}
                      />
                      {fund}
                      <span className="text-slate-300">|</span>
                      {date}
                    </span>
                  ))}
                </div>
              )}
              <McpInfoButton />
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            PE, VC &amp; alternative investment performance from public pension
            disclosures
          </p>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {stats && <StatsCards totals={stats.totals} />}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            {stats && (
              <AssetClassBreakdown
                data={stats.assetClasses}
                onSelect={handleAssetClassSelect}
              />
            )}
            <Benchmarking />
          </div>
          <div className="lg:col-span-2 space-y-4">
            {stats && (
              <Filters
                assetClasses={stats.assetClasses.map((a) => a.asset_class)}
                pensionFunds={stats.pensionFunds.map((p) => p.pension_fund)}
                quarters={quarterOptions}
                selectedAssetClass={assetClass}
                selectedPensionFund={pensionFund}
                selectedQuarter={quarter}
                searchQuery={searchQuery}
                onAssetClassChange={setAssetClass}
                onPensionFundChange={setPensionFund}
                onQuarterChange={setQuarter}
                onSearchChange={setSearchQuery}
              />
            )}

            {loading && !holdings ? (
              <div className="text-center py-20 text-gray-400">Loading...</div>
            ) : (
              holdings && (
                <>
                  <HoldingsTable
                    holdings={holdings.data}
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <Pagination
                    page={holdings.page}
                    totalPages={holdings.totalPages}
                    total={holdings.total}
                    limit={holdings.limit}
                    onPageChange={setPage}
                  />
                </>
              )
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function parseQuarterDate(s: string): Date {
  const cleaned = s.replace(",", "");
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d;
  return new Date(0);
}
