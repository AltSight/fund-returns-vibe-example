import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/db";

export async function GET(request: NextRequest) {
  const supabase = getSupabase();
  const params = request.nextUrl.searchParams;
  const assetClass = params.get("asset_class");
  const pensionFund = params.get("pension_fund");
  const search = params.get("search");
  const sortBy = params.get("sort_by") || "fund_name";
  const sortDir = params.get("sort_dir") || "asc";
  const page = parseInt(params.get("page") || "1");
  const limit = parseInt(params.get("limit") || "50");
  const minIrr = params.get("min_irr");
  const maxIrr = params.get("max_irr");

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
  const safeSortBy = allowedSorts.includes(sortBy) ? sortBy : "fund_name";
  const ascending = sortDir !== "desc";

  const offset = (page - 1) * limit;

  try {
    let query = supabase.from("fund_holdings").select("*", { count: "exact" });

    if (assetClass && assetClass !== "All") {
      query = query.eq("asset_class", assetClass);
    }
    if (pensionFund && pensionFund !== "All") {
      query = query.eq("pension_fund", pensionFund);
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
      .order(safeSortBy, { ascending })
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
