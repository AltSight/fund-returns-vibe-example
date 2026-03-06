"""
Optional LLM-based classification of fund holdings into asset classes.
Only sends fund names and strategies (small text) — not full PDFs.
Uses OpenAI Structured Outputs to guarantee schema-conformant responses.
"""
import os
from enum import Enum

try:
    from openai import OpenAI
    from pydantic import BaseModel
except ImportError:
    OpenAI = None
    BaseModel = None

ASSET_CLASSES = [
    "Venture Capital",
    "Private Equity",
    "Growth Equity",
    "Real Estate",
    "Private Credit",
    "Infrastructure",
    "Natural Resources",
    "Fund of Funds",
    "Co-Investment",
    "Secondary",
    "Other",
]

KEYWORD_RULES = {
    "venture": "Venture Capital",
    "vc ": "Venture Capital",
    "seed": "Venture Capital",
    "early stage": "Venture Capital",
    "growth equity": "Growth Equity",
    "growth capital": "Growth Equity",
    "buyout": "Private Equity",
    "corporate finance": "Private Equity",
    "leveraged": "Private Equity",
    "mezzanine": "Private Credit",
    "credit": "Private Credit",
    "debt": "Private Credit",
    "real estate": "Real Estate",
    "property": "Real Estate",
    "infrastructure": "Infrastructure",
    "energy": "Natural Resources",
    "oil": "Natural Resources",
    "gas": "Natural Resources",
    "mining": "Natural Resources",
    "fund of funds": "Fund of Funds",
    "fund-of-funds": "Fund of Funds",
    "co-invest": "Co-Investment",
    "coinvest": "Co-Investment",
    "secondary": "Secondary",
    "secondaries": "Secondary",
    "distressed": "Private Credit",
}


# ---------------------------------------------------------------------------
# Pydantic models for Structured Outputs
# ---------------------------------------------------------------------------

if BaseModel is not None:
    class AssetClassEnum(str, Enum):
        venture_capital = "Venture Capital"
        private_equity = "Private Equity"
        growth_equity = "Growth Equity"
        real_estate = "Real Estate"
        private_credit = "Private Credit"
        infrastructure = "Infrastructure"
        natural_resources = "Natural Resources"
        fund_of_funds = "Fund of Funds"
        co_investment = "Co-Investment"
        secondary = "Secondary"
        other = "Other"

    class FundClassification(BaseModel):
        fund_name: str
        asset_class: AssetClassEnum

    class BatchClassificationResponse(BaseModel):
        classifications: list[FundClassification]


# ---------------------------------------------------------------------------
# Classification functions
# ---------------------------------------------------------------------------

def classify_local(fund_name: str, strategy: str | None = None) -> str:
    """Rule-based classification using keywords."""
    combined = f"{fund_name} {strategy or ''}".lower()
    for keyword, cls in KEYWORD_RULES.items():
        if keyword in combined:
            return cls
    return "Private Equity"


def classify_batch_llm(holdings: list[dict]) -> list[dict]:
    """Classify holdings using OpenAI Structured Outputs.

    Sends fund names and strategies in batches of 50, and uses a Pydantic
    response_format to guarantee the model returns valid, enum-constrained
    asset classes. Falls back to keyword classification on any failure.
    """
    if not OpenAI or not BaseModel or not os.getenv("OPENAI_API_KEY"):
        print("No OpenAI key found — using local classification only", flush=True)
        for h in holdings:
            if not h.get("asset_class") or h["asset_class"] == "Private Equity":
                h["asset_class"] = classify_local(h["fund_name"], h.get("strategy"))
        return holdings

    client = OpenAI()
    batch_items = [
        {"name": h["fund_name"], "strategy": h.get("strategy") or ""}
        for h in holdings
    ]

    chunks = [batch_items[i : i + 50] for i in range(0, len(batch_items), 50)]
    results: list[str] = []

    system_prompt = (
        "You are an expert in alternative investments. "
        "Classify each fund into its asset class based on the fund name and strategy. "
        "Return one classification per fund in the same order they are provided."
    )

    for idx, chunk in enumerate(chunks):
        fund_list = "\n".join(
            f"{i+1}. {item['name']}" + (f" (strategy: {item['strategy']})" if item["strategy"] else "")
            for i, item in enumerate(chunk)
        )
        user_prompt = f"Classify these {len(chunk)} funds:\n\n{fund_list}"

        try:
            resp = client.chat.completions.parse(
                model="gpt-5-mini-2025-08-07",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format=BatchClassificationResponse,
            )

            parsed = resp.choices[0].message.parsed
            if parsed and len(parsed.classifications) == len(chunk):
                for c in parsed.classifications:
                    results.append(c.asset_class.value)
                print(f"  Chunk {idx+1}/{len(chunks)}: classified {len(chunk)} funds", flush=True)
            else:
                print(f"  Chunk {idx+1}: count mismatch, falling back to local", flush=True)
                for item in chunk:
                    results.append(classify_local(item["name"], item.get("strategy")))

        except Exception as e:
            print(f"  Chunk {idx+1}: LLM failed ({e}), falling back to local", flush=True)
            for item in chunk:
                results.append(classify_local(item["name"], item.get("strategy")))

    for i, h in enumerate(holdings):
        if i < len(results):
            h["asset_class"] = results[i]
        else:
            h["asset_class"] = classify_local(h["fund_name"], h.get("strategy"))

    return holdings
