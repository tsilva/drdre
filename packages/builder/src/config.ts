export interface BuilderConfig {
  sourceBaseUrl: string;
  workingDirectory: string;
  hotWindowMonths: number;
  shardSize: number;
  adminApiBaseUrl?: string;
  adminToken?: string;
  r2?: {
    endpoint: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
  sqlite?: {
    table?: string;
    columns?: Partial<Record<NormalizedColumnName, string>>;
    officialUrlTemplate?: string;
  };
}

export type NormalizedColumnName =
  | "id"
  | "officialDocId"
  | "publicationDate"
  | "series"
  | "documentType"
  | "number"
  | "title"
  | "summary"
  | "bodyText"
  | "officialUrl";

export const defaultConfig: BuilderConfig = {
  sourceBaseUrl: "https://uploads.tretas.org",
  workingDirectory: "data",
  hotWindowMonths: 24,
  shardSize: 200
};
