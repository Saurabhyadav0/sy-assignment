"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import toast from "react-hot-toast";
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Settings,
  RefreshCw,
  Upload,
  XCircle,
  Cpu
} from "lucide-react";

type CsvRow = Record<string, string>;

type CrmRecord = {
  created_at: string;
  name: string;
  email: string;
  country_code: string;
  mobile_without_country_code: string;
  company: string;
  city: string;
  state: string;
  country: string;
  lead_owner: string;
  crm_status: string;
  crm_note: string;
  data_source: string;
  possession_time: string;
  description: string;
};

type SkippedRecord = {
  index: number;
  reason: string;
  raw: CsvRow;
};

type ImportResponse = {
  records: CrmRecord[];
  skipped: SkippedRecord[];
  totalImported: number;
  totalSkipped: number;
  usedAi: boolean;
};

const crmColumns: Array<keyof CrmRecord> = [
  "created_at",
  "name",
  "email",
  "country_code",
  "mobile_without_country_code",
  "company",
  "city",
  "state",
  "country",
  "lead_owner",
  "crm_status",
  "crm_note",
  "data_source",
  "possession_time",
  "description"
];

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "";

function Table({
  columns,
  rows,
  emptyText
}: {
  columns: string[];
  rows: CsvRow[];
  emptyText: string;
}) {
  if (rows.length === 0) {
    return <div className="empty-state">{emptyText}</div>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column) => (
                <td key={column}>{row[column] || ""}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);

  // Settings State
  const [provider, setProvider] = useState<"openai" | "gemini">("openai");
  const [openAiKey, setOpenAiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  // Load settings on mount
  useEffect(() => {
    const savedProvider = localStorage.getItem("crm_ai_provider");
    const savedOpenAiKey = localStorage.getItem("crm_openai_key");
    const savedGeminiKey = localStorage.getItem("crm_gemini_key");

    if (savedProvider === "openai" || savedProvider === "gemini") {
      setProvider(savedProvider);
    }
    if (savedOpenAiKey) setOpenAiKey(savedOpenAiKey);
    if (savedGeminiKey) setGeminiKey(savedGeminiKey);
  }, []);

  const handleProviderChange = (val: "openai" | "gemini") => {
    setProvider(val);
    localStorage.setItem("crm_ai_provider", val);
  };

  const handleOpenAiKeyChange = (val: string) => {
    setOpenAiKey(val);
    localStorage.setItem("crm_openai_key", val);
  };

  const handleGeminiKeyChange = (val: string) => {
    setGeminiKey(val);
    localStorage.setItem("crm_gemini_key", val);
  };

  const previewRows = useMemo(() => rows.slice(0, 100), [rows]);

  function resetImport() {
    setFile(null);
    setRows([]);
    setColumns([]);
    setResult(null);
    setError("");
    setImportProgress(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function parseFile(nextFile: File) {
    setError("");
    setResult(null);
    if (!nextFile.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a valid CSV file.");
      return;
    }

    Papa.parse<CsvRow>(nextFile, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (parseResult) => {
        if (parseResult.errors.length > 0) {
          setError(parseResult.errors[0]?.message || "Could not parse this CSV.");
          return;
        }

        const parsedRows = parseResult.data.filter((row) =>
          Object.values(row).some((value) => String(value ?? "").trim().length > 0)
        );
        const parsedColumns = parseResult.meta.fields?.filter(Boolean) ?? [];

        if (parsedRows.length === 0 || parsedColumns.length === 0) {
          setError("CSV must include a header row and at least one data row.");
          return;
        }

        setFile(nextFile);
        setRows(parsedRows);
        setColumns(parsedColumns);
      },
      error: (parseError) => setError(parseError.message)
    });
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0];
    if (nextFile) parseFile(nextFile);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const nextFile = event.dataTransfer.files?.[0];
    if (nextFile) parseFile(nextFile);
  }

  async function confirmImport() {
    if (rows.length === 0) return;

    setIsImporting(true);
    setError("");
    setResult(null);
    setImportProgress({ current: 0, total: rows.length });

    const batchSize = 20;
    const allRecords: CrmRecord[] = [];
    const allSkipped: SkippedRecord[] = [];
    let finalUsedAi = false;

    try {
      for (let i = 0; i < rows.length; i += batchSize) {
        const chunk = rows.slice(i, i + batchSize);

        let response: Response | null = null;
        let lastError: Error | null = null;
        const attempts = 3;

        for (let attempt = 1; attempt <= attempts; attempt++) {
          try {
            response = await fetch(`${apiBase}/api/import`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-ai-provider": provider,
                "x-openai-api-key": openAiKey,
                "x-gemini-api-key": geminiKey
              },
              body: JSON.stringify({ rows: chunk })
            });
            if (response.ok) {
              lastError = null;
              break;
            } else {
              const errBody = await response.json().catch(() => ({}));
              lastError = new Error(errBody.error || `Batch ${Math.floor(i / batchSize) + 1} failed with status ${response.status}`);
            }
          } catch (err: any) {
            lastError = err instanceof Error ? err : new Error(err?.message || "Connection error");
          }

          if (attempt < attempts) {
            await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
          }
        }

        if (lastError || !response || !response.ok) {
          throw lastError || new Error("Batch processing failed.");
        }

        const body: ImportResponse = await response.json();
        allRecords.push(...body.records);
        allSkipped.push(...body.skipped);
        if (body.usedAi) {
          finalUsedAi = true;
        }

        setImportProgress({ current: Math.min(i + batchSize, rows.length), total: rows.length });
      }

      setResult({
        records: allRecords,
        skipped: allSkipped,
        totalImported: allRecords.length,
        totalSkipped: allSkipped.length,
        usedAi: finalUsedAi
      });

      toast.success(
        `Import completed! Successfully imported ${allRecords.length} records${
          allSkipped.length > 0 ? `, skipped ${allSkipped.length}` : ""
        }.`
      );
    } catch (importError) {
      const errMsg = importError instanceof Error ? importError.message : "Import failed.";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  }

  return (
    <main>
      <section className="topbar">
        <div>
          <p className="eyebrow">GrowEasy CRM</p>
          <h1>AI CSV Importer</h1>
        </div>
        <button 
          className={`icon-button ${showSettings ? "primary" : ""}`} 
          type="button" 
          onClick={() => setShowSettings(!showSettings)}
          title="Configure AI API credentials"
          aria-label="Toggle settings panel"
        >
          <Settings size={18} className={isImporting ? "spin" : ""} />
        </button>
      </section>

      {showSettings && (
        <section className="settings-drawer panel">
          <h3>
            <Cpu size={18} style={{ color: "var(--accent)" }} />
            AI Pipeline Settings
          </h3>
          <p>Configure model endpoints and input custom API keys overrides dynamically. Unset fields will use server-side credentials.</p>
          
          <div className="settings-grid">
            <div className="settings-group">
              <label htmlFor="ai-provider-select">Active AI Provider</label>
              <select 
                id="ai-provider-select" 
                value={provider} 
                onChange={(e) => handleProviderChange(e.target.value as "openai" | "gemini")}
              >
                <option value="openai">OpenAI (gpt-4o-mini)</option>
                <option value="gemini">Google Gemini (gemini-2.5-flash)</option>
              </select>
            </div>

            {provider === "openai" ? (
              <div className="settings-group">
                <label htmlFor="openai-key-input">OpenAI API Key Override</label>
                <input 
                  id="openai-key-input" 
                  type="password" 
                  placeholder="sk-proj-..." 
                  value={openAiKey}
                  onChange={(e) => handleOpenAiKeyChange(e.target.value)}
                />
              </div>
            ) : (
              <div className="settings-group">
                <label htmlFor="gemini-key-input">Gemini API Key Override</label>
                <input 
                  id="gemini-key-input" 
                  type="password" 
                  placeholder="AQ.Ab8RN... or AIzaSy..." 
                  value={geminiKey}
                  onChange={(e) => handleGeminiKeyChange(e.target.value)}
                />
              </div>
            )}
          </div>
        </section>
      )}

      <section className="workspace">
        <div className="panel upload-panel">
          <div
            className={`dropzone ${isDragging ? "dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <FileSpreadsheet size={42} />
            <h2>Upload lead CSV</h2>
            <p>Preview your rows first. AI extraction starts only after confirmation.</p>
            <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={handleFileInput} hidden />
            <button className="primary" type="button" onClick={() => inputRef.current?.click()}>
              <Upload size={18} />
              Choose CSV
            </button>
          </div>

          <div className="side-stats">
            <Stat label="Rows detected" value={rows.length} />
            <Stat label="Columns detected" value={columns.length} />
            <Stat label="Preview limit" value={previewRows.length ? `${previewRows.length} rows` : "Waiting"} />
          </div>
        </div>

        {error && (
          <div className="notice error">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {file && (
          <section className="panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">Step 2</p>
                <h2>{file.name}</h2>
              </div>
              <div className="actions">
                <button className="secondary" type="button" onClick={resetImport}>
                  <RefreshCw size={16} />
                  Reset
                </button>
                <button className="primary" type="button" onClick={confirmImport} disabled={isImporting}>
                  {isImporting ? <Loader2 className="spin" size={18} /> : <CheckCircle2 size={18} />}
                  {isImporting ? "Processing" : "Confirm Import"}
                </button>
              </div>
            </div>
            <Table columns={columns} rows={previewRows} emptyText="Upload a CSV to preview rows." />
          </section>
        )}

        {isImporting && (
          <div className="progress" style={{ flexDirection: "column", alignItems: "stretch", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Loader2 className="spin" size={20} />
              <span>
                Mapping messy columns into GrowEasy CRM fields... 
                {importProgress ? ` (${importProgress.current} / ${importProgress.total} rows)` : ""}
              </span>
            </div>
            {importProgress && (
              <div style={{ width: "100%", height: "6px", background: "rgba(245, 184, 75, 0.2)", borderRadius: "3px", overflow: "hidden", marginTop: "4px" }}>
                <div style={{ width: `${(importProgress.current / importProgress.total) * 100}%`, height: "100%", background: "var(--warning)", transition: "width 0.2s ease" }}></div>
              </div>
            )}
          </div>
        )}

        {result && (
          <section className="panel result-panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">Step 4</p>
                <h2>Parsed CRM records</h2>
              </div>
              <div className="result-stats">
                <Stat label="Imported" value={result.totalImported} />
                <Stat label="Skipped" value={result.totalSkipped} />
                <Stat label="Mode" value={result.usedAi ? "AI" : "Fallback"} />
              </div>
            </div>

            <Table
              columns={crmColumns}
              rows={result.records as unknown as CsvRow[]}
              emptyText="No valid CRM records were produced."
            />

            {result.skipped.length > 0 && (
              <div className="skipped">
                <h3>
                  <XCircle size={18} />
                  Skipped records
                </h3>
                <Table
                  columns={["index", "reason", "raw"]}
                  rows={result.skipped.map((item) => ({
                    index: String(item.index + 1),
                    reason: item.reason,
                    raw: JSON.stringify(item.raw)
                  }))}
                  emptyText="No skipped records."
                />
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
