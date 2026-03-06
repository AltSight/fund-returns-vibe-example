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
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("irr");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats);
  }, []);

  const fetchHoldings = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      asset_class: assetClass,
      pension_fund: pensionFund,
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
  }, [assetClass, pensionFund, searchQuery, sortBy, sortDir, page]);

  useEffect(() => {
    fetchHoldings();
  }, [fetchHoldings]);

  useEffect(() => {
    setPage(1);
  }, [assetClass, pensionFund, searchQuery]);

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
                  {stats.documents.map((doc) => (
                    <span
                      key={doc.id}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full inline-block"
                        style={{ background: "var(--accent)" }}
                      />
                      {doc.pension_fund}
                      <span className="text-slate-300">|</span>
                      {doc.report_date}
                    </span>
                  ))}
                </div>
              )}
              <McpInfoButton />
            </div>
          </div>
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
                selectedAssetClass={assetClass}
                selectedPensionFund={pensionFund}
                searchQuery={searchQuery}
                onAssetClassChange={setAssetClass}
                onPensionFundChange={setPensionFund}
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
