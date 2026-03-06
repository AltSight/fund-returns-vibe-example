"use client";

interface FiltersProps {
  assetClasses: string[];
  pensionFunds: string[];
  selectedAssetClass: string;
  selectedPensionFund: string;
  searchQuery: string;
  onAssetClassChange: (val: string) => void;
  onPensionFundChange: (val: string) => void;
  onSearchChange: (val: string) => void;
}

export default function Filters({
  assetClasses,
  pensionFunds,
  selectedAssetClass,
  selectedPensionFund,
  searchQuery,
  onAssetClassChange,
  onPensionFundChange,
  onSearchChange,
}: FiltersProps) {
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
          style={
            {
              "--tw-ring-color": "var(--accent)",
            } as React.CSSProperties
          }
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
          style={
            {
              "--tw-ring-color": "var(--accent)",
            } as React.CSSProperties
          }
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
          style={
            {
              "--tw-ring-color": "var(--accent)",
            } as React.CSSProperties
          }
        >
          <option value="All">All Pension Funds</option>
          {pensionFunds.map((pf) => (
            <option key={pf} value={pf}>
              {pf}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
