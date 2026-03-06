"""
Local PDF parsers for different pension fund report formats.
Each parser extracts structured fund-level data without calling any LLM.
"""
import re
import pdfplumber


def parse_pdf(filepath: str, max_pages: int = 500) -> dict:
    """Auto-detect format and parse a pension fund PDF into structured data."""
    page_count = _get_page_count(filepath)
    if page_count > max_pages:
        print(f"    Skipping {filepath}: {page_count} pages exceeds max {max_pages}")
        return {
            "pension_fund": "Unknown",
            "report_date": "",
            "document_type": "Skipped - too large",
            "page_count": page_count,
            "holdings": [],
        }
    text = _extract_full_text(filepath)

    if "CalSTRS" in text or "California State Teachers" in text:
        return _parse_calstrs(text, page_count)
    elif "Washington State Investment Board" in text or "WSIB" in text:
        return _parse_wsib(text, page_count)
    elif "New York" in text or "NY State" in text or "NYSCRF" in text or "Comptroller" in text:
        return _parse_ny_state(text, page_count)
    else:
        return _parse_generic(text, page_count)


def _extract_full_text(filepath: str) -> str:
    pages = []
    with pdfplumber.open(filepath) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                pages.append(t)
    return "\n".join(pages)


def _get_page_count(filepath: str) -> int:
    with pdfplumber.open(filepath) as pdf:
        return len(pdf.pages)


def _clean_number(val: str) -> float | None:
    if not val or val.strip() in ("-", "N/A", "", "0.00"):
        return None
    val = val.strip().replace(",", "").replace("$", "").replace("%", "")
    val = val.replace("(", "-").replace(")", "")
    try:
        return float(val)
    except ValueError:
        return None


def _split_concatenated_numbers(s: str) -> list[str]:
    """Split a string of concatenated numbers that pdfplumber merges together.
    E.g. "300,000,000286,499,68683,342,471392,061,65014.75"
    Strategy: tokenize character by character, tracking comma-separated groups.
    A new number starts when we see a digit after ,ddd that doesn't have a comma next.
    Also handles '-' as a zero/null value and parenthesized negatives.
    """
    tokens = []
    s = s.strip()
    if not s:
        return tokens

    parts = re.split(r"\s+", s)
    result = []
    for part in parts:
        if part == "-":
            result.append("-")
            continue
        if part.startswith("(") and part.endswith(")"):
            result.append(part)
            continue
        # Split on parenthesized negatives: "8,444,992(4.53)" -> "8,444,992" + "(4.53)"
        paren_parts = re.split(r"(?<=\d)(\([^)]+\))", part)
        for pp in paren_parts:
            pp = pp.strip()
            if not pp:
                continue
            if pp.startswith("(") and pp.endswith(")"):
                result.append(pp)
            else:
                result.extend(_split_merged_nums(pp))
    return result


def _split_merged_nums(s: str) -> list[str]:
    """Split numbers that are merged without any separator.
    In a properly comma-formatted number (e.g. "1,234,567"), commas appear
    every 3 digits. At a boundary between two merged numbers, the pattern
    ",ddd" is followed by a digit instead of a comma. That digit starts
    the next number.
    """
    if not s:
        return []

    nums = []
    current = ""
    i = 0
    while i < len(s):
        ch = s[i]
        current += ch

        # Boundary: current ends with ",ddd" and next char is a digit (not comma).
        # In a single number, after ",ddd" the next char would be "," for another
        # group. A digit means a new number starts.
        if (len(current) >= 4 and current[-4] == "," and
                current[-3:].isdigit() and
                i + 1 < len(s) and s[i + 1].isdigit()):
            nums.append(current)
            current = ""

        i += 1

    if current:
        nums.append(current)

    # Post-process: split cases where a large integer is followed by a decimal
    # IRR value, e.g. "345,210,82015.02" -> ["345,210,820", "15.02"]
    final = []
    for n in nums:
        m = re.match(r"^([\d,]+?)(\d{1,2}\.\d{2})$", n)
        if m and len(m.group(1)) > 3:
            final.append(m.group(1))
            final.append(m.group(2))
        else:
            final.append(n)
    return final


def _parse_calstrs(text: str, page_count: int) -> dict:
    """Parse CalSTRS Private Equity Portfolio Performance format.
    Data is space-separated. We find the vintage year (4-digit year) and use it
    as the anchor to split fund name from numeric columns.
    """
    as_of_match = re.search(r"As of\s+(\w+\s+\d{1,2},?\s+\d{4})", text)
    as_of_date = as_of_match.group(1).strip() if as_of_match else ""

    holdings = []
    lines = text.split("\n")

    skip_patterns = [
        "California State", "Private Equity", "CalSTRS", "Since",
        "Capital", "Description", "limited partnership", "IRR calculation",
        "Importantly", "difficult", "timing", "Additionally", "typically",
        "of a partnership", "liquidation", "the Funds", "-- ",
    ]

    vy_pattern = re.compile(
        r"^(.+?)\s+((?:19|20)\d{2})\s+([\d,.\-() ]+)$"
    )

    for line in lines:
        line = line.strip()
        if not line or line.startswith("*"):
            continue
        if any(skip in line for skip in skip_patterns):
            continue

        m = vy_pattern.match(line)
        if not m:
            continue

        name = m.group(1).strip()
        vy = int(m.group(2))
        nums_str = m.group(3).strip()

        # pdfplumber may insert spaces inside numbers; apply repeatedly for
        # consecutive breaks like "647 4 0,479"
        while True:
            fixed = re.sub(r"(\d) (\d)", r"\1\2", nums_str)
            if fixed == nums_str:
                break
            nums_str = fixed

        # Numbers may be concatenated: "300,000,000286,499,68683,342,471392,061,65014.75"
        # Split at boundaries where a digit is immediately followed by a non-comma digit
        # that starts a new number. Heuristic: split where ,ddd is followed by a non-comma digit.
        raw_nums = _split_concatenated_numbers(nums_str)
        nums = [_clean_number(n) for n in raw_nums]

        if len(nums) < 3:
            continue

        committed = nums[0]
        contributed = nums[1]
        distributed = nums[2] if len(nums) > 2 else None
        market_value = nums[3] if len(nums) > 3 else None
        irr = nums[4] if len(nums) > 4 else None

        if committed is None and contributed is None:
            continue

        tvpi = None
        dpi = None
        if contributed and contributed > 0:
            total = (distributed or 0) + (market_value or 0)
            tvpi = round(total / contributed, 2)
            dpi = round((distributed or 0) / contributed, 2)
            # TVPI/DPI above 100x indicates a parsing error; set to None
            if tvpi is not None and tvpi > 100:
                tvpi = None
            if dpi is not None and dpi > 100:
                dpi = None

        holdings.append({
            "fund_name": name,
            "vintage_year": vy,
            "commitment": committed,
            "contributed": contributed,
            "distributed": distributed,
            "market_value": market_value,
            "irr": irr,
            "tvpi": tvpi,
            "dpi": dpi,
            "asset_class": None,
            "strategy": None,
            "initial_investment_date": None,
            "unfunded": None,
            "total_value": None,
            "gain_since_inception": None,
        })

    return {
        "pension_fund": "CalSTRS",
        "report_date": as_of_date,
        "document_type": "Private Equity Portfolio Performance",
        "page_count": page_count,
        "holdings": holdings,
    }


def _parse_wsib(text: str, page_count: int) -> dict:
    """Parse Washington State Investment Board format.
    Organized by strategy with columns: Investment Name, Initial Investment Date,
    Capital Committed, Paid-In Capital, Unfunded, Market Value, Distributed,
    Total Value, TVPI, Gain, Net IRR
    """
    as_of_match = re.search(r"As of\s+(\w+\s+\d{1,2},?\s+\d{4})", text)
    as_of_date = as_of_match.group(1).strip() if as_of_match else ""

    holdings = []
    current_strategy = None
    lines = text.split("\n")

    strategy_pattern = re.compile(
        r"^(Corporate Finance/Buyout\s*-\s*\w+|Distressed Debt|Growth Equity|"
        r"Mezzanine|Real Estate\s*-\s*\w+|Co-Investment|Special Situation|"
        r"Venture Capital)\s*$",
        re.IGNORECASE,
    )
    asset_class_map = {
        "corporate finance/buyout": "Private Equity",
        "distressed debt": "Private Equity",
        "growth equity": "Growth Equity",
        "mezzanine": "Private Equity",
        "real estate": "Real Estate",
        "co-investment": "Private Equity",
        "special situation": "Private Equity",
        "venture capital": "Venture Capital",
    }

    for line in lines:
        line = line.strip()
        if not line:
            continue

        strat_match = strategy_pattern.match(line)
        if strat_match:
            current_strategy = strat_match.group(1).strip()
            continue

        if any(skip in line for skip in [
            "Washington State", "Performance Summary", "Investment Name",
            "Hamilton Lane", "Subtotal", "Total Portfolio", "Capital",
            "Paid-In", "Unfunded", "Current", "Distributed", "Total Value",
            "Gain Since", "Net", "IRR (2)", "(1)", "(2)", "-- ",
            "There is a quarter", "The IRRs contained", "generally",
            "NOTE:", "comparisons", "differences", "lack of",
        ]):
            continue

        date_match = re.search(r"(\d{1,2}/\d{1,2}/\d{4})", line)
        na_date = "N/A" in line and not date_match

        if not date_match and not na_date:
            continue

        inv_date = date_match.group(1) if date_match else None

        if date_match:
            name = line[:date_match.start()].strip()
            rest = line[date_match.end():].strip()
        else:
            na_idx = line.index("N/A")
            name = line[:na_idx].strip()
            rest = line[na_idx + 3:].strip()

        # Capture all tokens including standalone dashes for column alignment
        tokens = re.findall(r"(?:[(\-]?[\d,]+(?:\.\d+)?[)%x]*|(?<!\w)-(?!\w))", rest)

        tvpi_val = None
        irr_val = None
        for t in tokens:
            if "x" in t.lower() and any(c.isdigit() for c in t):
                tvpi_val = _clean_number(t.replace("x", "").replace("X", ""))
            if "%" in t:
                irr_val = _clean_number(t)

        # Column order: Committed, Paid-In, Unfunded, Market Value, Distributed,
        #               Total Value, TVPI, Gain, IRR
        positional = []
        for t in tokens:
            if "x" in t.lower() or "%" in t:
                continue
            positional.append(_clean_number(t))

        if len(positional) < 5:
            continue

        committed = positional[0]
        paid_in = positional[1]
        unfunded = positional[2]
        mv = positional[3]
        dist = positional[4]
        total_val = positional[5] if len(positional) > 5 else None
        gain = positional[6] if len(positional) > 6 else None

        if tvpi_val is None and paid_in and paid_in > 0 and total_val:
            tvpi_val = round(total_val / paid_in, 2)

        dpi_val = None
        if paid_in and paid_in > 0 and dist:
            dpi_val = round(dist / paid_in, 2)

        # TVPI/DPI above 100x indicates a parsing error; set to None
        if tvpi_val is not None and tvpi_val > 100:
            tvpi_val = None
        if dpi_val is not None and dpi_val > 100:
            dpi_val = None

        strategy_lower = (current_strategy or "").lower()
        asset_class = "Private Equity"
        for key, val in asset_class_map.items():
            if key in strategy_lower:
                asset_class = val
                break

        holdings.append({
            "fund_name": name,
            "vintage_year": None,
            "commitment": committed,
            "contributed": paid_in,
            "distributed": dist,
            "market_value": mv,
            "irr": irr_val,
            "tvpi": tvpi_val,
            "dpi": dpi_val,
            "asset_class": asset_class,
            "strategy": current_strategy,
            "initial_investment_date": inv_date,
            "unfunded": unfunded,
            "total_value": total_val,
            "gain_since_inception": gain,
        })

    return {
        "pension_fund": "Washington State Investment Board",
        "report_date": as_of_date,
        "document_type": "Private Equity Performance Summary By Strategy",
        "page_count": page_count,
        "holdings": holdings,
    }


def _parse_ny_state(text: str, page_count: int) -> dict:
    """Parse NY State Common Retirement Fund format."""
    as_of_match = re.search(r"As of\s+(\w+\s+\d{1,2},?\s+\d{4})", text)
    if not as_of_match:
        as_of_match = re.search(r"(\w+\s+\d{1,2},?\s+\d{4})", text[:500])
    as_of_date = as_of_match.group(1).strip() if as_of_match else ""

    holdings = []
    lines = text.split("\n")
    current_strategy = None

    for line in lines:
        line = line.strip()
        if not line:
            continue

        if re.match(r"^[A-Z][A-Z &/\-]+$", line) and len(line) > 3:
            current_strategy = line.title()
            continue

        numbers = re.findall(r"[(\-]?[\$]?[\d,]+(?:\.\d+)?[)%x]?", line)
        if len(numbers) < 3:
            continue

        name_end = 0
        for m in re.finditer(r"[(\-]?[\$]?[\d,]+(?:\.\d+)?[)%x]?", line):
            name_end = m.start()
            break

        name = line[:name_end].strip()
        if not name or len(name) < 3:
            continue

        nums = [_clean_number(n) for n in numbers]
        if all(n is None for n in nums[:3]):
            continue

        committed = nums[0] if len(nums) > 0 else None
        contributed = nums[1] if len(nums) > 1 else None
        distributed = nums[2] if len(nums) > 2 else None
        mv = nums[3] if len(nums) > 3 else None
        irr_val = None
        tvpi_val = None

        for n_str in numbers:
            if "%" in n_str:
                irr_val = _clean_number(n_str)
            if "x" in n_str.lower():
                tvpi_val = _clean_number(n_str.replace("x", "").replace("X", ""))

        dpi_val = None
        if contributed and contributed > 0 and distributed:
            dpi_val = round(distributed / contributed, 2)
        if tvpi_val is None and contributed and contributed > 0:
            total = (distributed or 0) + (mv or 0)
            tvpi_val = round(total / contributed, 2)

        # TVPI/DPI above 100x indicates a parsing error; set to None
        if tvpi_val is not None and tvpi_val > 100:
            tvpi_val = None
        if dpi_val is not None and dpi_val > 100:
            dpi_val = None

        holdings.append({
            "fund_name": name,
            "vintage_year": None,
            "commitment": committed,
            "contributed": contributed,
            "distributed": distributed,
            "market_value": mv,
            "irr": irr_val,
            "tvpi": tvpi_val,
            "dpi": dpi_val,
            "asset_class": None,
            "strategy": current_strategy,
            "initial_investment_date": None,
            "unfunded": None,
            "total_value": None,
            "gain_since_inception": None,
        })

    return {
        "pension_fund": "NY State Common Retirement Fund",
        "report_date": as_of_date,
        "document_type": "Asset Listing",
        "page_count": page_count,
        "holdings": holdings,
    }


def _parse_generic(text: str, page_count: int) -> dict:
    """Fallback parser that tries to find tabular data."""
    return {
        "pension_fund": "Unknown",
        "report_date": "",
        "document_type": "Unknown",
        "page_count": page_count,
        "holdings": [],
    }
