"""
Migrate data from local SQLite (data/funds.db) to Supabase.

Prerequisites:
  1. Run supabase_schema.sql in your Supabase SQL Editor first.
  2. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY as environment variables,
     or create a .env file in the project root.

Usage:
  pip install supabase python-dotenv
  python pipeline/migrate_to_supabase.py
"""

import os
import sqlite3
import sys

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "funds.db")
BATCH_SIZE = 500


def get_sqlite_data():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    docs = [dict(r) for r in conn.execute("SELECT * FROM documents").fetchall()]
    holdings = [dict(r) for r in conn.execute("SELECT * FROM fund_holdings").fetchall()]

    conn.close()
    return docs, holdings


def migrate():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        print("  You can find the service role key in Supabase Dashboard → Settings → API")
        sys.exit(1)

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    docs, holdings = get_sqlite_data()

    print(f"Found {len(docs)} documents and {len(holdings)} holdings in SQLite")

    # --- Documents ---
    # Build an id mapping (old SQLite id → new Supabase id)
    id_map = {}
    for doc in docs:
        old_id = doc.pop("id")
        resp = sb.table("documents").insert(doc).execute()
        new_id = resp.data[0]["id"]
        id_map[old_id] = new_id
        print(f"  Document '{doc['filename']}' → id {new_id}")

    # --- Fund Holdings (batched) ---
    total = len(holdings)
    inserted = 0
    for i in range(0, total, BATCH_SIZE):
        batch = holdings[i : i + BATCH_SIZE]
        for row in batch:
            row.pop("id", None)
            row.pop("created_at", None)
            row["document_id"] = id_map.get(row["document_id"], row["document_id"])
        sb.table("fund_holdings").insert(batch).execute()
        inserted += len(batch)
        print(f"  Holdings: {inserted}/{total}")

    print(f"\nDone! Migrated {len(docs)} documents and {total} holdings to Supabase.")


if __name__ == "__main__":
    migrate()
