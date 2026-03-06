"use client";

import { useState, useRef, useEffect } from "react";

const TOOLS = [
  {
    name: "search_holdings",
    desc: "Search & filter fund holdings by name, asset class, pension fund, IRR range",
  },
  {
    name: "get_stats",
    desc: "Aggregate stats — asset class & pension fund breakdowns, averages",
  },
  {
    name: "get_top_performers",
    desc: "Top funds ranked by IRR, TVPI, or DPI",
  },
];

function getConfigSnippet() {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://fund-returns.altsight.ai";

  return `{
  "mcpServers": {
    "fund-returns": {
      "url": "${origin}/api/mcp/mcp"
    }
  }
}`;
}

export default function McpInfoButton() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const configSnippet = getConfigSnippet();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function copyConfig() {
    navigator.clipboard.writeText(configSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
        style={{
          background: open ? "var(--accent)" : "rgba(255,255,255,0.08)",
          color: open ? "#fff" : "var(--header-text)",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8" />
          <path d="M12 17v4" />
          <path d="M7 8l3 3-3 3" />
          <line x1="13" y1="14" x2="17" y2="14" />
        </svg>
        MCP
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[400px] rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50 bg-white">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: "var(--accent)" }}
              />
              <span className="text-sm font-semibold text-gray-900">
                MCP Server
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-mono">
                v1.0.0
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Connect this dataset to Claude or any MCP-compatible assistant.
            </p>
          </div>

          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">
              Available Tools
            </p>
            <div className="space-y-2">
              {TOOLS.map((t) => (
                <div key={t.name} className="flex gap-2">
                  <code className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 whitespace-nowrap self-start">
                    {t.name}
                  </code>
                  <span className="text-[11px] text-gray-500 leading-tight">
                    {t.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                Configuration
              </p>
              <button
                onClick={copyConfig}
                className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-500 hover:text-gray-800 hover:bg-gray-200 transition-colors"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="text-[11px] font-mono leading-relaxed p-3 rounded-lg overflow-x-auto text-gray-700 bg-gray-50 border border-gray-100">
              {configSnippet}
            </pre>
            <p className="text-[10px] text-gray-400 mt-2">
              Add to Claude Desktop config or{" "}
              <code className="text-gray-600">.cursor/mcp.json</code> — no API
              keys needed.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
