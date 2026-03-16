-- Add quarter-aware RPC functions so the dashboard can filter by reporting period.
-- When quarter_filter IS NULL, each function automatically uses the latest
-- quarter per pension fund (chronological, not alphabetical).

-- Helper: available (pension_fund, as_of_date) pairs, sorted newest-first.
CREATE OR REPLACE FUNCTION get_available_quarters()
RETURNS TABLE(pension_fund TEXT, as_of_date TEXT)
LANGUAGE sql STABLE AS $$
    SELECT DISTINCT fh.pension_fund, fh.as_of_date
    FROM fund_holdings fh
    ORDER BY fh.pension_fund, fh.as_of_date DESC;
$$;

-- Helper: latest quarter date per pension fund.
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

-- Replace the existing stats functions with quarter-aware versions.

DROP FUNCTION IF EXISTS get_asset_class_stats();

CREATE OR REPLACE FUNCTION get_asset_class_stats(quarter_filter TEXT DEFAULT NULL)
RETURNS TABLE(
    asset_class TEXT,
    count       BIGINT,
    avg_irr     DOUBLE PRECISION,
    avg_tvpi    DOUBLE PRECISION,
    total_commitment DOUBLE PRECISION
) LANGUAGE sql STABLE AS $$
    WITH latest_per_fund AS (
        SELECT DISTINCT ON (sub.pension_fund) sub.pension_fund AS pf, sub.as_of_date AS latest_date
        FROM (SELECT DISTINCT pension_fund, as_of_date FROM fund_holdings) sub
        ORDER BY sub.pension_fund,
                 TO_DATE(REPLACE(sub.as_of_date, ',', ''), 'Month DD YYYY') DESC
    )
    SELECT fh.asset_class,
           COUNT(*)           AS count,
           AVG(fh.irr)        AS avg_irr,
           AVG(fh.tvpi)       AS avg_tvpi,
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

DROP FUNCTION IF EXISTS get_pension_fund_stats();

CREATE OR REPLACE FUNCTION get_pension_fund_stats(quarter_filter TEXT DEFAULT NULL)
RETURNS TABLE(
    pension_fund TEXT,
    count        BIGINT,
    as_of_date   TEXT
) LANGUAGE sql STABLE AS $$
    WITH latest_per_fund AS (
        SELECT DISTINCT ON (sub.pension_fund) sub.pension_fund AS pf, sub.as_of_date AS latest_date
        FROM (SELECT DISTINCT pension_fund, as_of_date FROM fund_holdings) sub
        ORDER BY sub.pension_fund,
                 TO_DATE(REPLACE(sub.as_of_date, ',', ''), 'Month DD YYYY') DESC
    )
    SELECT fh.pension_fund,
           COUNT(*)            AS count,
           MAX(fh.as_of_date)  AS as_of_date
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

DROP FUNCTION IF EXISTS get_totals();

CREATE OR REPLACE FUNCTION get_totals(quarter_filter TEXT DEFAULT NULL)
RETURNS TABLE(
    total_holdings     BIGINT,
    total_pensions     BIGINT,
    total_asset_classes BIGINT,
    avg_irr            DOUBLE PRECISION,
    avg_tvpi           DOUBLE PRECISION
) LANGUAGE sql STABLE AS $$
    WITH latest_per_fund AS (
        SELECT DISTINCT ON (sub.pension_fund) sub.pension_fund AS pf, sub.as_of_date AS latest_date
        FROM (SELECT DISTINCT pension_fund, as_of_date FROM fund_holdings) sub
        ORDER BY sub.pension_fund,
                 TO_DATE(REPLACE(sub.as_of_date, ',', ''), 'Month DD YYYY') DESC
    )
    SELECT COUNT(*)                    AS total_holdings,
           COUNT(DISTINCT fh.pension_fund) AS total_pensions,
           COUNT(DISTINCT fh.asset_class)  AS total_asset_classes,
           AVG(fh.irr)                AS avg_irr,
           AVG(fh.tvpi)               AS avg_tvpi
    FROM fund_holdings fh
    LEFT JOIN latest_per_fund lpf ON fh.pension_fund = lpf.pf
    WHERE (
            (quarter_filter IS NOT NULL AND fh.as_of_date = quarter_filter)
            OR
            (quarter_filter IS NULL AND fh.as_of_date = lpf.latest_date)
          );
$$;
