#!/usr/bin/env python3
"""
Main pipeline: scan PDFs, extract data locally, classify, and load into SQLite.
"""
import os
import sys
import glob

from db import get_connection, init_db
from parsers import parse_pdf
from classify import classify_batch_llm, classify_local


FUNDS_DIR = os.path.join(os.path.dirname(__file__), "..", "Funds Data")


def already_processed(conn, filename: str) -> bool:
    row = conn.execute(
        "SELECT id FROM documents WHERE filename = ?", (filename,)
    ).fetchone()
    return row is not None


def load_document(conn, doc_meta: dict) -> int:
    cur = conn.execute(
        """INSERT INTO documents (filename, pension_fund, report_date, document_type, source_url, page_count)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (
            doc_meta["filename"],
            doc_meta["pension_fund"],
            doc_meta["report_date"],
            doc_meta["document_type"],
            doc_meta.get("source_url", ""),
            doc_meta.get("page_count", 0),
        ),
    )
    return cur.lastrowid


def load_holdings(conn, document_id: int, pension_fund: str, as_of_date: str, holdings: list):
    for h in holdings:
        conn.execute(
            """INSERT INTO fund_holdings
               (document_id, pension_fund, as_of_date, fund_name, asset_class, strategy,
                vintage_year, commitment, contributed, unfunded, distributed, market_value,
                total_value, irr, tvpi, dpi, initial_investment_date, gain_since_inception)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                document_id,
                pension_fund,
                as_of_date,
                h["fund_name"],
                h.get("asset_class"),
                h.get("strategy"),
                h.get("vintage_year"),
                h.get("commitment"),
                h.get("contributed"),
                h.get("unfunded"),
                h.get("distributed"),
                h.get("market_value"),
                h.get("total_value"),
                h.get("irr"),
                h.get("tvpi"),
                h.get("dpi"),
                h.get("initial_investment_date"),
                h.get("gain_since_inception"),
            ),
        )


def process_file(filepath: str, conn, use_llm: bool = False):
    filename = os.path.basename(filepath)
    if already_processed(conn, filename):
        print(f"  Skipping {filename} (already processed)")
        return

    print(f"  Parsing {filename}...")
    result = parse_pdf(filepath)

    if not result["holdings"]:
        print(f"  No holdings extracted from {filename}")
        return

    holdings = result["holdings"]
    if use_llm:
        print(f"  Classifying {len(holdings)} holdings with LLM...")
        holdings = classify_batch_llm(holdings)
    else:
        for h in holdings:
            if not h.get("asset_class") or h["asset_class"] in ("Private Equity", None):
                h["asset_class"] = classify_local(h["fund_name"], h.get("strategy"))

    doc_id = load_document(conn, {
        "filename": filename,
        "pension_fund": result["pension_fund"],
        "report_date": result["report_date"],
        "document_type": result["document_type"],
        "page_count": result.get("page_count", 0),
    })

    load_holdings(conn, doc_id, result["pension_fund"], result["report_date"], holdings)
    conn.commit()
    print(f"  Loaded {len(holdings)} holdings from {filename}")


def main():
    use_llm = "--llm" in sys.argv

    print("Initializing database...")
    init_db()

    conn = get_connection()

    pdf_files = glob.glob(os.path.join(FUNDS_DIR, "*.pdf"))
    if not pdf_files:
        print(f"No PDFs found in {FUNDS_DIR}")
        return

    print(f"Found {len(pdf_files)} PDF files in {FUNDS_DIR}")
    for filepath in sorted(pdf_files):
        process_file(filepath, conn, use_llm)

    total = conn.execute("SELECT COUNT(*) FROM fund_holdings").fetchone()[0]
    docs = conn.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
    print(f"\nDone! {docs} documents, {total} total holdings in database.")
    conn.close()


if __name__ == "__main__":
    main()
