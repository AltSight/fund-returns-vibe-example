"use client";

export default function Benchmarking() {
  return (
    <div className="bg-white border border-gray-200/80 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-800">Benchmarking</h3>
        <span
          className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{ background: "var(--accent-light)", color: "var(--accent-dark)" }}
        >
          Coming Soon
        </span>
      </div>

      <div className="space-y-4 opacity-40 pointer-events-none select-none">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">vs. S&amp;P 500</span>
            <span className="font-mono text-gray-400">— %</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="h-2 rounded-full bg-gray-200" style={{ width: "65%" }} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">vs. Russell 2000</span>
            <span className="font-mono text-gray-400">— %</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="h-2 rounded-full bg-gray-200" style={{ width: "50%" }} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">vs. Cambridge PE Index</span>
            <span className="font-mono text-gray-400">— %</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="h-2 rounded-full bg-gray-200" style={{ width: "40%" }} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">vs. Burgiss PE Median</span>
            <span className="font-mono text-gray-400">— %</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="h-2 rounded-full bg-gray-200" style={{ width: "55%" }} />
          </div>
        </div>
      </div>

      <p className="text-[11px] text-gray-400 mt-4 text-center leading-relaxed">
        Compare fund performance against public market and private market benchmarks.
      </p>
    </div>
  );
}
