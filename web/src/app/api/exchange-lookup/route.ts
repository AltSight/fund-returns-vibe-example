import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

type ExchangeRecord = {
  Name: string;
  Code: string;
  OperatingMIC?: string;
  Country?: string;
  Currency?: string;
  CountryISO2?: string;
  CountryISO3?: string;
};

type LookupResponse = {
  code: string | null;
  name: string | null;
  confidence: "high" | "medium" | "low";
  reason: string;
};

const DATA_PATH = path.resolve(process.cwd(), "..", "data", "exchangedata.json");

async function readExchangeData(): Promise<ExchangeRecord[]> {
  const raw = await fs.readFile(DATA_PATH, "utf8");
  return JSON.parse(raw) as ExchangeRecord[];
}

function localFallbackLookup(
  input: string,
  exchanges: ExchangeRecord[]
): LookupResponse {
  const q = input.trim().toLowerCase();
  if (!q) {
    return {
      code: null,
      name: null,
      confidence: "low",
      reason: "Please enter an exchange name.",
    };
  }

  const exact = exchanges.find(
    (e) => e.Name.toLowerCase() === q || e.Code.toLowerCase() === q
  );
  if (exact) {
    return {
      code: exact.Code,
      name: exact.Name,
      confidence: "high",
      reason: "Exact exchange name/code match.",
    };
  }

  const partial = exchanges.find(
    (e) =>
      e.Name.toLowerCase().includes(q) ||
      q.includes(e.Name.toLowerCase()) ||
      (e.OperatingMIC ?? "").toLowerCase().includes(q)
  );

  if (partial) {
    return {
      code: partial.Code,
      name: partial.Name,
      confidence: "medium",
      reason: "Best partial match from local lookup.",
    };
  }

  return {
    code: null,
    name: null,
    confidence: "low",
    reason: "No close exchange match found.",
  };
}

async function llmLookup(
  input: string,
  exchanges: ExchangeRecord[]
): Promise<LookupResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return localFallbackLookup(input, exchanges);

  const exchangeLines = exchanges
    .map((e) => `${e.Name} | code=${e.Code} | mic=${e.OperatingMIC ?? ""}`)
    .join("\n");

  const prompt = [
    "You are matching a user exchange query to the best exchange code.",
    "Return ONLY strict JSON with keys: code, name, confidence, reason.",
    'confidence must be one of: "high", "medium", "low".',
    "If unsure, choose the most likely result from the provided list.",
    "Do not invent a code that is not in the list.",
    "",
    `User query: ${input}`,
    "",
    "Available exchanges:",
    exchangeLines,
  ].join("\n");

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "exchange_lookup",
          strict: true,
          schema: {
            type: "object",
            properties: {
              code: { type: ["string", "null"] },
              name: { type: ["string", "null"] },
              confidence: { enum: ["high", "medium", "low"] },
              reason: { type: "string" },
            },
            required: ["code", "name", "confidence", "reason"],
            additionalProperties: false,
          },
        },
      },
    }),
  });

  if (!res.ok) {
    return localFallbackLookup(input, exchanges);
  }

  const data = await res.json();
  const outputText = data?.output_text;

  if (!outputText || typeof outputText !== "string") {
    return localFallbackLookup(input, exchanges);
  }

  let parsed: LookupResponse;
  try {
    parsed = JSON.parse(outputText) as LookupResponse;
  } catch {
    return localFallbackLookup(input, exchanges);
  }

  if (!parsed.code) return parsed;

  const matched = exchanges.find((e) => e.Code === parsed.code);
  if (!matched) {
    return {
      code: null,
      name: null,
      confidence: "low",
      reason: "Model returned a code outside known exchanges.",
    };
  }

  return {
    ...parsed,
    name: matched.Name,
  };
}

export async function GET() {
  try {
    const exchanges = await readExchangeData();
    return NextResponse.json({ exchanges });
  } catch (error) {
    console.error("Failed to read exchange data:", error);
    return NextResponse.json(
      { error: "Failed to load exchange data." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { query?: string };
    const query = (body.query ?? "").trim();
    const exchanges = await readExchangeData();

    if (!query) {
      return NextResponse.json(
        { error: "Query is required." },
        { status: 400 }
      );
    }

    const result = await llmLookup(query, exchanges);
    return NextResponse.json({ result });
  } catch (error) {
    console.error("Exchange lookup failed:", error);
    return NextResponse.json(
      { error: "Failed to run exchange lookup." },
      { status: 500 }
    );
  }
}
