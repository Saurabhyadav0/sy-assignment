# GrowEasy AI CSV Importer

AI-powered CSV importer for mapping arbitrary lead CSV exports into the GrowEasy CRM format.

Position applied for: Intern / Full-Time

## Features

- Responsive Next.js frontend with drag and drop CSV upload.
- Client-side preview before any AI processing.
- Sticky, scrollable preview and result tables.
- Confirm step before calling the backend.
- Express API accepting CSV uploads with no fixed column assumptions.
- Batched AI extraction with retry support.
- OpenAI integration when `OPENAI_API_KEY` is configured.
- Heuristic fallback extractor for local demos without an API key.
- Skipped-record reporting when neither email nor mobile number is present.
- Dark, responsive operational UI.

## Tech Stack

- Frontend: Next.js, React, TypeScript, Papa Parse
- Backend: Node.js, Express, TypeScript, csv-parse, OpenAI SDK

## Setup

```bash
npm install
cp backend/.env.example backend/.env
```

Add your OpenAI key to `backend/.env` if you want live AI extraction:

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
```

The app still runs without a key using the local fallback mapper.

## Run Locally

```bash
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:4000

## API

### `POST /api/import`

Accepts multipart form data with a single `file` field containing a CSV.

Returns:

```json
{
  "records": [],
  "skipped": [],
  "totalImported": 0,
  "totalSkipped": 0,
  "usedAi": true
}
```

## Notes

AI extraction is intentionally triggered only after the user clicks Confirm Import. The frontend preview uses local parsing so users can inspect the uploaded data before backend processing begins.
