import { parse } from "csv-parse/sync";
import type { CsvRecord } from "./types.js";

export function parseCsv(buffer: Buffer): CsvRecord[] {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true
  }) as CsvRecord[];
}
