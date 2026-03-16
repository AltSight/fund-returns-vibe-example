"use client";

interface FiltersProps {
  assetClasses: string[];
  pensionFunds: string[];
  quarters: string[];
  selectedAssetClass: string;
  selectedPensionFund: string;
  selectedQuarter: string;
  searchQuery: string;
  onAssetClassChange: (val: string) => void;
  onPensionFundChange: (val: string) => void;
  onQuarterChange: (val: string) => void;
  onSearchChange: (val: string) => void;
}

export default function Filters({
  assetClasses,
  pensionFunds,
  quarters,
  selectedAssetClass,
  selectedPensionFund,
  selectedQuarter,
  searchQuery,
  onAssetClassChange,
  onPensionFundChange,
  onQuarterChange,
  onSearchChange,
}: FiltersProps) {
  const ringStyle = {
    "--tw-ring-color": "var(--accent)",
  } as React.CSSProperties;
  const selectStyle = {
    ...ringStyle,
    backgroundImage:
      'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 20 20%27 fill=%27%236B7280%27%3E%3Cpath fill-rule=%27evenodd%27 d=%27M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z%27 clip-rule=%27evenodd%27/%3E%3C/svg%3E")',
    backgroundRepeat: "no-repeat",
    backgroundSize: "16px 16px",
    backgroundPosition: "right 0.85rem top 56%",
  } as React.CSSProperties;

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="flex-1">
        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
          Search Fund
        </label>
        <input
          type="text"
          placeholder="e.g. Blackstone, KKR, Sequoia..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white
                     focus:outline-none focus:ring-2 focus:border-transparent
                     placeholder:text-gray-300"
          style={ringStyle}
        />
      </div>
      <div className="w-full sm:w-48">
        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
          Asset Class
        </label>
        <select
          value={selectedAssetClass}
          onChange={(e) => onAssetClassChange(e.target.value)}
          className="w-full appearance-none pl-3 pr-11 py-2 border border-gray-200 rounded-lg text-sm bg-white
                     focus:outline-none focus:ring-2 focus:border-transparent"
          style={selectStyle}
        >
          <option value="All">All Asset Classes</option>
          {assetClasses.map((ac) => (
            <option key={ac} value={ac}>
              {ac}
            </option>
          ))}
        </select>
      </div>
      <div className="w-full sm:w-56">
        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
          Pension Fund
        </label>
        <select
          value={selectedPensionFund}
          onChange={(e) => onPensionFundChange(e.target.value)}
          className="w-full appearance-none pl-3 pr-11 py-2 border border-gray-200 rounded-lg text-sm bg-white
                     focus:outline-none focus:ring-2 focus:border-transparent"
          style={selectStyle}
        >
          <option value="All">All Pension Funds</option>
          {pensionFunds.map((pf) => (
            <option key={pf} value={pf}>
              {pf}
            </option>
          ))}
        </select>
      </div>
      {quarters.length > 1 && (
        <div className="w-full sm:w-48">
          <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
            Quarter
          </label>
          <select
            value={selectedQuarter}
            onChange={(e) => onQuarterChange(e.target.value)}
            className="w-full appearance-none pl-3 pr-11 py-2 border border-gray-200 rounded-lg text-sm bg-white
                       focus:outline-none focus:ring-2 focus:border-transparent"
            style={selectStyle}
          >
            <option value="latest">Latest</option>
            {quarters.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
