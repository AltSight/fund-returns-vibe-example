import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/db";

export async function GET() {
  const supabase = getSupabase();
  try {
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

    if (assetClassRes.error) throw assetClassRes.error;
    if (pensionFundRes.error) throw pensionFundRes.error;
    if (totalsRes.error) throw totalsRes.error;
    if (documentsRes.error) throw documentsRes.error;

    return NextResponse.json({
      assetClasses: assetClassRes.data,
      pensionFunds: pensionFundRes.data,
      documents: documentsRes.data,
      totals: totalsRes.data?.[0] ?? {
        total_holdings: 0,
        total_pensions: 0,
        total_asset_classes: 0,
        avg_irr: null,
        avg_tvpi: null,
      },
    });
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
