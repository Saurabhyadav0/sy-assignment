import "dotenv/config";
import cors from "cors";
import express from "express";
import multer from "multer";
import { parseCsv } from "./csv.js";
import { extractLeads } from "./aiExtractor.js";
import type { ImportResponse } from "./types.js";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024
  }
});

app.use(
  cors({
    origin(origin, callback) {
      const configuredOrigin = process.env.FRONTEND_ORIGIN;
      const localOrigin = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");

      if (!origin || localOrigin || origin === configuredOrigin || (!configuredOrigin && origin === "http://localhost:3000")) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin is not allowed by CORS"));
    }
  })
);
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.post("/api/import", upload.single("file"), async (request, response, next) => {
  try {
    if (!request.file) {
      response.status(400).json({ error: "CSV file is required" });
      return;
    }

    const rows = parseCsv(request.file.buffer);
    if (rows.length === 0) {
      response.status(400).json({ error: "CSV did not contain any data rows" });
      return;
    }

    const extraction = await extractLeads(rows);
    const body: ImportResponse = {
      records: extraction.records,
      skipped: extraction.skipped,
      totalImported: extraction.records.length,
      totalSkipped: extraction.skipped.length,
      usedAi: extraction.usedAi
    };

    response.json(body);
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error(error);
  response.status(500).json({
    error: error instanceof Error ? error.message : "Unexpected server error"
  });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
