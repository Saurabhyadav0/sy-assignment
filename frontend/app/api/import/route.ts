import { NextRequest, NextResponse } from "next/server";
import { parseCsv } from "../../lib/csv";
import { extractLeads } from "../../lib/aiExtractor";
import type { ImportResponse } from "../../lib/types";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseCsv(buffer);

    if (rows.length === 0) {
      return NextResponse.json({ error: "CSV did not contain any data rows" }, { status: 400 });
    }

    const extraction = await extractLeads(rows);
    const body: ImportResponse = {
      records: extraction.records,
      skipped: extraction.skipped,
      totalImported: extraction.records.length,
      totalSkipped: extraction.skipped.length,
      usedAi: extraction.usedAi
    };

    return NextResponse.json(body);
  } catch (error: any) {
    console.error("Import API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error" },
      { status: 500 }
    );
  }
}
