import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();

    const assetClasses = db
      .prepare(
        `SELECT asset_class, COUNT(*) as count, AVG(irr) as avg_irr,
                AVG(tvpi) as avg_tvpi, SUM(commitment) as total_commitment
         FROM fund_holdings WHERE asset_class IS NOT NULL
         GROUP BY asset_class ORDER BY count DESC`
      )
      .all() as {
      asset_class: string;
      count: number;
      avg_irr: number | null;
      avg_tvpi: number | null;
      total_commitment: number | null;
    }[];

    const pensionFunds = db
      .prepare(
        `SELECT pension_fund, COUNT(*) as count, as_of_date
         FROM fund_holdings GROUP BY pension_fund ORDER BY count DESC`
      )
      .all() as { pension_fund: string; count: number; as_of_date: string }[];

    const documents = db
      .prepare(`SELECT * FROM documents ORDER BY processed_at DESC`)
      .all();

    const totals = db
      .prepare(
        `SELECT COUNT(*) as total_holdings,
                COUNT(DISTINCT pension_fund) as total_pensions,
                COUNT(DISTINCT asset_class) as total_asset_classes,
                AVG(irr) as avg_irr,
                AVG(tvpi) as avg_tvpi
         FROM fund_holdings`
      )
      .get() as {
      total_holdings: number;
      total_pensions: number;
      total_asset_classes: number;
      avg_irr: number | null;
      avg_tvpi: number | null;
    };

    return NextResponse.json({
      assetClasses,
      pensionFunds,
      documents,
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
