import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { extractLeads } from "../aiExtractor";
import OpenAI from "openai";

vi.mock("openai", () => {
  const mockCreate = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => {
      return {
        chat: {
          completions: {
            create: mockCreate
          }
        }
      };
    }),
    mockCreate // export to inspect/configure mocks
  };
});

describe("extractLeads", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should fallback to heuristics if OPENAI_API_KEY is not set", async () => {
    delete process.env.OPENAI_API_KEY;
    const rows = [{ Email: "fallback@example.com", Name: "Fallback User" }];
    const result = await extractLeads(rows);

    expect(result.usedAi).toBe(false);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.name).toBe("Fallback User");
  });

  it("should successfully call OpenAI API and process output when key is present", async () => {
    process.env.OPENAI_API_KEY = "test-api-key";

    // Setup mock response
    const mockOpenAIInstance = new OpenAI({ apiKey: "test-api-key" });
    const createMock = mockOpenAIInstance.chat.completions.create as any;
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              records: [
                {
                  created_at: "2026-07-11",
                  name: "AI Lead",
                  email: "ai@example.com",
                  country_code: "+1",
                  mobile_without_country_code: "1234567890",
                  company: "AI Corp",
                  city: "San Francisco",
                  state: "California",
                  country: "USA",
                  lead_owner: "AI Owner",
                  crm_status: "GOOD_LEAD_FOLLOW_UP",
                  crm_note: "Clean note",
                  data_source: "leads_on_demand",
                  possession_time: "",
                  description: ""
                }
              ],
              skipped: []
            })
          }
        }
      ]
    });

    const rows = [{ Email: "ai@example.com", Name: "AI Lead" }];
    const result = await extractLeads(rows);

    expect(result.usedAi).toBe(true);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.name).toBe("AI Lead");
    expect(result.records[0]?.email).toBe("ai@example.com");
  });

  it("should fallback to heuristics if OpenAI API call fails repeatedly", async () => {
    process.env.OPENAI_API_KEY = "test-api-key";

    const mockOpenAIInstance = new OpenAI({ apiKey: "test-api-key" });
    const createMock = mockOpenAIInstance.chat.completions.create as any;
    createMock.mockRejectedValue(new Error("API Error"));

    const rows = [{ Email: "fail@example.com", Name: "Fail Heuristics User" }];
    const result = await extractLeads(rows);

    expect(result.usedAi).toBe(false);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.name).toBe("Fail Heuristics User");
  });

  it("should successfully call Gemini API and process output when GEMINI_API_KEY is present and provider is gemini", async () => {
    process.env.AI_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-gemini-key";

    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  records: [
                    {
                      created_at: "2026-07-11",
                      name: "Gemini Lead",
                      email: "gemini@example.com",
                      country_code: "+91",
                      mobile_without_country_code: "9876543210",
                      company: "Gemini Corp",
                      city: "Delhi",
                      state: "Delhi",
                      country: "India",
                      lead_owner: "Gemini Owner",
                      crm_status: "GOOD_LEAD_FOLLOW_UP",
                      crm_note: "Gemini note",
                      data_source: "eden_park",
                      possession_time: "",
                      description: ""
                    }
                  ],
                  skipped: []
                })
              }
            ]
          }
        }
      ]
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });
    vi.stubGlobal("fetch", fetchMock);

    const rows = [{ Email: "gemini@example.com", Name: "Gemini Lead" }];
    const result = await extractLeads(rows);

    expect(result.usedAi).toBe(true);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.name).toBe("Gemini Lead");
    expect(result.records[0]?.email).toBe("gemini@example.com");

    vi.unstubAllGlobals();
  });
});
