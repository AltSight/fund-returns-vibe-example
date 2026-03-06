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
    { label: "Total Holdings", value: totals.total_holdings.toLocaleString() },
    { label: "Pension Funds", value: totals.total_pensions.toString() },
    { label: "Asset Classes", value: totals.total_asset_classes.toString() },
    { label: "Avg IRR", value: `${formatNumber(totals.avg_irr)}%` },
    { label: "Avg TVPI", value: `${formatNumber(totals.avg_tvpi)}x` },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white border border-gray-200/80 rounded-xl p-4 shadow-sm"
        >
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            {card.label}
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-1.5">{card.value}</p>
          <div className="mt-2 h-0.5 w-8 rounded-full" style={{ background: "var(--accent)" }} />
        </div>
      ))}
    </div>
  );
}
