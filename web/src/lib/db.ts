import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
    _client = createClient(url, key);
  }
  return _client;
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
