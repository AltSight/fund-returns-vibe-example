#!/usr/bin/env python3
"""
Enrich fund-level metadata using Perplexity Sonar and load into Supabase.

Usage examples:
  python classify_fund_meta.py
  python classify_fund_meta.py --asset-class venture
  python classify_fund_meta.py --asset-class buyout --force
  python classify_fund_meta.py --asset-class credit --dry-run
"""

import argparse
import json
import os
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

PERPLEXITY_ENDPOINT = "https://api.perplexity.ai/v1/sonar"
FETCH_BATCH_SIZE = 1000

ASSET_CLASS_FILTERS = {
    "all": None,
    "venture": {"Venture Capital"},
    "buyout": {"Private Equity"},
    "credit": {"Private Credit"},
}

VC_SUB_CATEGORIES = [
    "Pre-Seed / Seed",
    "Early Stage",
    "Growth / Late Stage",
    "Multi-Stage",
    "General",
]

BUYOUT_SUB_CATEGORIES = [
    "Mega / Large-Cap",
    "Upper Mid-Market",
    "Mid-Market",
    "Lower Mid-Market",
    "Small-Cap",
    "General",
]

PRIVATE_CREDIT_SUB_CATEGORIES = [
    "Direct Lending",
    "Mezzanine",
    "Distressed Debt",
    "Special Situations",
    "Opportunistic Credit",
    "Structured Credit",
    "Asset-Based Lending",
    "General",
]

VC_TECH_SUB_VERTICALS = [
    "AI / Machine Learning",
    "SaaS / Cloud",
    "Cybersecurity",
    "Fintech",
    "Biotech / Life Sciences",
    "Climate / Clean Energy",
    "Consumer Tech",
    "Deep Tech",
    "Other Technology",
    "Non-Technology",
]


def parse_args():
    parser = argparse.ArgumentParser(description="Enrich fund metadata with Perplexity Sonar.")
    parser.add_argument(
        "--asset-class",
        choices=["all", "venture", "buyout", "credit"],
        default="all",
        help="Restrict enrichment scope to one asset class family.",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Alias for --asset-class all.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-enrich funds even if metadata already exists.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview selected funds without calling Perplexity or writing to Supabase.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=5,
        help="Number of funds to enrich per Perplexity request.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Max number of funds to process (0 means no limit).",
    )
    parser.add_argument(
        "--delay-seconds",
        type=float,
        default=1.0,
        help="Delay between Perplexity requests for rate-limit safety.",
    )
    parser.add_argument(
        "--model",
        default="sonar",
        help="Perplexity model to use (e.g., sonar, sonar-pro).",
    )
    parser.add_argument(
        "--search-mode",
        default="sec+web",
        choices=["web", "academic", "sec", "sec+web"],
        help="Perplexity search mode. Use sec+web to query both and merge.",
    )
    args = parser.parse_args()
    if args.all:
        args.asset_class = "all"
    if args.batch_size < 1:
        parser.error("--batch-size must be >= 1")
    return args


def get_supabase_client():
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise RuntimeError("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env")
    return create_client(url, key)


def get_perplexity_api_key():
    api_key = os.environ.get("PERPLEXITY_API_KEY", "")
    if not api_key:
        raise RuntimeError("Set PERPLEXITY_API_KEY in .env")
    return api_key


def paged_select(sb, table: str, select_clause: str):
    rows = []
    offset = 0
    while True:
        resp = (
            sb.table(table)
            .select(select_clause)
            .range(offset, offset + FETCH_BATCH_SIZE - 1)
            .execute()
        )
        batch = resp.data or []
        rows.extend(batch)
        if len(batch) < FETCH_BATCH_SIZE:
            break
        offset += FETCH_BATCH_SIZE
    return rows


def fetch_distinct_funds(sb):
    holdings = paged_select(sb, "fund_holdings", "fund_name, asset_class, vintage_year")
    grouped = defaultdict(lambda: {"asset_classes": Counter(), "vintage_years": Counter()})
    for h in holdings:
        fund_name = (h.get("fund_name") or "").strip()
        if not fund_name:
            continue
        asset_class = (h.get("asset_class") or "").strip()
        vintage_year = h.get("vintage_year")
        grouped[fund_name]["asset_classes"][asset_class] += 1
        if vintage_year:
            grouped[fund_name]["vintage_years"][int(vintage_year)] += 1

    funds = []
    for fund_name, data in grouped.items():
        asset_choices = [k for k, _v in data["asset_classes"].most_common() if k]
        best_asset_class = asset_choices[0] if asset_choices else "Other"
        vintage_choices = data["vintage_years"].most_common()
        best_vintage = vintage_choices[0][0] if vintage_choices else None
        funds.append(
            {
                "fund_name": fund_name,
                "asset_class": best_asset_class,
                "known_vintage_year": best_vintage,
            }
        )
    return sorted(funds, key=lambda x: x["fund_name"].lower())


def fetch_existing_meta_funds(sb):
    try:
        rows = paged_select(sb, "fund_meta", "fund_name")
    except Exception:
        # Table may not exist yet on a fresh project.
        return set()
    return {(r.get("fund_name") or "").strip().lower() for r in rows if r.get("fund_name")}


def build_system_prompt():
    return (
        "You are a private markets data research analyst. "
        "For each fund, infer metadata from authoritative public sources and return only valid JSON. "
        "Prefer SEC filings, manager websites, institutional investor documents, and reliable databases. "
        "If a value is not available, return null. Do not invent facts."
    )


def build_user_prompt(batch):
    lines = []
    for i, item in enumerate(batch, start=1):
        vintage = item.get("known_vintage_year")
        lines.append(
            f"{i}. fund_name={item['fund_name']} | asset_class={item['asset_class']} | "
            f"known_vintage_year={vintage if vintage is not None else 'unknown'}"
        )

    return (
        "Enrich the following funds with metadata.\n\n"
        "Sub-category taxonomy:\n"
        f"- Venture Capital: {', '.join(VC_SUB_CATEGORIES)}\n"
        f"- Private Equity (Buyout): {', '.join(BUYOUT_SUB_CATEGORIES)}\n"
        f"- Private Credit: {', '.join(PRIVATE_CREDIT_SUB_CATEGORIES)}\n"
        "- Other asset classes: use General\n\n"
        "Technology sub-verticals for Venture Capital (must include AI where relevant):\n"
        f"- {', '.join(VC_TECH_SUB_VERTICALS)}\n\n"
        "Rules:\n"
        "1) Return one object for each fund in the same order.\n"
        "2) If sector is Technology for a Venture Capital fund, set sub_vertical from the allowed list.\n"
        "3) For non-VC or non-Technology funds, set sub_vertical to null unless clear and useful.\n"
        "4) firm_legal_name and firm_common_name should be GP/manager names when available.\n"
        "5) vintage_year should be the fund vintage if known.\n"
        "6) fund_size_usd should be numeric USD amount (no currency symbols).\n"
        "7) citations should contain source URLs specific to each fund.\n\n"
        "Funds:\n"
        + "\n".join(lines)
    )


def build_response_schema():
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["funds"],
        "properties": {
            "funds": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": [
                        "fund_name",
                        "asset_class",
                        "sub_category",
                        "sector",
                        "sub_vertical",
                        "firm_legal_name",
                        "firm_common_name",
                        "vintage_year",
                        "fund_size_usd",
                        "citations",
                    ],
                    "properties": {
                        "fund_name": {"type": "string"},
                        "asset_class": {"type": ["string", "null"]},
                        "sub_category": {"type": ["string", "null"]},
                        "sector": {"type": ["string", "null"]},
                        "sub_vertical": {"type": ["string", "null"]},
                        "firm_legal_name": {"type": ["string", "null"]},
                        "firm_common_name": {"type": ["string", "null"]},
                        "vintage_year": {"type": ["integer", "null"]},
                        "fund_size_usd": {"type": ["number", "null"]},
                        "citations": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                    },
                },
            }
        },
    }


def call_perplexity(api_key: str, batch: list[dict], model: str, search_mode: str):
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": build_system_prompt()},
            {"role": "user", "content": build_user_prompt(batch)},
        ],
        "temperature": 0,
        "search_mode": search_mode,
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "fund_meta_batch",
                "strict": True,
                "schema": build_response_schema(),
            },
        },
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    resp = requests.post(PERPLEXITY_ENDPOINT, headers=headers, json=payload, timeout=120)
    resp.raise_for_status()
    body = resp.json()

    choices = body.get("choices") or []
    if not choices:
        raise RuntimeError("Perplexity returned no choices.")

    content = (choices[0].get("message") or {}).get("content")
    if not content:
        raise RuntimeError("Perplexity returned empty content.")

    parsed = json.loads(content) if isinstance(content, str) else content
    if not isinstance(parsed, dict) or "funds" not in parsed:
        raise RuntimeError("Perplexity response did not match expected schema.")
    return parsed


def _is_present(value):
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, list):
        return len(value) > 0
    return True


def merge_fund_item(sec_item: dict | None, web_item: dict | None, fund_name: str):
    sec_item = sec_item or {}
    web_item = web_item or {}

    merged = {"fund_name": fund_name}
    fields = [
        "asset_class",
        "sub_category",
        "sector",
        "sub_vertical",
        "firm_legal_name",
        "firm_common_name",
        "vintage_year",
        "fund_size_usd",
    ]

    for field in fields:
        sec_val = sec_item.get(field)
        web_val = web_item.get(field)
        merged[field] = sec_val if _is_present(sec_val) else web_val

    citations = []
    for source in (sec_item.get("citations") or []), (web_item.get("citations") or []):
        for url in source:
            if isinstance(url, str):
                clean = url.strip()
                if clean and clean not in citations:
                    citations.append(clean)
    merged["citations"] = citations
    return merged


def call_perplexity_with_mode(api_key: str, batch: list[dict], model: str, search_mode: str):
    if search_mode != "sec+web":
        return call_perplexity(api_key=api_key, batch=batch, model=model, search_mode=search_mode)

    sec_parsed = call_perplexity(api_key=api_key, batch=batch, model=model, search_mode="sec")
    web_parsed = call_perplexity(api_key=api_key, batch=batch, model=model, search_mode="web")

    sec_by_name = {
        (item.get("fund_name") or "").strip().lower(): item
        for item in sec_parsed.get("funds", [])
        if (item.get("fund_name") or "").strip()
    }
    web_by_name = {
        (item.get("fund_name") or "").strip().lower(): item
        for item in web_parsed.get("funds", [])
        if (item.get("fund_name") or "").strip()
    }

    merged_funds = []
    for requested in batch:
        fund_name = requested["fund_name"]
        key = fund_name.strip().lower()
        merged_funds.append(
            merge_fund_item(
                sec_item=sec_by_name.get(key),
                web_item=web_by_name.get(key),
                fund_name=fund_name,
            )
        )

    return {"funds": merged_funds}


def normalize_string(value):
    if value is None:
        return None
    if not isinstance(value, str):
        value = str(value)
    value = value.strip()
    return value or None


def normalize_meta_row(item: dict, fallback_asset_class: str, fallback_vintage_year: int | None):
    citations = item.get("citations") or []
    if not isinstance(citations, list):
        citations = []
    clean_citations = [c.strip() for c in citations if isinstance(c, str) and c.strip()]

    vintage_year = item.get("vintage_year")
    if not isinstance(vintage_year, int):
        vintage_year = fallback_vintage_year

    fund_size = item.get("fund_size_usd")
    if isinstance(fund_size, int):
        fund_size = float(fund_size)
    if not isinstance(fund_size, float):
        fund_size = None

    return {
        "fund_name": normalize_string(item.get("fund_name")),
        "asset_class": normalize_string(item.get("asset_class")) or fallback_asset_class,
        "sub_category": normalize_string(item.get("sub_category")) or "General",
        "sector": normalize_string(item.get("sector")),
        "sub_vertical": normalize_string(item.get("sub_vertical")),
        "firm_legal_name": normalize_string(item.get("firm_legal_name")),
        "firm_common_name": normalize_string(item.get("firm_common_name")),
        "vintage_year": vintage_year,
        "fund_size_usd": fund_size,
        "perplexity_citations": clean_citations,
        "enriched_at": datetime.now(timezone.utc).isoformat(),
    }


def chunked(items: list, size: int):
    for i in range(0, len(items), size):
        yield items[i : i + size]


def filter_funds_for_scope(funds: list[dict], asset_class_scope: str):
    allowed = ASSET_CLASS_FILTERS[asset_class_scope]
    if allowed is None:
        return funds
    return [f for f in funds if f.get("asset_class") in allowed]


def upsert_meta_rows(sb, rows: list[dict]):
    if not rows:
        return
    try:
        sb.table("fund_meta").upsert(rows, on_conflict="fund_name").execute()
    except Exception as exc:
        raise RuntimeError(
            "Failed to upsert into fund_meta. Ensure the table exists in Supabase by "
            "running pipeline/supabase_schema.sql."
        ) from exc


def main():
    args = parse_args()
    sb = get_supabase_client()
    api_key = get_perplexity_api_key()

    funds = fetch_distinct_funds(sb)
    funds = filter_funds_for_scope(funds, args.asset_class)

    if not args.force:
        existing = fetch_existing_meta_funds(sb)
        funds = [f for f in funds if f["fund_name"].strip().lower() not in existing]

    if args.limit > 0:
        funds = funds[: args.limit]

    if not funds:
        print("No funds to enrich for the current filters.")
        return

    print(f"Selected {len(funds)} funds for enrichment.", flush=True)
    if args.dry_run:
        for f in funds[:20]:
            print(f"- {f['fund_name']} [{f['asset_class']}]")
        if len(funds) > 20:
            print(f"... and {len(funds) - 20} more")
        return

    total = len(funds)
    processed = 0
    success_rows = 0
    failed_batches = 0

    for batch_idx, batch in enumerate(chunked(funds, args.batch_size), start=1):
        print(f"Batch {batch_idx}: enriching {len(batch)} funds...", flush=True)
        try:
            parsed = call_perplexity_with_mode(
                api_key=api_key,
                batch=batch,
                model=args.model,
                search_mode=args.search_mode,
            )
            by_name = {
                (item.get("fund_name") or "").strip().lower(): item
                for item in parsed.get("funds", [])
                if (item.get("fund_name") or "").strip()
            }

            rows = []
            for requested in batch:
                key = requested["fund_name"].strip().lower()
                raw = by_name.get(key)
                if not raw:
                    raw = {"fund_name": requested["fund_name"]}
                normalized = normalize_meta_row(
                    raw,
                    fallback_asset_class=requested.get("asset_class") or "Other",
                    fallback_vintage_year=requested.get("known_vintage_year"),
                )
                # Ensure the canonical fund name from source holdings is preserved.
                normalized["fund_name"] = requested["fund_name"]
                rows.append(normalized)

            upsert_meta_rows(sb, rows)
            success_rows += len(rows)

        except Exception as exc:
            failed_batches += 1
            print(f"  Batch {batch_idx} failed: {exc}", flush=True)

        processed += len(batch)
        print(f"Progress: {processed}/{total} funds processed", flush=True)
        if processed < total:
            time.sleep(args.delay_seconds)

    print("\nEnrichment complete.")
    print(f"- Total funds selected: {total}")
    print(f"- Rows upserted: {success_rows}")
    print(f"- Failed batches: {failed_batches}")


if __name__ == "__main__":
    main()
