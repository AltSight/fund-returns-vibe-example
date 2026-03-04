import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "funds.db")


def get_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_connection()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            pension_fund TEXT NOT NULL,
            report_date TEXT NOT NULL,
            document_type TEXT,
            source_url TEXT,
            page_count INTEGER,
            processed_at TEXT DEFAULT (datetime('now')),
            UNIQUE(filename, pension_fund, report_date)
        );

        CREATE TABLE IF NOT EXISTS fund_holdings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id INTEGER NOT NULL REFERENCES documents(id),
            pension_fund TEXT NOT NULL,
            as_of_date TEXT NOT NULL,
            fund_name TEXT NOT NULL,
            asset_class TEXT,
            strategy TEXT,
            vintage_year INTEGER,
            commitment REAL,
            contributed REAL,
            unfunded REAL,
            distributed REAL,
            market_value REAL,
            total_value REAL,
            irr REAL,
            tvpi REAL,
            dpi REAL,
            initial_investment_date TEXT,
            gain_since_inception REAL,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_holdings_pension ON fund_holdings(pension_fund);
        CREATE INDEX IF NOT EXISTS idx_holdings_asset_class ON fund_holdings(asset_class);
        CREATE INDEX IF NOT EXISTS idx_holdings_fund_name ON fund_holdings(fund_name);
        CREATE INDEX IF NOT EXISTS idx_holdings_as_of ON fund_holdings(as_of_date);
    """)
    conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db()
    print(f"Database initialized at {DB_PATH}")
