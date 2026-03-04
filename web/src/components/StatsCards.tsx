"use client";

interface StatsCardsProps {
  totals: {
    total_holdings: number;
    total_pensions: number;
    total_asset_classes: number;
    avg_irr: number | null;
    avg_tvpi: number | null;
  };
}

function formatNumber(n: number | null, decimals = 2): string {
  if (n === null || n === undefined) return "—";
  return n.toFixed(decimals);
}

export default function StatsCards({ totals }: StatsCardsProps) {
  const cards = [
    {
      label: "Total Holdings",
      value: totals.total_holdings.toLocaleString(),
      color: "bg-blue-50 border-blue-200",
    },
    {
      label: "Pension Funds",
      value: totals.total_pensions.toString(),
      color: "bg-emerald-50 border-emerald-200",
    },
    {
      label: "Asset Classes",
      value: totals.total_asset_classes.toString(),
      color: "bg-purple-50 border-purple-200",
    },
    {
      label: "Avg IRR",
      value: `${formatNumber(totals.avg_irr)}%`,
      color: "bg-amber-50 border-amber-200",
    },
    {
      label: "Avg TVPI",
      value: `${formatNumber(totals.avg_tvpi)}x`,
      color: "bg-rose-50 border-rose-200",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`${card.color} border rounded-xl p-4`}
        >
          <p className="text-sm text-gray-500 font-medium">{card.label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
