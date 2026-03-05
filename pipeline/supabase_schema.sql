-- Supabase schema for Fund Returns
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)

CREATE TABLE IF NOT EXISTS documents (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    filename TEXT NOT NULL,
    pension_fund TEXT NOT NULL,
    report_date TEXT NOT NULL,
    document_type TEXT,
    source_url TEXT,
    page_count INTEGER,
    processed_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(filename, pension_fund, report_date)
);

CREATE TABLE IF NOT EXISTS fund_holdings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES documents(id),
    pension_fund TEXT NOT NULL,
    as_of_date TEXT NOT NULL,
    fund_name TEXT NOT NULL,
    asset_class TEXT,
    strategy TEXT,
    vintage_year INTEGER,
    commitment DOUBLE PRECISION,
    contributed DOUBLE PRECISION,
    unfunded DOUBLE PRECISION,
    distributed DOUBLE PRECISION,
    market_value DOUBLE PRECISION,
    total_value DOUBLE PRECISION,
    irr DOUBLE PRECISION,
    tvpi DOUBLE PRECISION,
    dpi DOUBLE PRECISION,
    initial_investment_date TEXT,
    gain_since_inception DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_holdings_pension ON fund_holdings(pension_fund);
CREATE INDEX IF NOT EXISTS idx_holdings_asset_class ON fund_holdings(asset_class);
CREATE INDEX IF NOT EXISTS idx_holdings_fund_name ON fund_holdings(fund_name);
CREATE INDEX IF NOT EXISTS idx_holdings_as_of ON fund_holdings(as_of_date);

-- RLS: allow anonymous read access for the web dashboard
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on documents" ON documents
    FOR SELECT USING (true);

CREATE POLICY "Allow public read on fund_holdings" ON fund_holdings
    FOR SELECT USING (true);

-- RPC functions for aggregated stats (avoids row-limit issues)

CREATE OR REPLACE FUNCTION get_asset_class_stats()
RETURNS TABLE(
    asset_class TEXT,
    count BIGINT,
    avg_irr DOUBLE PRECISION,
    avg_tvpi DOUBLE PRECISION,
    total_commitment DOUBLE PRECISION
) LANGUAGE sql STABLE AS $$
    SELECT asset_class, COUNT(*) AS count,
           AVG(irr) AS avg_irr, AVG(tvpi) AS avg_tvpi,
           SUM(commitment) AS total_commitment
    FROM fund_holdings
    WHERE asset_class IS NOT NULL
    GROUP BY asset_class
    ORDER BY count DESC;
$$;

CREATE OR REPLACE FUNCTION get_pension_fund_stats()
RETURNS TABLE(
    pension_fund TEXT,
    count BIGINT,
    as_of_date TEXT
) LANGUAGE sql STABLE AS $$
    SELECT pension_fund, COUNT(*) AS count,
           MAX(as_of_date) AS as_of_date
    FROM fund_holdings
    GROUP BY pension_fund
    ORDER BY count DESC;
$$;

CREATE OR REPLACE FUNCTION get_totals()
RETURNS TABLE(
    total_holdings BIGINT,
    total_pensions BIGINT,
    total_asset_classes BIGINT,
    avg_irr DOUBLE PRECISION,
    avg_tvpi DOUBLE PRECISION
) LANGUAGE sql STABLE AS $$
    SELECT COUNT(*) AS total_holdings,
           COUNT(DISTINCT pension_fund) AS total_pensions,
           COUNT(DISTINCT asset_class) AS total_asset_classes,
           AVG(irr) AS avg_irr,
           AVG(tvpi) AS avg_tvpi
    FROM fund_holdings;
$$;
