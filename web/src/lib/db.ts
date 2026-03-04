import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "..", "data", "funds.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH, { readonly: true });
    db.pragma("journal_mode = WAL");
  }
  return db;
}

export interface FundHolding {
  id: number;
  document_id: number;
  pension_fund: string;
  as_of_date: string;
  fund_name: string;
  asset_class: string | null;
  strategy: string | null;
  vintage_year: number | null;
  commitment: number | null;
  contributed: number | null;
  unfunded: number | null;
  distributed: number | null;
  market_value: number | null;
  total_value: number | null;
  irr: number | null;
  tvpi: number | null;
  dpi: number | null;
  initial_investment_date: string | null;
  gain_since_inception: number | null;
}

export interface Document {
  id: number;
  filename: string;
  pension_fund: string;
  report_date: string;
  document_type: string | null;
  source_url: string | null;
  page_count: number | null;
  processed_at: string;
}
