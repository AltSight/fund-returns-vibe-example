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
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white
                     focus:outline-none focus:ring-2 focus:border-transparent"
          style={ringStyle}
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
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white
                     focus:outline-none focus:ring-2 focus:border-transparent"
          style={ringStyle}
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
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white
                       focus:outline-none focus:ring-2 focus:border-transparent"
            style={ringStyle}
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
