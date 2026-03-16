import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/db";

export async function GET(request: NextRequest) {
  const supabase = getSupabase();
  const asOfDate = request.nextUrl.searchParams.get("as_of_date");
  const isLatest = !asOfDate || asOfDate === "latest";

  try {
    // Fetch available quarters first — we need them to compute the NY State
    // excluded count for the correct quarter.
    const quartersRes = await supabase.rpc("get_available_quarters");
    if (quartersRes.error) throw quartersRes.error;
    const quarters: { pension_fund: string; as_of_date: string }[] =
      quartersRes.data ?? [];

    // RPC params: NULL means "latest per fund" inside the SQL functions.
    const rpcParams =
      !isLatest ? { quarter_filter: asOfDate } : {};

    // Determine the NY State quarter date for the excluded-count query.
    let nyQuarterDate: string | null = null;
    if (isLatest) {
      const latestRes = await supabase.rpc("get_latest_quarter_per_fund");
      if (!latestRes.error) {
        const nyRow = (latestRes.data ?? []).find(
          (r: { pension_fund: string }) =>
            r.pension_fund === "NY State Common Retirement Fund"
        );
        if (nyRow) nyQuarterDate = nyRow.as_of_date;
      }
    } else {
      nyQuarterDate = asOfDate;
    }

    // Build the excluded-count query (NY State "Other" holdings).
    let excludedQuery = supabase
      .from("fund_holdings")
      .select("id", { count: "exact", head: true })
      .eq("pension_fund", "NY State Common Retirement Fund")
      .eq("asset_class", "Other");
    if (nyQuarterDate) {
      excludedQuery = excludedQuery.eq("as_of_date", nyQuarterDate);
    }

    const [assetClassRes, pensionFundRes, totalsRes, documentsRes, excludedCountRes] =
      await Promise.all([
        supabase.rpc("get_asset_class_stats", rpcParams),
        supabase.rpc("get_pension_fund_stats", rpcParams),
        supabase.rpc("get_totals", rpcParams),
        supabase
          .from("documents")
          .select("*")
          .order("processed_at", { ascending: false }),
        excludedQuery,
      ]);

    if (assetClassRes.error) throw assetClassRes.error;
    if (pensionFundRes.error) throw pensionFundRes.error;
    if (totalsRes.error) throw totalsRes.error;
    if (documentsRes.error) throw documentsRes.error;

    const excludedCount = excludedCountRes.count ?? 0;

    const assetClasses = (assetClassRes.data ?? [])
      .map((ac: { asset_class: string; count: number }) => {
        if (ac.asset_class === "Other") {
          return { ...ac, count: ac.count - excludedCount };
        }
        return ac;
      })
      .filter((ac: { count: number }) => ac.count > 0);

    const pensionFunds = (pensionFundRes.data ?? []).map(
      (pf: { pension_fund: string; count: number }) => {
        if (pf.pension_fund === "NY State Common Retirement Fund") {
          return { ...pf, count: pf.count - excludedCount };
        }
        return pf;
      }
    );

    const rawTotals = totalsRes.data?.[0] ?? {
      total_holdings: 0,
      total_pensions: 0,
      total_asset_classes: 0,
      avg_irr: null,
      avg_tvpi: null,
    };
    const totals = {
      ...rawTotals,
      total_holdings: rawTotals.total_holdings - excludedCount,
      total_asset_classes: assetClasses.length,
    };

    return NextResponse.json({
      assetClasses,
      pensionFunds,
      documents: documentsRes.data,
      totals,
      quarters,
    });
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
