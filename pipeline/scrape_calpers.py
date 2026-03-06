"""
Scrape CalPERS Private Equity Program Fund Performance data.
Source: https://www.calpers.ca.gov/investments/about-investment-office/investment-organization/pep-fund-performance
"""
import requests
import re
import csv
import os
from bs4 import BeautifulSoup

URL = "https://www.calpers.ca.gov/investments/about-investment-office/investment-organization/pep-fund-performance"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
OUTPUT_CSV = os.path.join(OUTPUT_DIR, "calpers_pe_fund_performance.csv")


def clean_money(val: str) -> str:
    """Remove $, commas, whitespace from dollar amounts. Return raw number string."""
    if not val or not val.strip():
        return ""
    val = val.strip().replace("$", "").replace(",", "").replace("\xa0", "").strip()
    if val in ("-", "N/M", ""):
        return ""
    val = val.replace("\\-", "-").replace("\u2013", "-").replace("\u2212", "-")
    return val


def strip_footnotes(val: str) -> str:
    """Remove trailing footnote markers (superscript digits) from cell text."""
    return re.sub(r"\s*\d+$", "", val).strip()


def clean_pct(val: str) -> str:
    """Clean percentage values like '8.5%' -> '8.5', handle negatives."""
    if not val or not val.strip():
        return ""
    val = strip_footnotes(val)
    val = val.replace("%", "").replace("\\-", "-").replace("\u2013", "-").replace("\u2212", "-").strip()
    if val in ("-", "N/M", ""):
        return ""
    return val


def clean_multiple(val: str) -> str:
    """Clean investment multiple values like '1.7x' -> '1.7'."""
    if not val or not val.strip():
        return ""
    val = strip_footnotes(val)
    val = val.replace("x", "").replace("X", "").strip()
    if val in ("-", "N/M", ""):
        return ""
    return val


def scrape_calpers():
    print(f"Fetching {URL} ...")
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }
    resp = requests.get(URL, headers=headers, timeout=30)
    resp.raise_for_status()
    print(f"Response: {resp.status_code}, length: {len(resp.text):,} chars")

    soup = BeautifulSoup(resp.text, "lxml")

    table = soup.find("table")
    if not table:
        tables = soup.find_all("table")
        print(f"Found {len(tables)} tables on page")
        if tables:
            table = max(tables, key=lambda t: len(t.find_all("tr")))
        else:
            print("ERROR: No tables found on the page.")
            return []

    rows = table.find_all("tr")
    print(f"Found {len(rows)} rows in table (including headers)")

    headers_row = rows[0] if rows else None
    col_names = []
    if headers_row:
        for th in headers_row.find_all(["th", "td"]):
            col_names.append(th.get_text(strip=True))
    print(f"Columns: {col_names}")

    records = []
    for row in rows[1:]:
        cells = row.find_all(["td", "th"])
        if not cells:
            continue

        cell_texts = [c.get_text(strip=True) for c in cells]

        # Skip sub-header rows (repeated column labels)
        if cell_texts and cell_texts[0] == "Fund":
            continue
        # Skip empty rows
        if all(not t for t in cell_texts):
            continue

        if len(cell_texts) < 8:
            continue

        fund_name = cell_texts[0].strip()
        vintage_year = cell_texts[1].strip()
        capital_committed = clean_money(cell_texts[2])
        cash_in = clean_money(cell_texts[3])
        cash_out = clean_money(cell_texts[4])
        cash_out_remaining = clean_money(cell_texts[5])
        net_irr = clean_pct(cell_texts[6])
        investment_multiple = clean_multiple(cell_texts[7])

        if not fund_name:
            continue

        records.append({
            "fund_name": fund_name,
            "vintage_year": vintage_year,
            "capital_committed": capital_committed,
            "cash_in": cash_in,
            "cash_out": cash_out,
            "cash_out_and_remaining_value": cash_out_remaining,
            "net_irr": net_irr,
            "investment_multiple": investment_multiple,
        })

    print(f"\nExtracted {len(records)} fund records")
    return records


def _to_float(val: str) -> float | None:
    if not val:
        return None
    try:
        return float(val)
    except ValueError:
        return None


def scrape_calpers_for_pipeline() -> dict:
    """Scrape CalPERS and return data in the same format as parsers.parse_pdf().

    Returns a dict with keys: pension_fund, report_date, document_type,
    page_count, holdings (list of dicts matching the Supabase schema).
    """
    records = scrape_calpers()
    holdings = []
    for r in records:
        committed = _to_float(r["capital_committed"])
        contributed = _to_float(r["cash_in"])
        distributed = _to_float(r["cash_out"])
        total_value = _to_float(r["cash_out_and_remaining_value"])
        irr = _to_float(r["net_irr"])
        tvpi = _to_float(r["investment_multiple"])

        market_value = None
        if total_value is not None and distributed is not None:
            market_value = total_value - distributed

        dpi = None
        if contributed and contributed > 0 and distributed is not None:
            dpi = round(distributed / contributed, 2)
            if dpi > 100:
                dpi = None

        vy = None
        try:
            vy = int(r["vintage_year"])
        except (ValueError, TypeError):
            pass

        holdings.append({
            "fund_name": r["fund_name"],
            "vintage_year": vy,
            "commitment": committed,
            "contributed": contributed,
            "distributed": distributed,
            "market_value": market_value,
            "total_value": total_value,
            "irr": irr,
            "tvpi": tvpi,
            "dpi": dpi,
            "asset_class": None,
            "strategy": None,
            "initial_investment_date": None,
            "unfunded": None,
            "gain_since_inception": None,
        })

    return {
        "pension_fund": "CalPERS",
        "report_date": "June 30, 2025",
        "document_type": "Private Equity Program Fund Performance",
        "page_count": 0,
        "holdings": holdings,
    }


def save_csv(records: list[dict]):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    if not records:
        print("No records to save.")
        return

    fieldnames = [
        "fund_name", "vintage_year", "capital_committed", "cash_in",
        "cash_out", "cash_out_and_remaining_value", "net_irr", "investment_multiple",
    ]
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)
    print(f"Saved to {OUTPUT_CSV}")


if __name__ == "__main__":
    records = scrape_calpers()
    save_csv(records)

    if records:
        print(f"\nFirst 3 records:")
        for r in records[:3]:
            print(f"  {r['fund_name']} | {r['vintage_year']} | committed={r['capital_committed']} | IRR={r['net_irr']} | multiple={r['investment_multiple']}")
        print(f"\nLast 3 records:")
        for r in records[-3:]:
            print(f"  {r['fund_name']} | {r['vintage_year']} | committed={r['capital_committed']} | IRR={r['net_irr']} | multiple={r['investment_multiple']}")

        vintage_counts = {}
        for r in records:
            vy = r["vintage_year"]
            vintage_counts[vy] = vintage_counts.get(vy, 0) + 1
        print(f"\nVintage year distribution:")
        for vy in sorted(vintage_counts.keys()):
            print(f"  {vy}: {vintage_counts[vy]} funds")
