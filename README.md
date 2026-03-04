# Alternative Assets Returns Tracker

Goal of this project is to show how 20 minutes of vibe coding can create something that works. We started with some PDFs and pasted the below prompt into Cursor.

AltSight's workflow usually looks like V0.dev for UI and cursor for backend work. We leverage linear to write tickets and have cursor take on the code changes.

Prompt:

```
Please create a simple workflow that looks at private equity and venture capital financial reports from pensions and then uses local processing to pull data out of PDFs and store information about the report downloaded (Pension fund, date, url) and then information in the report. pension fund, as of quarter, security, cost, market value, type of security, tvpi, dpi, rate, etc. We will want to store this data in a database. We are trying to understand returns of only "alternative asset funds" such as venture capital, private equity, growth equity and real estate.We will want to make sure we capture each document and store information about that document down that matter such as the reporting date and type of document. We only care about documents that capture information about the underlying assets. We will want to use local processing techniques and then only send smaller amounts of data to llms for further processing. I want this viewable in a simple next.js app so i can filter by asset classes and look at returns. Eventually I will want to pull in other quarters of data to see how things change.

```

Extract, store, and visualize private equity, venture capital, and alternative asset performance data from public pension fund reports.

## Architecture

```
Fund_returns/
├── pipeline/          # Python ETL: PDF → SQLite
│   ├── run_pipeline.py    # Main entry point
│   ├── parsers.py         # Local PDF parsers (CalSTRS, WSIB, NY State)
│   ├── classify.py        # Asset class classification (local rules + optional LLM)
│   ├── db.py              # Database init and connection
│   └── requirements.txt
├── Funds Data/        # Drop PDF reports here
├── data/              # SQLite database (auto-created)
│   └── funds.db
└── web/               # Next.js dashboard
    └── src/
        ├── app/           # Pages and API routes
        ├── components/    # UI components
        └── lib/           # Database helpers
```

## Quick Start

### 1. Process PDFs

```bash
cd Fund_returns
python3 -m venv .venv && source .venv/bin/activate
pip install -r pipeline/requirements.txt

# Drop pension fund PDF reports into "Funds Data/"
cd pipeline && python run_pipeline.py
```

The pipeline auto-detects report format (CalSTRS, WSIB, NY State) and extracts fund-level data locally without calling any external APIs.

To also classify funds using OpenAI (optional):

```bash
export OPENAI_API_KEY=sk-...
python run_pipeline.py --llm
```

### 2. Run the Dashboard

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000

## Data Model

**documents** — metadata about each processed PDF:

- pension_fund, report_date, document_type, filename, source_url

**fund_holdings** — individual fund-level records:

- fund_name, pension_fund, as_of_date, asset_class, strategy
- vintage_year, commitment, contributed, distributed, market_value
- irr, tvpi, dpi, total_value, unfunded

## Supported Report Formats

| Pension Fund | Format                          | Fields                                                                                            |
| ------------ | ------------------------------- | ------------------------------------------------------------------------------------------------- |
| CalSTRS      | PE Portfolio Performance        | Fund, Vintage Year, Committed, Contributed, Distributed, Market Value, IRR                        |
| WSIB         | Performance Summary By Strategy | Fund, Date, Committed, Paid-In, Unfunded, Market Value, Distributed, Total Value, TVPI, Gain, IRR |
| NY State     | Asset Listing                   | Auto-detected tabular                                                                             |

## Adding New Data

1. Download a pension fund PE/VC performance report PDF
2. Drop it into `Funds Data/`
3. Re-run `python run_pipeline.py`
4. The pipeline skips already-processed files

To add a new pension fund format, add a parser function in `pipeline/parsers.py`.
