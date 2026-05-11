import { NextRequest, NextResponse } from "next/server";
import { readState, writeState, formatDateRu } from "@/lib/monitor-store";
import { randomUUID } from "crypto";

// POST — add a manual update to a case
export async function POST(req: NextRequest) {
  const body = await req.json() as { caseId: string; text: string; source: string };
  if (!body.caseId || !body.text) {
    return NextResponse.json({ error: "caseId and text required" }, { status: 400 });
  }

  const state = readState();
  if (!state.caseUpdates[body.caseId]) {
    state.caseUpdates[body.caseId] = [];
  }

  const now = new Date().toISOString();
  const update = {
    id: randomUUID(),
    date: now,
    dateRu: formatDateRu(now),
    text: body.text,
    source: body.source || "вручную",
  };

  state.caseUpdates[body.caseId].unshift(update); // newest first
  state.updatedAt = now;
  writeState(state);

  return NextResponse.json({ ok: true, update });
}

// DELETE — remove a specific update
export async function DELETE(req: NextRequest) {
  const { caseId, updateId } = await req.json() as { caseId: string; updateId: string };
  const state = readState();
  if (state.caseUpdates[caseId]) {
    state.caseUpdates[caseId] = state.caseUpdates[caseId].filter(u => u.id !== updateId);
    writeState(state);
  }
  return NextResponse.json({ ok: true });
}
