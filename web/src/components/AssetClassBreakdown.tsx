"use client";

interface AssetClassRow {
  asset_class: string;
  count: number;
  avg_irr: number | null;
  avg_tvpi: number | null;
  total_commitment: number | null;
}

interface Props {
  data: AssetClassRow[];
  onSelect: (ac: string) => void;
}

function formatCurrency(n: number | null): string {
  if (n === null) return "—";
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

export default function AssetClassBreakdown({ data, onSelect }: Props) {
  const sortedData = [...data].sort(
    (a, b) => (b.total_commitment ?? 0) - (a.total_commitment ?? 0)
  );
  const totalCommitment = sortedData.reduce(
    (sum, row) => sum + (row.total_commitment ?? 0),
    0
  );

  return (
    <div className="bg-white border border-gray-200/80 rounded-xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">
        Holdings by Asset Class
      </h3>
      <div className="space-y-3">
        {sortedData.map((row) => (
          <button
            key={row.asset_class}
            onClick={() => onSelect(row.asset_class)}
            className="w-full text-left group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700 group-hover:text-[var(--accent-dark)] transition-colors">
                {row.asset_class}
              </span>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>{row.count} funds</span>
                <span>
                  IRR:{" "}
                  <span
                    className={
                      row.avg_irr && row.avg_irr >= 10
                        ? "font-medium"
                        : "text-gray-500"
                    }
                    style={
                      row.avg_irr && row.avg_irr >= 10
                        ? { color: "var(--accent-dark)" }
                        : undefined
                    }
                  >
                    {row.avg_irr ? `${row.avg_irr.toFixed(1)}%` : "—"}
                  </span>
                </span>
                <span>{formatCurrency(row.total_commitment)}</span>
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width:
                    totalCommitment > 0
                      ? `${((row.total_commitment ?? 0) / totalCommitment) * 100}%`
                      : "0%",
                  background: "var(--accent)",
                }}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
