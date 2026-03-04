import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
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
  const safeSortDir = sortDir === "desc" ? "DESC" : "ASC";

  const conditions: string[] = [];
  const values: (string | number)[] = [];

  if (assetClass && assetClass !== "All") {
    conditions.push("asset_class = ?");
    values.push(assetClass);
  }
  if (pensionFund && pensionFund !== "All") {
    conditions.push("pension_fund = ?");
    values.push(pensionFund);
  }
  if (search) {
    conditions.push("fund_name LIKE ?");
    values.push(`%${search}%`);
  }
  if (minIrr) {
    conditions.push("irr >= ?");
    values.push(parseFloat(minIrr));
  }
  if (maxIrr) {
    conditions.push("irr <= ?");
    values.push(parseFloat(maxIrr));
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  try {
    const db = getDb();

    const countRow = db
      .prepare(`SELECT COUNT(*) as total FROM fund_holdings ${where}`)
      .get(...values) as { total: number };

    const rows = db
      .prepare(
        `SELECT * FROM fund_holdings ${where} ORDER BY ${safeSortBy} ${safeSortDir} LIMIT ? OFFSET ?`
      )
      .all(...values, limit, offset);

    return NextResponse.json({
      data: rows,
      total: countRow.total,
      page,
      limit,
      totalPages: Math.ceil(countRow.total / limit),
    });
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Failed to fetch holdings" },
      { status: 500 }
    );
  }
}
