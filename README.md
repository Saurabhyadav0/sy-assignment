# AI-Powered CRM CSV Importer (Next.js Production-Ready)

An AI-powered CSV lead importer built to intelligently map, clean, and extract structured CRM lead information from any valid CSV format (Facebook Ads exports, Google Ads exports, custom agency sheets, etc.) into the GrowEasy CRM schema.

Developed fully in **Next.js (App Router)** as a single-directory unified codebase ready for instant production deployment to **Vercel** with a single click.

## Features

- **Messy Columns AI Mapping**: Dynamically extracts CRM parameters using OpenAI (`gpt-4o-mini`) or Google Gemini (`gemini-2.5-flash`).
- **Private In-Browser Key settings**: Enter your OpenAI or Google Gemini API Key directly in the UI dashboard (stored securely in local storage) to bypass server quota limits easily.
- **Fail-Safe Offline Extractor**: Automatically falls back to custom regular expression heuristics if API keys are missing or LLM requests exceed rate limits.
- **Client-Side Batching**: Batches imports into chunks of 20 rows dynamically, providing live responsive progress bar updates.
- **Robust Retries**: Features built-in fetch retry loops with exponential backoff to handle connection flakes.
- **Outfit Google Font & Glassmorphism design**: Premium, modern visual styling with responsive sticky tables, glows, and custom scrollbars.
- **Zero-Dependency Gemini REST calls**: Native REST integration for Google Gemini requiring zero external NPM packages.
- **Unit Testing Suite**: Includes a full suite of 16 tests covering CSV parsing, heuristics mapping, mock LLM execution, and API routing.

---

## Technical Architecture

- **Frontend**: React 19, Next.js 15, Tailwind-equivalent custom fluid flex/grid panel styling, Lucide Icons, PapaParse.
- **Backend API**: Next.js App Router API Route Handlers (`/api/import`).
- **AI Engine Options**:
  - `openai`: Uses `openai` SDK with `gpt-4o-mini`.
  - `gemini`: Uses standard HTTP client fetching Google Generative Language REST APIs with `gemini-2.5-flash`.
  - `heuristics`: Standard local regular expressions.

---

## How to Setup & Run Locally

### 1. Configure Credentials
Create a `.env.local` file inside the root directory:
```env
# Active provider: 'openai' or 'gemini'
AI_PROVIDER=openai

# OpenAI Keys
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o-mini

# Google Gemini Keys
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.5-flash
```

*Note: You can also leave these completely blank and simply paste your credentials inside the UI Settings Panel (Gear Icon) directly in your browser.*

### 2. Run Development Server
```bash
npm install
npm run dev
```
Open `http://localhost:3000` in your web browser.

### 3. Run Unit Tests
```bash
npm run test
```

### 4. Build Production Bundle
```bash
npm run build
```

---

## Deploying to Vercel

1. Import your GitHub repository into **Vercel**.
2. Vercel automatically detects the Next.js setup at the root. Leave all compilation and build settings as default.
3. In Environment Variables, optionally add your `OPENAI_API_KEY` and `GEMINI_API_KEY`.
4. Click **Deploy**. Your app is live!
