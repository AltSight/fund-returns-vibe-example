#!/usr/bin/env python3
"""
Main pipeline: scan PDFs, extract data, classify, and load into Supabase.

Usage:
  python run_pipeline.py                          # keyword classification, skip already-processed
  python run_pipeline.py --llm                    # LLM classification, skip already-processed
  python run_pipeline.py --clear                  # wipe Supabase data and re-process all PDFs
  python run_pipeline.py --clear --llm
  python run_pipeline.py --reclassify calpers     # re-classify one fund (keyword)
  python run_pipeline.py --reclassify calstrs --llm

Valid fund names for --reclassify:
  calpers, calstrs, nystate, wsib
"""
import os
import sys
import glob

from dotenv import load_dotenv
from supabase import create_client

from parsers import parse_pdf
from classify import classify_batch_llm, classify_local
from scrape_calpers import scrape_calpers_for_pipeline, URL as CALPERS_URL

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

FUNDS_DIR = os.path.join(os.path.dirname(__file__), "..", "Funds Data")
BATCH_SIZE = 500

FUND_ALIASES = {
    "calpers":  "CalPERS",
    "calstrs":  "CalSTRS",
    "nystate":  "NY State Common Retirement Fund",
    "wsib":     "Washington State Investment Board",
}


def get_supabase_client():
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        print("Error: Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env")
        sys.exit(1)
    return create_client(url, key)


def clear_supabase(sb):
    """Delete all holdings and documents. Holdings first due to foreign key."""
    print("Clearing existing data from Supabase...")
    sb.table("fund_holdings").delete().neq("id", -1).execute()
    sb.table("documents").delete().neq("id", -1).execute()
    print("  Cleared.")


def already_processed(sb, filename: str) -> bool:
    resp = sb.table("documents").select("id").eq("filename", filename).execute()
    return len(resp.data) > 0


def load_document(sb, doc_meta: dict) -> int:
    resp = sb.table("documents").insert({
        "filename": doc_meta["filename"],
        "pension_fund": doc_meta["pension_fund"],
        "report_date": doc_meta["report_date"],
        "document_type": doc_meta["document_type"],
        "source_url": doc_meta.get("source_url", ""),
        "page_count": doc_meta.get("page_count", 0),
    }).execute()
    return resp.data[0]["id"]


def load_holdings(sb, document_id: int, pension_fund: str, as_of_date: str, holdings: list):
    rows = []
    for h in holdings:
        rows.append({
            "document_id": document_id,
            "pension_fund": pension_fund,
            "as_of_date": as_of_date,
            "fund_name": h["fund_name"],
            "asset_class": h.get("asset_class"),
            "strategy": h.get("strategy"),
            "vintage_year": h.get("vintage_year"),
            "commitment": h.get("commitment"),
            "contributed": h.get("contributed"),
            "unfunded": h.get("unfunded"),
            "distributed": h.get("distributed"),
            "market_value": h.get("market_value"),
            "total_value": h.get("total_value"),
            "irr": h.get("irr"),
            "tvpi": h.get("tvpi"),
            "dpi": h.get("dpi"),
            "initial_investment_date": h.get("initial_investment_date"),
            "gain_since_inception": h.get("gain_since_inception"),
        })
    for i in range(0, len(rows), BATCH_SIZE):
        sb.table("fund_holdings").insert(rows[i:i + BATCH_SIZE]).execute()


def classify_holdings(holdings: list, use_llm: bool) -> list:
    if use_llm:
        print(f"  Classifying {len(holdings)} holdings with LLM...", flush=True)
        return classify_batch_llm(holdings)
    for h in holdings:
        if not h.get("asset_class") or h["asset_class"] in ("Private Equity", None):
            h["asset_class"] = classify_local(h["fund_name"], h.get("strategy"))
    return holdings


def process_file(filepath: str, sb, use_llm: bool):
    filename = os.path.basename(filepath)
    if already_processed(sb, filename):
        print(f"  Skipping {filename} (already processed)", flush=True)
        return

    print(f"  Parsing {filename}...", flush=True)
    result = parse_pdf(filepath)

    if not result["holdings"]:
        print(f"  No holdings extracted from {filename}", flush=True)
        return

    holdings = classify_holdings(result["holdings"], use_llm)

    doc_id = load_document(sb, {
        "filename": filename,
        "pension_fund": result["pension_fund"],
        "report_date": result["report_date"],
        "document_type": result["document_type"],
        "page_count": result.get("page_count", 0),
    })

    load_holdings(sb, doc_id, result["pension_fund"], result["report_date"], holdings)
    print(f"  Loaded {len(holdings)} holdings from {filename}", flush=True)


def process_calpers_scrape(sb, use_llm: bool):
    """Scrape CalPERS PE fund performance from the web and load into Supabase."""
    source_label = "calpers_pe_web_scrape"
    if already_processed(sb, source_label):
        print(f"  Skipping CalPERS web scrape (already processed)", flush=True)
        return

    print("  Scraping CalPERS PE Fund Performance...", flush=True)
    result = scrape_calpers_for_pipeline()

    if not result["holdings"]:
        print("  No holdings extracted from CalPERS scrape", flush=True)
        return

    holdings = classify_holdings(result["holdings"], use_llm)

    doc_id = load_document(sb, {
        "filename": source_label,
        "pension_fund": result["pension_fund"],
        "report_date": result["report_date"],
        "document_type": result["document_type"],
        "source_url": CALPERS_URL,
        "page_count": 0,
    })

    load_holdings(sb, doc_id, result["pension_fund"], result["report_date"], holdings)
    print(f"  Loaded {len(holdings)} holdings from CalPERS web scrape", flush=True)


def reclassify_fund(sb, pension_fund: str, use_llm: bool):
    """Re-classify all holdings for a pension fund in-place."""
    print(f"Fetching holdings for {pension_fund}...", flush=True)

    holdings = []
    offset = 0
    while True:
        resp = (
            sb.table("fund_holdings")
            .select("id, fund_name, strategy, asset_class")
            .eq("pension_fund", pension_fund)
            .range(offset, offset + BATCH_SIZE - 1)
            .execute()
        )
        if not resp.data:
            break
        holdings.extend(resp.data)
        if len(resp.data) < BATCH_SIZE:
            break
        offset += BATCH_SIZE

    if not holdings:
        print(f"  No holdings found for {pension_fund}.")
        return

    print(f"  Found {len(holdings)} holdings. Reclassifying...", flush=True)

    as_dicts = [
        {"fund_name": h["fund_name"], "strategy": h.get("strategy"), "asset_class": None}
        for h in holdings
    ]
    classified = classify_holdings(as_dicts, use_llm)

    updated = 0
    for orig, new in zip(holdings, classified):
        new_class = new.get("asset_class")
        if new_class and new_class != orig.get("asset_class"):
            sb.table("fund_holdings").update({"asset_class": new_class}).eq("id", orig["id"]).execute()
            updated += 1

    print(f"  Updated {updated}/{len(holdings)} holdings for {pension_fund}.", flush=True)


def main():
    use_llm = "--llm" in sys.argv
    do_clear = "--clear" in sys.argv

    reclassify_arg = None
    if "--reclassify" in sys.argv:
        idx = sys.argv.index("--reclassify")
        if idx + 1 >= len(sys.argv):
            print(f"Error: --reclassify requires a fund name: {', '.join(FUND_ALIASES)}")
            sys.exit(1)
        alias = sys.argv[idx + 1].lower()
        if alias not in FUND_ALIASES:
            print(f"Error: unknown fund '{alias}'. Valid names: {', '.join(FUND_ALIASES)}")
            sys.exit(1)
        reclassify_arg = FUND_ALIASES[alias]

    sb = get_supabase_client()

    if reclassify_arg:
        reclassify_fund(sb, reclassify_arg, use_llm)
        return

    if do_clear:
        existing = sb.table("fund_holdings").select("id", count="exact").execute().count
        answer = input(f"This will delete {existing} holdings from Supabase. Continue? [y/N] ")
        if answer.strip().lower() != "y":
            print("Aborted.")
            return
        clear_supabase(sb)

    # --- PDFs ---
    pdf_files = glob.glob(os.path.join(FUNDS_DIR, "*.pdf"))
    if pdf_files:
        print(f"Found {len(pdf_files)} PDF files in {FUNDS_DIR}", flush=True)
        for filepath in sorted(pdf_files):
            process_file(filepath, sb, use_llm)
    else:
        print(f"No PDFs found in {FUNDS_DIR}")

    # --- Web scrapers ---
    print("\nProcessing web sources...", flush=True)
    process_calpers_scrape(sb, use_llm)

    total = sb.table("fund_holdings").select("id", count="exact").execute().count
    docs = sb.table("documents").select("id", count="exact").execute().count
    print(f"\nDone! {docs} documents, {total} total holdings in Supabase.")


if __name__ == "__main__":
    main()
