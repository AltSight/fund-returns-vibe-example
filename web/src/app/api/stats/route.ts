import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/db";

export async function GET() {
  const supabase = getSupabase();
  try {
    const [assetClassRes, pensionFundRes, totalsRes, documentsRes, excludedCountRes] =
      await Promise.all([
        supabase.rpc("get_asset_class_stats"),
        supabase.rpc("get_pension_fund_stats"),
        supabase.rpc("get_totals"),
        supabase
          .from("documents")
          .select("*")
          .order("processed_at", { ascending: false }),
        supabase
          .from("fund_holdings")
          .select("id", { count: "exact", head: true })
          .eq("pension_fund", "NY State Common Retirement Fund")
          .eq("asset_class", "Other"),
      ]);

    if (assetClassRes.error) throw assetClassRes.error;
    if (pensionFundRes.error) throw pensionFundRes.error;
    if (totalsRes.error) throw totalsRes.error;
    if (documentsRes.error) throw documentsRes.error;

    const excludedCount = excludedCountRes.count ?? 0;

    // Adjust asset class stats: subtract excluded NY State public equities from "Other"
    const assetClasses = (assetClassRes.data ?? [])
      .map((ac: { asset_class: string; count: number }) => {
        if (ac.asset_class === "Other") {
          return { ...ac, count: ac.count - excludedCount };
        }
        return ac;
      })
      .filter((ac: { count: number }) => ac.count > 0);

    // Adjust pension fund stats: subtract excluded count from NY State
    const pensionFunds = (pensionFundRes.data ?? []).map(
      (pf: { pension_fund: string; count: number }) => {
        if (pf.pension_fund === "NY State Common Retirement Fund") {
          return { ...pf, count: pf.count - excludedCount };
        }
        return pf;
      }
    );

    // Adjust totals
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
    });
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
