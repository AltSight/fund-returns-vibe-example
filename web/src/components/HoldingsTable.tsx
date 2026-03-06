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
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
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

function irrBadge(irr: number | null): { bg: string; text: string } {
  if (irr === null) return { bg: "transparent", text: "#9CA3AF" };
  if (irr >= 20) return { bg: "var(--accent-light)", text: "var(--accent-dark)" };
  if (irr >= 10) return { bg: "#ECFDF5", text: "#065F46" };
  if (irr >= 0) return { bg: "transparent", text: "#374151" };
  return { bg: "#FEF2F2", text: "#DC2626" };
}

const COLUMNS = [
  { key: "fund_name", label: "Fund Name", sortable: true },
  { key: "irr", label: "IRR", sortable: true },
  { key: "tvpi", label: "TVPI", sortable: true },
  { key: "dpi", label: "DPI", sortable: true },
  { key: "pension_fund", label: "Pension", sortable: true },
  { key: "asset_class", label: "Asset Class", sortable: true },
  { key: "vintage_year", label: "Vintage", sortable: true },
  { key: "commitment", label: "Commitment", sortable: true },
  { key: "contributed", label: "Contributed", sortable: true },
  { key: "distributed", label: "Distributed", sortable: true },
  { key: "market_value", label: "Market Value", sortable: true },
];

export default function HoldingsTable({
  holdings,
  sortBy,
  sortDir,
  onSort,
}: HoldingsTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200/80 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="border-b-2 border-gray-300">
          <tr style={{ background: "var(--header-bg)" }}>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => col.sortable && onSort(col.key)}
                className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap
                  ${col.sortable ? "cursor-pointer select-none" : ""}`}
                style={{ color: "#1F2937" }}
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {sortBy === col.key && (
                    <span style={{ color: "var(--accent)" }}>
                      {sortDir === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {holdings.map((h) => {
            const irr = irrBadge(h.irr);
            return (
              <tr
                key={h.id}
                className="transition-colors"
                style={{ cursor: "default" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--accent-light)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">
                  {h.fund_name}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  <span
                    className="inline-block px-2 py-0.5 rounded text-sm font-semibold"
                    style={{ background: irr.bg, color: irr.text }}
                  >
                    {formatPercent(h.irr)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 text-right font-mono">
                  {formatMultiple(h.tvpi)}
                </td>
                <td className="px-4 py-3 text-gray-600 text-right font-mono">
                  {formatMultiple(h.dpi)}
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                  {h.pension_fund === "Washington State Investment Board"
                    ? "WSIB"
                    : h.pension_fund}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: "var(--accent-light)", color: "var(--accent-dark)" }}
                  >
                    {h.asset_class || "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-center">
                  {h.vintage_year || "—"}
                </td>
                <td className="px-4 py-3 text-gray-600 text-right font-mono">
                  {formatCurrency(h.commitment)}
                </td>
                <td className="px-4 py-3 text-gray-600 text-right font-mono">
                  {formatCurrency(h.contributed)}
                </td>
                <td className="px-4 py-3 text-gray-600 text-right font-mono">
                  {formatCurrency(h.distributed)}
                </td>
                <td className="px-4 py-3 text-gray-600 text-right font-mono">
                  {formatCurrency(h.market_value)}
                </td>
              </tr>
            );
          })}
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
