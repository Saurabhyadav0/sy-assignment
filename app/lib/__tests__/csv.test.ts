import { describe, it, expect } from "vitest";
import { parseCsv } from "../csv";

describe("parseCsv", () => {
  it("should parse standard CSV format", () => {
    const csvContent = Buffer.from("name,email,phone\nAlice,alice@example.com,12345678\nBob,bob@example.com,87654321\n");
    const result = parseCsv(csvContent);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: "Alice", email: "alice@example.com", phone: "12345678" });
    expect(result[1]).toEqual({ name: "Bob", email: "bob@example.com", phone: "87654321" });
  });

  it("should normalize BOM characters", () => {
    const csvContent = Buffer.from("\uFEFFname,email\nAlice,alice@example.com\n");
    const result = parseCsv(csvContent);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: "Alice", email: "alice@example.com" });
  });

  it("should trim keys and values", () => {
    const csvContent = Buffer.from(" name , email \n Alice , alice@example.com \n");
    const result = parseCsv(csvContent);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: "Alice", email: "alice@example.com" });
  });

  it("should return empty array for empty csv", () => {
    const csvContent = Buffer.from("");
    const result = parseCsv(csvContent);
    expect(result).toEqual([]);
  });
});
