import { NextRequest, NextResponse } from "next/server";
import { readState, writeState, formatDateRu } from "@/lib/monitor-store";
import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

async function extractPdfText(buffer: Buffer): Promise<{ text: string; pages: number }> {
  const tmpIn = join(tmpdir(), `mont-pdf-${Date.now()}.pdf`);
  try {
    writeFileSync(tmpIn, buffer);
    const { stdout } = await execFileAsync("pdftotext", [tmpIn, "-"]);
    // Count pages: pdftotext inserts form-feed \f between pages
    const pages = stdout.split("\f").length;
    return { text: stdout, pages };
  } finally {
    try { unlinkSync(tmpIn); } catch { /* ignore */ }
  }
}

function analyzeText(text: string) {
  const lines = text.split(/\n/).map(l => l.trim()).filter(l => l.length > 3);

  // Dates (dd.mm.yyyy)
  const dates = [...new Set(text.match(/\d{1,2}\.\d{2}\.\d{4}/g) ?? [])].slice(0, 10);

  // Case numbers
  const caseNums = [...new Set(text.match(/P[.\s]\s*\d+\/\d+|Kt[.\s]\s*\d+\/\d+|UPI[\w-]+/g) ?? [])].slice(0, 6);

  // Next hearing
  const nextRx = /next hearing[^\n.]{0,80}|ближайшее[^\n.]{0,80}|scheduled for[^\n.]{0,80}/gi;
  const nextHearings = (text.match(nextRx) ?? []).slice(0, 3);

  // Key words for status
  const decisions = lines.filter(l =>
    /judgment|decision|presuda|rješenje|rejected|accepted|odbijen|usvojen|suspended|obustavlj/i.test(l)
  ).slice(0, 4);

  // First meaningful paragraphs (4+ words)
  const summary = lines
    .filter(l => l.split(" ").length >= 4 && l.length < 400)
    .slice(0, 6).join("\n");

  return { dates, caseNums, nextHearings, decisions, summary };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const caseId = formData.get("caseId") as string | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const { text, pages } = await extractPdfText(buffer);
    const a = analyzeText(text);

    // Build Russian summary block
    const now = new Date().toISOString();
    const lines: string[] = [`📄 PDF: «${file.name}» (${pages} стр.)`];
    if (a.dates.length)        lines.push(`📅 Даты: ${a.dates.join("  ·  ")}`);
    if (a.caseNums.length)     lines.push(`⚖️ Дела: ${a.caseNums.join(", ")}`);
    if (a.nextHearings.length) lines.push(`🗓️ Следующее заседание: ${a.nextHearings.join(" · ")}`);
    if (a.decisions.length)    lines.push(`📋 Решения/постановления:\n${a.decisions.map(d => "  • " + d).join("\n")}`);
    if (a.summary)             lines.push(`\nТекст отчёта:\n${a.summary}`);
    const updateText = lines.join("\n");

    // Save to case timeline
    if (caseId) {
      const state = readState();
      if (!state.caseUpdates[caseId]) state.caseUpdates[caseId] = [];
      state.caseUpdates[caseId].unshift({
        id: randomUUID(),
        date: now,
        dateRu: formatDateRu(now),
        text: updateText,
        source: "PDF-отчёт адвоката",
      });
      state.updatedAt = now;
      writeState(state);
    }

    return NextResponse.json({ ok: true, pages, chars: text.length, analysis: a, updateText });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
