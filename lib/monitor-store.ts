import fs from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "monitor-state.json");

export interface SourceStatus {
  lastChecked: string | null;
  status: "ok" | "slow" | "error" | "unknown";
  httpStatus: number | null;
  responseMs: number | null;
  note: string | null;
  extracted?: Record<string, string | number | null>;
  changed?: boolean;
}

export interface CaseUpdate {
  id: string;
  date: string;       // ISO timestamp
  dateRu: string;     // Human-readable Russian date
  text: string;
  source: string;     // "адвокат" | "суд" | "кадастр" | "вручную"
}

export interface MonitorState {
  updatedAt: string;
  sources: Record<string, SourceStatus>;
  caseUpdates: Record<string, CaseUpdate[]>;
}

const DEFAULT: MonitorState = {
  updatedAt: "",
  sources: {},
  caseUpdates: {},
};

export function readState(): MonitorState {
  try {
    const raw = fs.readFileSync(FILE, "utf-8");
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT };
  }
}

export function writeState(state: MonitorState): void {
  fs.writeFileSync(FILE, JSON.stringify(state, null, 2), "utf-8");
}

export function formatDateRu(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} в ${hh}:${min}`;
}

export function timeAgoRu(iso: string | null): string {
  if (!iso) return "никогда не проверялось";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1)  return "только что";
  if (mins < 60) return `${mins} мин. назад`;
  if (hrs < 24)  return `${hrs} ч. назад`;
  if (days < 7)  return `${days} дн. назад`;
  return formatDateRu(iso);
}
