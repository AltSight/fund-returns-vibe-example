import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/db";

export async function GET(request: NextRequest) {
  const supabase = getSupabase();
  const params = request.nextUrl.searchParams;
  const assetClass = params.get("asset_class");
  const pensionFund = params.get("pension_fund");
  const search = params.get("search");
  const sortBy = params.get("sort_by") || "irr";
  const sortDir = params.get("sort_dir") || "desc";
  const page = parseInt(params.get("page") || "1");
  const limit = parseInt(params.get("limit") || "50");
  const minIrr = params.get("min_irr");
  const maxIrr = params.get("max_irr");
  const asOfDate = params.get("as_of_date");

  const allowedSorts = [
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
  ];
  const safeSortBy = allowedSorts.includes(sortBy) ? sortBy : "irr";
  const ascending = sortDir !== "desc";

  const offset = (page - 1) * limit;

  try {
    // Determine the date filter. When "latest" (default), we restrict each
    // pension fund to its most-recent quarter.
    const isLatest = !asOfDate || asOfDate === "latest";

    let latestByFund: Map<string, string> | null = null;
    if (isLatest) {
      const { data: latestRows, error: lErr } = await supabase.rpc(
        "get_latest_quarter_per_fund"
      );
      if (lErr) throw lErr;
      latestByFund = new Map(
        (latestRows ?? []).map(
          (r: { pension_fund: string; as_of_date: string }) => [
            r.pension_fund,
            r.as_of_date,
          ]
        )
      );
    }

    let query = supabase.from("fund_holdings").select("*", { count: "exact" });

    if (isLatest && latestByFund) {
      if (pensionFund && pensionFund !== "All") {
        // Specific fund, latest quarter
        const latestDate = latestByFund.get(pensionFund);
        if (latestDate) {
          query = query.eq("pension_fund", pensionFund);
          query = query.eq("as_of_date", latestDate);
        } else {
          query = query.eq("pension_fund", pensionFund);
        }
      } else {
        // All funds, latest quarter per fund — build compound OR filter.
        // Each condition pins a fund to its latest date. For NY State we also
        // exclude asset_class = "Other" (public equity holdings).
        const conditions = Array.from(latestByFund.entries())
          .map(([fund, date]) => {
            const qFund = `"${fund}"`;
            const qDate = `"${date}"`;
            if (fund === "NY State Common Retirement Fund") {
              return `and(pension_fund.eq.${qFund},as_of_date.eq.${qDate},asset_class.neq.Other)`;
            }
            return `and(pension_fund.eq.${qFund},as_of_date.eq.${qDate})`;
          })
          .join(",");
        query = query.or(conditions);
      }
    } else {
      // Specific quarter date selected
      query = query.eq("as_of_date", asOfDate!);
      query = query.or(
        'pension_fund.neq."NY State Common Retirement Fund",asset_class.neq.Other'
      );

      if (pensionFund && pensionFund !== "All") {
        query = query.eq("pension_fund", pensionFund);
      }
    }

    // Additional filters
    if (assetClass && assetClass !== "All") {
      query = query.eq("asset_class", assetClass);
    }
    if (search) {
      query = query.ilike("fund_name", `%${search}%`);
    }
    if (minIrr) {
      query = query.gte("irr", parseFloat(minIrr));
    }
    if (maxIrr) {
      query = query.lte("irr", parseFloat(maxIrr));
    }

    query = query
      .order(safeSortBy, { ascending, nullsFirst: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) throw error;

    const total = count ?? 0;

    return NextResponse.json({
      data: data ?? [],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Failed to fetch holdings" },
      { status: 500 }
    );
  }
}
