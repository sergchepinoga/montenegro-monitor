import { NextRequest, NextResponse } from "next/server";
import { readState, writeState, formatDateRu } from "@/lib/monitor-store";
import { randomUUID } from "crypto";
import { sendTelegram } from "@/lib/telegram";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36";
const TIMEOUT = 14000;

// Map case IDs to search patterns
const CASE_PATTERNS: Record<string, string[]> = {
  "P.24/21":    ["P.24/21", "P 24/21", "24/21"],
  "P.596/22":   ["P.596/22", "P 596/22", "596/22"],
  "P.785/22":   ["P.785/22", "P 785/22", "785/22"],
  "UPI224/22":  ["UPI224/22", "UPI-224", "UPI 224"],
  "Kt.96/25":   ["Kt.96/25", "Kt 96/25", "96/25", "Kt.109/21", "109/21"],
};

// Court URLs to check per case
const COURT_SOURCES = [
  { name: "База решений Коммерческого суда", url: "https://sudovi.me/pscg/odluke/" },
  { name: "Расписание заседаний", url: "https://sudovi.me/pscg/kategorija/Qa" },
  { name: "Расписание (Основной суд)", url: "https://sudovi.me/ospg/rocista" },
];

async function fetchText(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, "Accept": "text/html,*/*;q=0.8", "Accept-Language": "sr,hr;q=0.9,ru;q=0.8,en;q=0.7" },
    });
    clearTimeout(timer);
    const html = await res.text();
    return html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
               .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
               .replace(/<[^>]+>/g, " ")
               .replace(/\s+/g, " ")
               .trim();
  } catch {
    return null;
  }
}

function extractContext(text: string, pattern: string, radius = 200): string[] {
  const results: string[] = [];
  const lower = text.toLowerCase();
  const pat = pattern.toLowerCase();
  let pos = 0;
  while (pos < text.length) {
    const idx = lower.indexOf(pat, pos);
    if (idx === -1) break;
    const start = Math.max(0, idx - radius);
    const end = Math.min(text.length, idx + pat.length + radius);
    results.push(text.slice(start, end).trim());
    pos = idx + pat.length;
    if (results.length >= 3) break;
  }
  return results;
}

function extractDates(text: string): string[] {
  return [...new Set(text.match(/\d{1,2}\.\d{2}\.\d{4}/g) ?? [])].slice(0, 5);
}

interface CaseAgentResult {
  caseId: string;
  found: boolean;
  sources: string[];
  newUpdate: string | null;
  dates: string[];
}

async function checkCase(caseId: string): Promise<CaseAgentResult> {
  const patterns = CASE_PATTERNS[caseId] ?? [caseId];
  const findings: string[] = [];
  let allDates: string[] = [];

  for (const source of COURT_SOURCES) {
    const text = await fetchText(source.url);
    if (!text) continue;

    for (const pattern of patterns) {
      const contexts = extractContext(text, pattern);
      if (contexts.length > 0) {
        const dates = extractDates(contexts.join(" "));
        allDates = [...allDates, ...dates];
        findings.push(`📌 ${source.name}: найдено «${pattern}» → ${contexts[0].slice(0, 200)}`);
        break;
      }
    }
  }

  if (findings.length === 0) {
    return { caseId, found: false, sources: COURT_SOURCES.map(s => s.name), newUpdate: null, dates: [] };
  }

  const uniqueDates = [...new Set(allDates)].slice(0, 5);
  const update = [
    `🤖 Автопроверка агента:`,
    ...findings,
    uniqueDates.length ? `📅 Даты в документах: ${uniqueDates.join(" · ")}` : "",
  ].filter(Boolean).join("\n");

  return { caseId, found: true, sources: COURT_SOURCES.map(s => s.name), newUpdate: update, dates: uniqueDates };
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { caseId?: string; checkAll?: boolean; caseIds?: string[] };
  const state = readState();
  const now = new Date().toISOString();
  const results: CaseAgentResult[] = [];

  const idsToCheck = body.checkAll
    ? Object.keys(CASE_PATTERNS)
    : body.caseIds ?? (body.caseId ? [body.caseId] : []);

  for (const caseId of idsToCheck) {
    const result = await checkCase(caseId);
    results.push(result);

    // Record agent check time regardless of findings
    if (!state.caseUpdates[caseId]) state.caseUpdates[caseId] = [];

    // Only save if something was found AND it's different from the last agent update
    if (result.found && result.newUpdate) {
      const lastAgentUpdate = state.caseUpdates[caseId].find(u => u.source === "🤖 Агент");
      const isDifferent = !lastAgentUpdate || !lastAgentUpdate.text.includes(result.newUpdate.slice(0, 100));

      if (isDifferent) {
        state.caseUpdates[caseId].unshift({
          id: randomUUID(),
          date: now,
          dateRu: formatDateRu(now),
          text: result.newUpdate,
          source: "🤖 Агент",
        });

        // Telegram alert
        await sendTelegram(
          `🤖 <b>Агент нашёл обновление!</b>\n` +
          `Дело: <b>${caseId}</b>\n` +
          `${result.newUpdate.slice(0, 300)}\n` +
          `📅 ${formatDateRu(now)}`
        );
      }
    }

    // Always record last check time in sources
    state.sources[`case_${caseId.replace(/[./]/g, "_")}`] = {
      lastChecked: now,
      status: result.found ? "ok" : "slow",
      httpStatus: 200,
      responseMs: 0,
      note: result.found
        ? `✅ Найдено в базе суда: ${result.dates.join(", ") || "без дат"}`
        : `🔍 Дело ${caseId} не найдено в публичных источниках`,
    };
  }

  state.updatedAt = now;
  writeState(state);

  return NextResponse.json({ ok: true, results, checkedAt: formatDateRu(now) });
}

export async function GET() {
  const state = readState();
  // Return last agent check status for all cases
  const caseStatuses: Record<string, { lastChecked: string | null; found: boolean; note: string }> = {};
  for (const caseId of Object.keys(CASE_PATTERNS)) {
    const key = `case_${caseId.replace(/[./]/g, "_")}`;
    const src = state.sources[key];
    caseStatuses[caseId] = {
      lastChecked: src?.lastChecked ?? null,
      found: src?.status === "ok",
      note: src?.note ?? "Не проверялось",
    };
  }
  return NextResponse.json(caseStatuses);
}
