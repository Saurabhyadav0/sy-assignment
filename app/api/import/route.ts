import { NextRequest, NextResponse } from "next/server";
import { parseCsv } from "../../lib/csv";
import { extractLeads } from "../../lib/aiExtractor";
import type { ImportResponse } from "../../lib/types";

export async function POST(request: NextRequest) {
  try {
    let rows: any[] = [];
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const jsonBody = await request.json();
      rows = jsonBody.rows || [];
    } else {
      const formData = await request.formData();
      const file = formData.get("file");

      if (!file || !(file instanceof File)) {
        return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      rows = parseCsv(buffer);
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "CSV did not contain any data rows" }, { status: 400 });
    }

    const provider = request.headers.get("x-ai-provider") || undefined;
    const openAiApiKey = request.headers.get("x-openai-api-key") || undefined;
    const geminiApiKey = request.headers.get("x-gemini-api-key") || undefined;

    const extraction = await extractLeads(rows, {
      provider,
      openAiApiKey,
      geminiApiKey
    });
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
