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

const BAR_COLORS: Record<string, string> = {
  "Private Equity": "bg-blue-500",
  "Venture Capital": "bg-purple-500",
  "Growth Equity": "bg-emerald-500",
  "Private Credit": "bg-amber-500",
  "Real Estate": "bg-rose-500",
  "Co-Investment": "bg-cyan-500",
  "Natural Resources": "bg-orange-500",
  "Infrastructure": "bg-teal-500",
  "Fund of Funds": "bg-indigo-500",
  Secondary: "bg-pink-500",
};

export default function AssetClassBreakdown({ data, onSelect }: Props) {
  const maxCount = Math.max(...data.map((d) => d.count));

  return (
    <div className="border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        Holdings by Asset Class
      </h3>
      <div className="space-y-3">
        {data.map((row) => (
          <button
            key={row.asset_class}
            onClick={() => onSelect(row.asset_class)}
            className="w-full text-left group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">
                {row.asset_class}
              </span>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>{row.count} funds</span>
                <span>
                  Avg IRR:{" "}
                  <span
                    className={
                      row.avg_irr && row.avg_irr >= 10
                        ? "text-emerald-600 font-medium"
                        : "text-gray-600"
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
                className={`h-2 rounded-full transition-all ${BAR_COLORS[row.asset_class] || "bg-gray-400"}`}
                style={{ width: `${(row.count / maxCount) * 100}%` }}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
