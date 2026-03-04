"""
Optional LLM-based classification of fund holdings into asset classes.
Only sends fund names and strategies (small text) — not full PDFs.
"""
import os
import json

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

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


def classify_local(fund_name: str, strategy: str | None = None) -> str:
    """Rule-based classification using keywords."""
    combined = f"{fund_name} {strategy or ''}".lower()
    for keyword, cls in KEYWORD_RULES.items():
        if keyword in combined:
            return cls
    return "Private Equity"


def classify_batch_llm(holdings: list[dict]) -> list[dict]:
    """Use OpenAI to classify a batch of holdings. Sends only names + strategies."""
    if not OpenAI or not os.getenv("OPENAI_API_KEY"):
        print("No OpenAI key found — using local classification only")
        for h in holdings:
            if not h.get("asset_class") or h["asset_class"] == "Private Equity":
                h["asset_class"] = classify_local(h["fund_name"], h.get("strategy"))
        return holdings

    client = OpenAI()
    batch_items = [
        {"name": h["fund_name"], "strategy": h.get("strategy", "")}
        for h in holdings
    ]

    chunks = [batch_items[i : i + 50] for i in range(0, len(batch_items), 50)]
    results = []

    for chunk in chunks:
        prompt = f"""Classify each fund into one of these asset classes:
{json.dumps(ASSET_CLASSES)}

Funds to classify:
{json.dumps(chunk, indent=2)}

Return a JSON array of strings, one classification per fund, same order. Only return the JSON array."""

        try:
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
            )
            classes = json.loads(resp.choices[0].message.content)
            results.extend(classes)
        except Exception as e:
            print(f"LLM classification failed: {e}, falling back to local")
            for item in chunk:
                results.append(classify_local(item["name"], item.get("strategy")))

    for i, h in enumerate(holdings):
        if i < len(results):
            h["asset_class"] = results[i]
        else:
            h["asset_class"] = classify_local(h["fund_name"], h.get("strategy"))

    return holdings
