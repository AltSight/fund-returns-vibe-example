"use client";

import { useEffect, useState, useCallback } from "react";
import StatsCards from "@/components/StatsCards";
import Filters from "@/components/Filters";
import HoldingsTable from "@/components/HoldingsTable";
import Pagination from "@/components/Pagination";
import AssetClassBreakdown from "@/components/AssetClassBreakdown";
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Alternative Assets Returns
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Pension fund PE, VC, and alternative investment performance from
                public pension disclosures.
              </p>
            </div>
            {stats && (
              <div className="hidden md:flex items-center gap-4 text-xs text-gray-400">
                {stats.documents.map((doc) => (
                  <span key={doc.id}>
                    {doc.pension_fund} ({doc.report_date})
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {stats && <StatsCards totals={stats.totals} />}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            {stats && (
              <AssetClassBreakdown
                data={stats.assetClasses}
                onSelect={handleAssetClassSelect}
              />
            )}
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
