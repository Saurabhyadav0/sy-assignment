import { describe, it, expect, vi } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";

// Mock the lib modules
vi.mock("../../../lib/aiExtractor", () => {
  return {
    extractLeads: vi.fn().mockImplementation((rows) => {
      return Promise.resolve({
        records: rows.map((row: any) => ({
          name: row.name || "Test User",
          email: row.email || "test@example.com",
          mobile_without_country_code: row.phone || "1234567890"
        })),
        skipped: [],
        usedAi: false
      });
    })
  };
});

describe("POST /api/import Route Handler", () => {
  it("should return 400 if file is missing in form data", async () => {
    const formData = new FormData();
    const req = new NextRequest("http://localhost:3000/api/import", {
      method: "POST",
      body: formData
    });

    const response = await POST(req);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("CSV file is required");
  });

  it("should return 400 if CSV data is empty", async () => {
    const formData = new FormData();
    const emptyFile = new File([""], "empty.csv", { type: "text/csv" });
    formData.append("file", emptyFile);

    const req = new NextRequest("http://localhost:3000/api/import", {
      method: "POST",
      body: formData
    });

    const response = await POST(req);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("CSV did not contain any data rows");
  });

  it("should parse file and return lead records on valid request", async () => {
    const csvContent = "name,email,phone\nJohn,john@example.com,9876543210\n";
    const formData = new FormData();
    const file = new File([csvContent], "leads.csv", { type: "text/csv" });
    formData.append("file", file);

    const req = new NextRequest("http://localhost:3000/api/import", {
      method: "POST",
      body: formData
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.totalImported).toBe(1);
    expect(body.records[0]).toEqual({
      name: "John",
      email: "john@example.com",
      mobile_without_country_code: "9876543210"
    });
  });
});
