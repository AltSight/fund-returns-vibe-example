import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { getSupabase } from "@/lib/db";

const ALLOWED_SORT_FIELDS = [
  "fund_name",
  "irr",
  "tvpi",
  "dpi",
  "commitment",
  "contributed",
  "distributed",
  "market_value",
  "vintage_year",
  "pension_fund",
  "asset_class",
] as const;

type SortField = (typeof ALLOWED_SORT_FIELDS)[number];

function formatCurrency(val: number | null): string {
  if (val == null) return "N/A";
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  if (Math.abs(val) >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
}

function formatPct(val: number | null): string {
  if (val == null) return "N/A";
  return `${val.toFixed(2)}%`;
}

function formatHolding(h: Record<string, unknown>): string {
  return [
    `**${h.fund_name}**`,
    `  Pension Fund: ${h.pension_fund ?? "N/A"}`,
    `  Asset Class: ${h.asset_class ?? "N/A"}`,
    `  Vintage Year: ${h.vintage_year ?? "N/A"}`,
    `  IRR: ${formatPct(h.irr as number | null)}`,
    `  TVPI: ${h.tvpi != null ? (h.tvpi as number).toFixed(2) + "x" : "N/A"}`,
    `  DPI: ${h.dpi != null ? (h.dpi as number).toFixed(2) + "x" : "N/A"}`,
    `  Commitment: ${formatCurrency(h.commitment as number | null)}`,
    `  Contributed: ${formatCurrency(h.contributed as number | null)}`,
    `  Distributed: ${formatCurrency(h.distributed as number | null)}`,
    `  Market Value: ${formatCurrency(h.market_value as number | null)}`,
  ].join("\n");
}

const handler = createMcpHandler(
  (server) => {
    // ── search_holdings ──────────────────────────────────────────────
    server.tool(
      "search_holdings",
      "Search and filter alternative asset fund holdings from pension fund reports. " +
        "Returns fund-level performance data including IRR, TVPI, DPI, commitments, and distributions. " +
        "Supports filtering by asset class, pension fund, fund name, and IRR range.",
      {
        search: z
          .string()
          .optional()
          .describe("Search fund names (partial match)"),
        asset_class: z
          .string()
          .optional()
          .describe(
            "Filter by asset class, e.g. 'Private Equity', 'Venture Capital', 'Real Estate', 'Growth Equity'"
          ),
        pension_fund: z
          .string()
          .optional()
          .describe("Filter by pension fund name, e.g. 'CalPERS', 'CalSTRS'"),
        min_irr: z
          .number()
          .optional()
          .describe("Minimum IRR filter (percentage)"),
        max_irr: z
          .number()
          .optional()
          .describe("Maximum IRR filter (percentage)"),
        sort_by: z
          .enum(ALLOWED_SORT_FIELDS)
          .optional()
          .default("irr")
          .describe("Field to sort results by"),
        sort_dir: z
          .enum(["asc", "desc"])
          .optional()
          .default("desc")
          .describe("Sort direction"),
        page: z
          .number()
          .int()
          .positive()
          .optional()
          .default(1)
          .describe("Page number (1-based)"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .default(25)
          .describe("Results per page (max 100)"),
      },
      async (params) => {
        const supabase = getSupabase();
        const {
          search,
          asset_class,
          pension_fund,
          min_irr,
          max_irr,
          sort_by = "irr" as SortField,
          sort_dir = "desc",
          page = 1,
          limit = 25,
        } = params;

        const offset = (page - 1) * limit;

        let query = supabase
          .from("fund_holdings")
          .select("*", { count: "exact" });

        if (asset_class) query = query.eq("asset_class", asset_class);
        if (pension_fund) query = query.eq("pension_fund", pension_fund);
        if (search) query = query.ilike("fund_name", `%${search}%`);
        if (min_irr != null) query = query.gte("irr", min_irr);
        if (max_irr != null) query = query.lte("irr", max_irr);

        query = query
          .order(sort_by, {
            ascending: sort_dir === "asc",
            nullsFirst: false,
          })
          .range(offset, offset + limit - 1);

        const { data, count, error } = await query;

        if (error) {
          return {
            content: [
              { type: "text" as const, text: `Error: ${error.message}` },
            ],
            isError: true,
          };
        }

        const total = count ?? 0;
        const totalPages = Math.ceil(total / limit);

        if (!data || data.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No holdings found matching those filters.",
              },
            ],
          };
        }

        const header = `Found ${total} holdings (showing page ${page} of ${totalPages}):\n`;
        const holdings = data.map(formatHolding).join("\n\n");

        return {
          content: [
            { type: "text" as const, text: header + "\n" + holdings },
          ],
        };
      }
    );

    // ── get_stats ────────────────────────────────────────────────────
    server.tool(
      "get_stats",
      "Get aggregate statistics about the fund holdings dataset: " +
        "breakdowns by asset class and pension fund, total counts, and average performance metrics.",
      {},
      async () => {
        const supabase = getSupabase();

        const [assetClassRes, pensionFundRes, totalsRes, documentsRes] =
          await Promise.all([
            supabase.rpc("get_asset_class_stats"),
            supabase.rpc("get_pension_fund_stats"),
            supabase.rpc("get_totals"),
            supabase
              .from("documents")
              .select("*")
              .order("processed_at", { ascending: false }),
          ]);

        const errors = [assetClassRes, pensionFundRes, totalsRes, documentsRes]
          .filter((r) => r.error)
          .map((r) => r.error!.message);

        if (errors.length) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Errors fetching stats: ${errors.join("; ")}`,
              },
            ],
            isError: true,
          };
        }

        const totals = totalsRes.data?.[0] ?? {
          total_holdings: 0,
          total_pensions: 0,
          total_asset_classes: 0,
          avg_irr: null,
          avg_tvpi: null,
        };

        const sections: string[] = [];

        sections.push(
          "## Dataset Overview",
          `- Total Holdings: ${totals.total_holdings}`,
          `- Pension Funds: ${totals.total_pensions}`,
          `- Asset Classes: ${totals.total_asset_classes}`,
          `- Average IRR: ${formatPct(totals.avg_irr)}`,
          `- Average TVPI: ${totals.avg_tvpi != null ? totals.avg_tvpi.toFixed(2) + "x" : "N/A"}`
        );

        if (assetClassRes.data?.length) {
          sections.push(
            "",
            "## By Asset Class",
            ...assetClassRes.data.map(
              (r: Record<string, unknown>) =>
                `- **${r.asset_class}**: ${r.count} holdings, avg IRR ${formatPct(r.avg_irr as number | null)}`
            )
          );
        }

        if (pensionFundRes.data?.length) {
          sections.push(
            "",
            "## By Pension Fund",
            ...pensionFundRes.data.map(
              (r: Record<string, unknown>) =>
                `- **${r.pension_fund}**: ${r.count} holdings`
            )
          );
        }

        if (documentsRes.data?.length) {
          sections.push(
            "",
            "## Processed Documents",
            ...documentsRes.data.map(
              (d: Record<string, unknown>) =>
                `- ${d.filename} (${d.pension_fund}, ${d.report_date})`
            )
          );
        }

        return {
          content: [{ type: "text" as const, text: sections.join("\n") }],
        };
      }
    );

    // ── get_top_performers ───────────────────────────────────────────
    server.tool(
      "get_top_performers",
      "Get the top-performing funds by IRR, TVPI, or DPI. " +
        "Optionally filter by asset class or pension fund.",
      {
        metric: z
          .enum(["irr", "tvpi", "dpi"])
          .default("irr")
          .describe("Performance metric to rank by"),
        asset_class: z.string().optional().describe("Filter by asset class"),
        pension_fund: z
          .string()
          .optional()
          .describe("Filter by pension fund"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .default(10)
          .describe("Number of top results to return"),
      },
      async ({ metric = "irr", asset_class, pension_fund, limit = 10 }) => {
        const supabase = getSupabase();

        let query = supabase
          .from("fund_holdings")
          .select("*")
          .not(metric, "is", null)
          .order(metric, { ascending: false, nullsFirst: false })
          .limit(limit);

        if (asset_class) query = query.eq("asset_class", asset_class);
        if (pension_fund) query = query.eq("pension_fund", pension_fund);

        const { data, error } = await query;

        if (error) {
          return {
            content: [
              { type: "text" as const, text: `Error: ${error.message}` },
            ],
            isError: true,
          };
        }

        if (!data?.length) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No holdings found matching those filters.",
              },
            ],
          };
        }

        const metricLabel = metric.toUpperCase();
        const header = `Top ${data.length} funds by ${metricLabel}:\n`;
        const rows = data
          .map((h, i) => {
            const val =
              metric === "irr"
                ? formatPct(h[metric])
                : h[metric] != null
                  ? `${(h[metric] as number).toFixed(2)}x`
                  : "N/A";
            return `${i + 1}. **${h.fund_name}** — ${metricLabel}: ${val} | Pension: ${h.pension_fund ?? "N/A"} | Asset Class: ${h.asset_class ?? "N/A"} | Vintage: ${h.vintage_year ?? "N/A"}`;
          })
          .join("\n");

        return {
          content: [{ type: "text" as const, text: header + rows }],
        };
      }
    );
  },
  {},
  {
    basePath: "/api/mcp",
  }
);

export { handler as GET, handler as POST, handler as DELETE };
