import { beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fsPromises } from "fs";

vi.mock("fs", () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

const EXCHANGES_FIXTURE = [
  { Name: "USA Stocks", Code: "US", Country: "USA", Currency: "USD" },
  { Name: "Tokyo Stock Exchange", Code: "TSE", Country: "Japan", Currency: "JPY" },
];

describe("POST /api/dataLookup", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.EXCHANGE_API_TOKEN = "env-exchange-token";
    process.env.INTERNAL_API_KEY = "test";
  });

  it("uses env exchange token and skips FX conversion for US exchange", async () => {
    vi.mocked(fsPromises.readFile).mockResolvedValue(
      JSON.stringify(EXCHANGES_FIXTURE)
    );

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ date: "2024-03-29", adjusted_close: 100 }]),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ date: "2024-06-28", adjusted_close: 120 }]),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ SharesOutstanding: 1000000 }), {
          status: 200,
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("./route");
    const response = await POST({
      json: async () => ({
        apikey: "test",
        ticker: "AAPL",
        exchange: "US",
        quarterEndDate: "2024-03-31",
        currentDate: "2024-06-30",
      }),
    } as never);

    const body = (await response.json()) as {
      fxApplied: boolean;
      quarterEnd: { adjustedCloseUsd: number; fxRateToUsd: number };
      current: {
        adjustedCloseUsd: number;
        fxRateToUsd: number;
        marketCapUsd: number;
      };
    };

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toContain("api_token=env-exchange-token");
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes(".FOREX"))
    ).toBe(false);

    expect(body.fxApplied).toBe(false);
    expect(body.quarterEnd.fxRateToUsd).toBe(1);
    expect(body.current.fxRateToUsd).toBe(1);
    expect(body.quarterEnd.adjustedCloseUsd).toBe(100);
    expect(body.current.adjustedCloseUsd).toBe(120);
    expect(body.current.marketCapUsd).toBe(120000000);
  });
});
