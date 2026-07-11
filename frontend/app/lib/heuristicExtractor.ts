import type { CrmRecord, CsvRecord, SkippedRecord } from "./types";
import { dataSources } from "./types";

const emptyRecord: CrmRecord = {
  created_at: "",
  name: "",
  email: "",
  country_code: "",
  mobile_without_country_code: "",
  company: "",
  city: "",
  state: "",
  country: "",
  lead_owner: "",
  crm_status: "",
  crm_note: "",
  data_source: "",
  possession_time: "",
  description: ""
};

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const phonePattern = /(?:\+?\d[\d\s().-]{7,}\d)/g;

function normaliseKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findValue(record: CsvRecord, candidates: string[]) {
  const wanted = candidates.map(normaliseKey);
  for (const [key, value] of Object.entries(record)) {
    const normalised = normaliseKey(key);
    if (wanted.some((candidate) => normalised.includes(candidate))) {
      return String(value ?? "").trim();
    }
  }
  return "";
}

function allText(record: CsvRecord) {
  return Object.values(record)
    .map((value) => String(value ?? ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractEmails(record: CsvRecord) {
  const directEmails = valuesByKey(record, ["email", "mail"], ["owner", "assigned", "agent", "salesperson"]).flatMap(
    (value) => value.match(emailPattern) ?? []
  );
  if (directEmails.length > 0) return Array.from(new Set(directEmails));

  const nonOwnerText = Object.entries(record)
    .filter(([key]) => !normaliseKey(key).match(/owner|assigned|agent|salesperson/))
    .map(([, value]) => String(value ?? ""))
    .join(" ");
  return Array.from(new Set(nonOwnerText.match(emailPattern) ?? []));
}

function extractPhones(record: CsvRecord) {
  const directPhones = valuesByKey(record, ["mobile", "phone", "whatsapp", "contactnumber", "number"], []).flatMap(
    (value) => value.match(phonePattern) ?? []
  );
  const source = directPhones.length > 0 ? directPhones : allText(record).match(phonePattern) ?? [];

  return Array.from(new Set(source))
    .filter((phone) => !phone.includes(":") && !/\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(phone))
    .map((phone) => phone.replace(/[^\d+]/g, ""))
    .filter((phone) => phone.replace(/\D/g, "").length >= 8);
}

function valuesByKey(record: CsvRecord, includes: string[], excludes: string[]) {
  const wanted = includes.map(normaliseKey);
  const blocked = excludes.map(normaliseKey);
  return Object.entries(record)
    .filter(([key]) => {
      const normalised = normaliseKey(key);
      return wanted.some((candidate) => normalised.includes(candidate)) &&
        !blocked.some((candidate) => normalised.includes(candidate));
    })
    .map(([, value]) => String(value ?? "").trim())
    .filter(Boolean);
}

function splitPhone(rawPhone: string) {
  const cleaned = rawPhone.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) {
    const digits = cleaned.slice(1);
    if (digits.length > 10) {
      return {
        country_code: `+${digits.slice(0, digits.length - 10)}`,
        mobile_without_country_code: digits.slice(-10)
      };
    }
    return { country_code: cleaned, mobile_without_country_code: "" };
  }
  if (cleaned.length > 10) {
    return {
      country_code: `+${cleaned.slice(0, cleaned.length - 10)}`,
      mobile_without_country_code: cleaned.slice(-10)
    };
  }
  return { country_code: "", mobile_without_country_code: cleaned };
}

function statusFromText(text: string): CrmRecord["crm_status"] {
  const lower = text.toLowerCase();
  if (/(closed|won|sale done|converted|booked|deal)/.test(lower)) return "SALE_DONE";
  if (/(bad|not interested|invalid|spam|junk|wrong)/.test(lower)) return "BAD_LEAD";
  if (/(did not connect|not reachable|no answer|busy|call later|couldn't connect)/.test(lower)) {
    return "DID_NOT_CONNECT";
  }
  if (/(follow|good|interested|hot|warm|qualified|demo|visit)/.test(lower)) {
    return "GOOD_LEAD_FOLLOW_UP";
  }
  return "";
}

function sourceFromText(text: string): CrmRecord["data_source"] {
  const normalised = text.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return dataSources.find((source) => normalised.includes(source)) ?? "";
}

function validDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : value;
}

function appendNote(notes: string[], label: string, values: string[]) {
  if (values.length > 0) notes.push(`${label}: ${values.join(", ")}`);
}

export function extractWithHeuristics(rows: CsvRecord[]) {
  const records: CrmRecord[] = [];
  const skipped: SkippedRecord[] = [];

  rows.forEach((row, index) => {
    const text = allText(row);
    const emails = extractEmails(row);
    const phones = extractPhones(row);
    const firstPhone = phones[0] ?? "";
    const phoneParts = splitPhone(firstPhone);
    const notes = [
      findValue(row, ["remark", "note", "comment", "feedback", "message"])
    ].filter(Boolean);

    appendNote(notes, "Extra emails", emails.slice(1));
    appendNote(notes, "Extra phone numbers", phones.slice(1));

    const record: CrmRecord = {
      ...emptyRecord,
      created_at: validDate(findValue(row, ["created", "date", "timestamp", "submitted", "leadcreated"])),
      name: findValue(row, ["name", "fullname", "customer", "client", "leadname", "contact"]),
      email: emails[0] ?? "",
      country_code: findValue(row, ["countrycode", "dialcode"]) || phoneParts.country_code,
      mobile_without_country_code:
        findValue(row, ["mobile", "phone", "whatsapp", "contactnumber", "number"]).replace(/\D/g, "").slice(-10) ||
        phoneParts.mobile_without_country_code,
      company: findValue(row, ["company", "organisation", "organization", "business", "employer"]),
      city: findValue(row, ["city", "location", "town"]),
      state: findValue(row, ["state", "province", "region"]),
      country: findValue(row, ["country"]),
      lead_owner: findValue(row, ["owner", "assigned", "agent", "salesperson", "executive"]),
      crm_status: statusFromText(text),
      crm_note: notes.join(" | "),
      data_source: sourceFromText(text),
      possession_time: findValue(row, ["possession", "handover", "movein", "timeline"]),
      description: findValue(row, ["description", "requirement", "interest", "property", "project"])
    };

    if (!record.email && !record.mobile_without_country_code) {
      skipped.push({ index, reason: "Missing both email and mobile number", raw: row });
      return;
    }

    records.push(record);
  });

  return { records, skipped };
}
