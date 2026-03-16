-- Add fund_meta enrichment table for benchmark metadata.

CREATE TABLE IF NOT EXISTS public.fund_meta (
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

CREATE INDEX IF NOT EXISTS idx_fund_meta_asset_class ON public.fund_meta(asset_class);
CREATE INDEX IF NOT EXISTS idx_fund_meta_fund_name ON public.fund_meta(fund_name);

ALTER TABLE public.fund_meta ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'fund_meta'
          AND policyname = 'Allow public read on fund_meta'
    ) THEN
        CREATE POLICY "Allow public read on fund_meta"
            ON public.fund_meta
            FOR SELECT
            USING (true);
    END IF;
END
$$;
