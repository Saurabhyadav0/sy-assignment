import { describe, it, expect } from "vitest";
import { extractWithHeuristics } from "../heuristicExtractor";

describe("extractWithHeuristics", () => {
  it("should extract fields correctly for standard inputs", () => {
    const rows = [
      {
        "Full Name": "John Doe",
        "Email Address": "john@example.com",
        "Phone Number": "+919876543210",
        "Company Name": "Acme Corp",
        "City": "Mumbai",
        "State": "Maharashtra",
        "Country": "India",
        "Lead Owner": "Owner A",
        "Remarks": "Interested in pricing plan.",
        "Timeline": "Next month",
        "Requirements": "Need CRM integration."
      }
    ];

    const result = extractWithHeuristics(rows);
    expect(result.records).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);

    const record = result.records[0];
    expect(record?.name).toBe("John Doe");
    expect(record?.email).toBe("john@example.com");
    expect(record?.country_code).toBe("+91");
    expect(record?.mobile_without_country_code).toBe("9876543210");
    expect(record?.company).toBe("Acme Corp");
    expect(record?.city).toBe("Mumbai");
    expect(record?.state).toBe("Maharashtra");
    expect(record?.country).toBe("India");
    expect(record?.lead_owner).toBe("Owner A");
    expect(record?.crm_note).toBe("Interested in pricing plan.");
    expect(record?.possession_time).toBe("Next month");
    expect(record?.description).toBe("Need CRM integration.");
  });

  it("should extract extra emails and phones to note", () => {
    const rows = [
      {
        "Name": "John Doe",
        "Email": "john@example.com",
        "Mobile": "+15555019900, +15555029900",
        "Remarks": "First comment"
      }
    ];

    const result = extractWithHeuristics(rows);
    expect(result.records).toHaveLength(1);
    const record = result.records[0];
    expect(record?.email).toBe("john@example.com");
    expect(record?.mobile_without_country_code).toBe("5555019900");
    expect(record?.crm_note).toContain("First comment");
    expect(record?.crm_note).toContain("Extra phone numbers: +15555029900");
  });

  it("should skip records that miss both email and phone number", () => {
    const rows = [
      {
        "Name": "No Contact John",
        "Company": "No Contact Inc"
      }
    ];

    const result = extractWithHeuristics(rows);
    expect(result.records).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.reason).toBe("Missing both email and mobile number");
  });

  it("should infer status and source from row text content", () => {
    const rows = [
      {
        "Email": "sale@example.com",
        "Status": "Sale done and converted successfully",
        "Source Info": "This lead was obtained from leads_on_demand portal"
      }
    ];

    const result = extractWithHeuristics(rows);
    expect(result.records).toHaveLength(1);
    const record = result.records[0];
    expect(record?.crm_status).toBe("SALE_DONE");
    expect(record?.data_source).toBe("leads_on_demand");
  });
});
