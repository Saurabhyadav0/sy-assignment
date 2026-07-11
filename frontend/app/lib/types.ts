export const crmStatuses = [
  "GOOD_LEAD_FOLLOW_UP",
  "DID_NOT_CONNECT",
  "BAD_LEAD",
  "SALE_DONE"
] as const;

export const dataSources = [
  "leads_on_demand",
  "meridian_tower",
  "eden_park",
  "varah_swamy",
  "sarjapur_plots"
] as const;

export type CrmStatus = (typeof crmStatuses)[number];
export type DataSource = (typeof dataSources)[number];

export type CsvRecord = Record<string, string>;

export type CrmRecord = {
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
  crm_status: CrmStatus | "";
  crm_note: string;
  data_source: DataSource | "";
  possession_time: string;
  description: string;
};

export type SkippedRecord = {
  index: number;
  reason: string;
  raw: CsvRecord;
};

export type ImportResponse = {
  records: CrmRecord[];
  skipped: SkippedRecord[];
  totalImported: number;
  totalSkipped: number;
  usedAi: boolean;
};
