import OpenAI from "openai";
import { z } from "zod";
import { extractWithHeuristics } from "./heuristicExtractor";
import { crmStatuses, dataSources, type CrmRecord, type CsvRecord, type SkippedRecord } from "./types";

const crmRecordSchema = z.object({
  created_at: z.string().default(""),
  name: z.string().default(""),
  email: z.string().default(""),
  country_code: z.string().default(""),
  mobile_without_country_code: z.string().default(""),
  company: z.string().default(""),
  city: z.string().default(""),
  state: z.string().default(""),
  country: z.string().default(""),
  lead_owner: z.string().default(""),
  crm_status: z.union([z.enum(crmStatuses), z.literal("")]).default(""),
  crm_note: z.string().default(""),
  data_source: z.union([z.enum(dataSources), z.literal("")]).default(""),
  possession_time: z.string().default(""),
  description: z.string().default("")
});

const aiResponseSchema = z.object({
  records: z.array(crmRecordSchema),
  skipped: z.array(
    z.object({
      index: z.number(),
      reason: z.string(),
      raw: z.record(z.string())
    })
  )
});

const systemPrompt = `You extract CRM leads from arbitrary CSV rows into GrowEasy CRM JSON.

Return only valid JSON with this shape:
{
  "records": [
    {
      "created_at": "",
      "name": "",
      "email": "",
      "country_code": "",
      "mobile_without_country_code": "",
      "company": "",
      "city": "",
      "state": "",
      "country": "",
      "lead_owner": "",
      "crm_status": "",
      "crm_note": "",
      "data_source": "",
      "possession_time": "",
      "description": ""
    }
  ],
  "skipped": [{ "index": 0, "reason": "", "raw": {} }]
}

Rules:
- Do not assume fixed CSV column names. Infer intent from headers and values.
- Skip a row if it has neither an email nor a mobile number.
- Use the first email as email and append any extra emails to crm_note.
- Use the first mobile as mobile_without_country_code and append any extra numbers to crm_note.
- Split country code from mobile when obvious.
- crm_status must be one of GOOD_LEAD_FOLLOW_UP, DID_NOT_CONNECT, BAD_LEAD, SALE_DONE, or blank.
- data_source must be one of leads_on_demand, meridian_tower, eden_park, varah_swamy, sarjapur_plots, or blank.
- created_at must be parseable by JavaScript new Date(created_at), or blank.
- crm_note should contain remarks, follow-up notes, extra contacts, and useful leftovers.
- Keep each field single-line. Escape newlines as \\n when necessary.
- Keep each output record aligned to the original row index supplied in the input.`;

const batchSize = 20;

function chunkRows(rows: CsvRecord[]) {
  const chunks: Array<Array<{ index: number; row: CsvRecord }>> = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    chunks.push(rows.slice(i, i + batchSize).map((row, offset) => ({ index: i + offset, row })));
  }
  return chunks;
}

function cleanRecord(record: z.infer<typeof crmRecordSchema>): CrmRecord {
  return {
    created_at: record.created_at,
    name: record.name,
    email: record.email,
    country_code: record.country_code,
    mobile_without_country_code: record.mobile_without_country_code.replace(/\D/g, "").slice(-15),
    company: record.company,
    city: record.city,
    state: record.state,
    country: record.country,
    lead_owner: record.lead_owner,
    crm_status: record.crm_status,
    crm_note: record.crm_note.replace(/\r?\n/g, "\\n"),
    data_source: record.data_source,
    possession_time: record.possession_time,
    description: record.description.replace(/\r?\n/g, "\\n")
  };
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
      }
    }
  }
  throw lastError;
}

async function extractBatch(client: OpenAI, model: string, batch: Array<{ index: number; row: CsvRecord }>) {
  const response = await withRetry(() =>
    client.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify({
            rows: batch
          })
        }
      ]
    })
  );

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("AI returned an empty response");
  return aiResponseSchema.parse(JSON.parse(content));
}

export async function extractLeads(rows: CsvRecord[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!apiKey) {
    return { ...extractWithHeuristics(rows), usedAi: false };
  }

  const client = new OpenAI({ apiKey });
  const records: CrmRecord[] = [];
  const skipped: SkippedRecord[] = [];

  try {
    for (const batch of chunkRows(rows)) {
      const result = await extractBatch(client, model, batch);
      records.push(...result.records.map(cleanRecord));
      skipped.push(...result.skipped);
    }

    return { records, skipped, usedAi: true };
  } catch (error) {
    console.error("AI extraction failed, using fallback extractor", error);
    return { ...extractWithHeuristics(rows), usedAi: false };
  }
}
