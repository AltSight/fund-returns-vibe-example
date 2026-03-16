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

CREATE TABLE IF NOT EXISTS fund_meta (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fund_name TEXT NOT NULL UNIQUE,
    asset_class TEXT,
    sub_category TEXT,
    sector TEXT,
    sub_vertical TEXT,
    firm_legal_name TEXT,
    firm_common_name TEXT,
    vintage_year INTEGER,
    fund_size_usd DOUBLE PRECISION,
    perplexity_citations JSONB,
    enriched_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_holdings_pension ON fund_holdings(pension_fund);
CREATE INDEX IF NOT EXISTS idx_holdings_asset_class ON fund_holdings(asset_class);
CREATE INDEX IF NOT EXISTS idx_holdings_fund_name ON fund_holdings(fund_name);
CREATE INDEX IF NOT EXISTS idx_holdings_as_of ON fund_holdings(as_of_date);
CREATE INDEX IF NOT EXISTS idx_fund_meta_asset_class ON fund_meta(asset_class);
CREATE INDEX IF NOT EXISTS idx_fund_meta_fund_name ON fund_meta(fund_name);

-- RLS: allow anonymous read access for the web dashboard
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on documents" ON documents
    FOR SELECT USING (true);

CREATE POLICY "Allow public read on fund_holdings" ON fund_holdings
    FOR SELECT USING (true);

CREATE POLICY "Allow public read on fund_meta" ON fund_meta
    FOR SELECT USING (true);

-- RPC functions for aggregated stats (avoids row-limit issues)
-- All stats functions accept an optional quarter_filter parameter.
-- When NULL they automatically use the latest quarter per pension fund.

CREATE OR REPLACE FUNCTION get_available_quarters()
RETURNS TABLE(pension_fund TEXT, as_of_date TEXT)
LANGUAGE sql STABLE AS $$
    SELECT DISTINCT fh.pension_fund, fh.as_of_date
    FROM fund_holdings fh
    ORDER BY fh.pension_fund, fh.as_of_date DESC;
$$;

CREATE OR REPLACE FUNCTION get_latest_quarter_per_fund()
RETURNS TABLE(pension_fund TEXT, as_of_date TEXT)
LANGUAGE sql STABLE AS $$
    SELECT DISTINCT ON (sub.pension_fund) sub.pension_fund, sub.as_of_date
    FROM (
        SELECT DISTINCT fh.pension_fund, fh.as_of_date
        FROM fund_holdings fh
    ) sub
    ORDER BY sub.pension_fund,
             TO_DATE(REPLACE(sub.as_of_date, ',', ''), 'Month DD YYYY') DESC;
$$;

CREATE OR REPLACE FUNCTION get_asset_class_stats(quarter_filter TEXT DEFAULT NULL)
RETURNS TABLE(
    asset_class TEXT,
    count BIGINT,
    avg_irr DOUBLE PRECISION,
    avg_tvpi DOUBLE PRECISION,
    total_commitment DOUBLE PRECISION
) LANGUAGE sql STABLE AS $$
    WITH latest_per_fund AS (
        SELECT DISTINCT ON (sub.pension_fund) sub.pension_fund AS pf, sub.as_of_date AS latest_date
        FROM (SELECT DISTINCT pension_fund, as_of_date FROM fund_holdings) sub
        ORDER BY sub.pension_fund,
                 TO_DATE(REPLACE(sub.as_of_date, ',', ''), 'Month DD YYYY') DESC
    )
    SELECT fh.asset_class, COUNT(*) AS count,
           AVG(fh.irr) AS avg_irr, AVG(fh.tvpi) AS avg_tvpi,
           SUM(fh.commitment) AS total_commitment
    FROM fund_holdings fh
    LEFT JOIN latest_per_fund lpf ON fh.pension_fund = lpf.pf
    WHERE fh.asset_class IS NOT NULL
      AND (
            (quarter_filter IS NOT NULL AND fh.as_of_date = quarter_filter)
            OR
            (quarter_filter IS NULL AND fh.as_of_date = lpf.latest_date)
          )
    GROUP BY fh.asset_class
    ORDER BY count DESC;
$$;

CREATE OR REPLACE FUNCTION get_pension_fund_stats(quarter_filter TEXT DEFAULT NULL)
RETURNS TABLE(
    pension_fund TEXT,
    count BIGINT,
    as_of_date TEXT
) LANGUAGE sql STABLE AS $$
    WITH latest_per_fund AS (
        SELECT DISTINCT ON (sub.pension_fund) sub.pension_fund AS pf, sub.as_of_date AS latest_date
        FROM (SELECT DISTINCT pension_fund, as_of_date FROM fund_holdings) sub
        ORDER BY sub.pension_fund,
                 TO_DATE(REPLACE(sub.as_of_date, ',', ''), 'Month DD YYYY') DESC
    )
    SELECT fh.pension_fund, COUNT(*) AS count,
           MAX(fh.as_of_date) AS as_of_date
    FROM fund_holdings fh
    LEFT JOIN latest_per_fund lpf ON fh.pension_fund = lpf.pf
    WHERE (
            (quarter_filter IS NOT NULL AND fh.as_of_date = quarter_filter)
            OR
            (quarter_filter IS NULL AND fh.as_of_date = lpf.latest_date)
          )
    GROUP BY fh.pension_fund
    ORDER BY count DESC;
$$;

CREATE OR REPLACE FUNCTION get_totals(quarter_filter TEXT DEFAULT NULL)
RETURNS TABLE(
    total_holdings BIGINT,
    total_pensions BIGINT,
    total_asset_classes BIGINT,
    avg_irr DOUBLE PRECISION,
    avg_tvpi DOUBLE PRECISION
) LANGUAGE sql STABLE AS $$
    WITH latest_per_fund AS (
        SELECT DISTINCT ON (sub.pension_fund) sub.pension_fund AS pf, sub.as_of_date AS latest_date
        FROM (SELECT DISTINCT pension_fund, as_of_date FROM fund_holdings) sub
        ORDER BY sub.pension_fund,
                 TO_DATE(REPLACE(sub.as_of_date, ',', ''), 'Month DD YYYY') DESC
    )
    SELECT COUNT(*) AS total_holdings,
           COUNT(DISTINCT fh.pension_fund) AS total_pensions,
           COUNT(DISTINCT fh.asset_class) AS total_asset_classes,
           AVG(fh.irr) AS avg_irr,
           AVG(fh.tvpi) AS avg_tvpi
    FROM fund_holdings fh
    LEFT JOIN latest_per_fund lpf ON fh.pension_fund = lpf.pf
    WHERE (
            (quarter_filter IS NOT NULL AND fh.as_of_date = quarter_filter)
            OR
            (quarter_filter IS NULL AND fh.as_of_date = lpf.latest_date)
          );
$$;
