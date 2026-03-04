"use client";

import { FundHolding } from "@/lib/db";

interface HoldingsTableProps {
  holdings: FundHolding[];
  sortBy: string;
  sortDir: string;
  onSort: (column: string) => void;
}

function formatCurrency(n: number | null): string {
  if (n === null || n === undefined) return "—";
  if (Math.abs(n) >= 1e9)
    return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6)
    return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3)
    return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatPercent(n: number | null): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(2)}%`;
}

function formatMultiple(n: number | null): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(2)}x`;
}

function irrColor(irr: number | null): string {
  if (irr === null) return "";
  if (irr >= 20) return "text-emerald-700 bg-emerald-50";
  if (irr >= 10) return "text-green-700 bg-green-50";
  if (irr >= 0) return "text-gray-700";
  return "text-red-600 bg-red-50";
}

const COLUMNS = [
  { key: "fund_name", label: "Fund Name", sortable: true },
  { key: "pension_fund", label: "Pension", sortable: true },
  { key: "asset_class", label: "Asset Class", sortable: true },
  { key: "vintage_year", label: "Vintage", sortable: true },
  { key: "commitment", label: "Commitment", sortable: true },
  { key: "contributed", label: "Contributed", sortable: true },
  { key: "distributed", label: "Distributed", sortable: true },
  { key: "market_value", label: "Market Value", sortable: true },
  { key: "irr", label: "IRR", sortable: true },
  { key: "tvpi", label: "TVPI", sortable: true },
  { key: "dpi", label: "DPI", sortable: true },
];

export default function HoldingsTable({
  holdings,
  sortBy,
  sortDir,
  onSort,
}: HoldingsTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => col.sortable && onSort(col.key)}
                className={`px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap
                  ${col.sortable ? "cursor-pointer hover:text-gray-900 select-none" : ""}`}
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {sortBy === col.key && (
                    <span className="text-blue-500">
                      {sortDir === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {holdings.map((h) => (
            <tr
              key={h.id}
              className="hover:bg-blue-50/40 transition-colors"
            >
              <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">
                {h.fund_name}
              </td>
              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                {h.pension_fund === "Washington State Investment Board"
                  ? "WSIB"
                  : h.pension_fund}
              </td>
              <td className="px-4 py-3">
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                  {h.asset_class || "—"}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-600 text-center">
                {h.vintage_year || "—"}
              </td>
              <td className="px-4 py-3 text-gray-700 text-right font-mono">
                {formatCurrency(h.commitment)}
              </td>
              <td className="px-4 py-3 text-gray-700 text-right font-mono">
                {formatCurrency(h.contributed)}
              </td>
              <td className="px-4 py-3 text-gray-700 text-right font-mono">
                {formatCurrency(h.distributed)}
              </td>
              <td className="px-4 py-3 text-gray-700 text-right font-mono">
                {formatCurrency(h.market_value)}
              </td>
              <td className="px-4 py-3 text-right font-mono">
                <span
                  className={`inline-block px-2 py-0.5 rounded ${irrColor(h.irr)}`}
                >
                  {formatPercent(h.irr)}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-700 text-right font-mono">
                {formatMultiple(h.tvpi)}
              </td>
              <td className="px-4 py-3 text-gray-700 text-right font-mono">
                {formatMultiple(h.dpi)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {holdings.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          No holdings found matching your filters.
        </div>
      )}
    </div>
  );
}
