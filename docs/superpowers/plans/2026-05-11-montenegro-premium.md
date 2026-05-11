# Montenegro Asset Monitor — Premium Architecture Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Довести сайт до production-ready 24/7 мониторинга: деплой на Vercel, автоматические проверки каждые 30 мин, Telegram-уведомления, исправление всех статусов источников.

**Architecture:** Next.js 16 App Router + Vercel Edge Runtime для cron, `monitor-state.json` → Vercel KV при деплое, `pdftotext` для парсинга PDF. Агенты scraping через server-side `fetch` с умной обработкой bot-protection.

**Tech Stack:** Next.js 16, TypeScript, Tailwind v4, Vercel (deploy + cron), node-cron (local), pdftotext (system), Telegram Bot API.

---

## Статус на 11.05.2026

✅ Готово: 7-tab dashboard, 5 судебных дел, мониторинг 22 источников, PDF upload, 3D рендеры, Локация + Геокарта, кадастр, реестр, прокуратура.

❌ Не готово: деплой, Telegram, Vercel cron, корректный статус bot-blocked сайтов.

---

### Task 1: Исправить статусы bot-blocked источников

**Files:**
- Modify: `app/api/monitor/route.ts` (строки 49, 65)
- Modify: `app/page.tsx` — StatusBadge компонент

- [ ] В `route.ts` изменить логику статуса:
```typescript
// Было: status: ok ? "ok" : "error"
// Стало:
status: extracted?.botBlocked === 1 ? "slow"
       : ok ? (ms > 6000 ? "slow" : "ok")
       : "error",
```

- [ ] В `page.tsx` обновить StatusBadge — для botBlocked показывать 🔒 янтарный:
```typescript
const isBotBlocked = st?.extracted?.botBlocked === 1;
// label: "🔒 Защита (открыть вручную)"
// bg: "#fef3c7", text: "#92400e"  // amber, не красный
```

- [ ] Подтвердить: Tranio/Properstar/GlobalPropertyGuide → жёлтый 🔒, не красный ❌

---

### Task 2: Git commit + push на GitHub (sergchepinoga)

**Files:** все файлы проекта

- [ ] Проверить аккаунт: `gh auth status` — должен быть `sergchepinoga`
- [ ] Создать репо на GitHub:
```bash
gh repo create sergchepinoga/montenegro-monitor --private --source=. --push
```
- [ ] Добавить `.gitignore` для `monitor-state.json` и `node_modules`:
```
node_modules/
monitor-state.json
.env*.local
.next/
```
- [ ] Commit и push:
```bash
git add -A
git commit -m "feat: Montenegro Asset Monitor v1.0 — 7 tabs, agents, PDF upload"
git push origin main
```

---

### Task 3: Деплой на Vercel → montenegro.chepinoga.com

**Files:** `vercel.json` (создать)

- [ ] Создать `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

- [ ] Создать `/app/api/cron/route.ts` для Vercel Cron:
```typescript
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Trigger monitor check of high-priority sources
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3456";
  await fetch(`${baseUrl}/api/monitor`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      checkAll: true,
      sources: HIGH_PRIORITY_SOURCES  // суды + кадастр + CRPS
    }),
  });
  return NextResponse.json({ ok: true, ran: new Date().toISOString() });
}
```

- [ ] Переключить хранилище с `monitor-state.json` на Vercel KV (для persistence на serverless):
```typescript
// lib/monitor-store.ts — добавить KV fallback:
import { kv } from "@vercel/kv";
// writeState → kv.set("monitor-state", state)
// readState → kv.get("monitor-state") || defaultState
```

- [ ] Деплой через Vercel CLI (аккаунт schepinoga):
```bash
vercel --yes
vercel env add CRON_SECRET production   # случайная строка
```

- [ ] Привязать домен в Vercel Dashboard: `montenegro.chepinoga.com`

---

### Task 4: Telegram-уведомления при изменениях

**Files:**
- Create: `lib/telegram.ts`
- Modify: `app/api/monitor/route.ts`

- [ ] Создать `lib/telegram.ts`:
```typescript
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID!;

export async function sendTelegram(msg: string) {
  if (!BOT_TOKEN || !CHAT_ID) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: msg,
      parse_mode: "HTML",
    }),
  });
}
```

- [ ] В `route.ts` после `writeState(state)` — отправить уведомления:
```typescript
import { sendTelegram } from "@/lib/telegram";

for (const [id, src] of Object.entries(state.sources)) {
  if (src.changed) {
    const name = FLAT_SOURCES.find(s => s.id === id)?.name ?? id;
    await sendTelegram(
      `🔔 <b>Montenegro Monitor</b>\n` +
      `Изменение: <b>${name}</b>\n` +
      `${src.note ?? ""}\n` +
      `📅 ${formatDateRu(src.lastChecked ?? "")}`
    );
  }
}
```

- [ ] Env vars в Vercel Dashboard:
  - `TELEGRAM_BOT_TOKEN` = токен бота
  - `TELEGRAM_CHAT_ID` = ID чата Сергея

---

### Task 5: Исправить eKatastar (таймаут)

**Files:** `lib/scrapers.ts` — функция `scrapeCadastre`

- [ ] Добавить прямой URL к публичному поиску:
```typescript
// Попробовать правильный URL eKatastar
const URLS = [
  "https://ekatastar.me/pretraga",
  "https://ekatastar.me",
  "https://geoportal.co.me",
];
// Пробовать по очереди, вернуть первый успешный
```

- [ ] Добавить ссылку для ручного поиска в summary:
```typescript
summary = `${statusStr} · Поиск LN 977: https://ekatastar.me · КО Бечичи, уч. 634`
```

---

### Task 6: Убрать pdf-parse, унифицировать PDF parsing

**Files:** `package.json`, `app/api/parse-pdf/route.ts`

- [ ] Удалить зависимость:
```bash
npm uninstall pdf-parse @types/pdf-parse
```
- [ ] Подтвердить что `pdftotext` используется везде (уже сделано в route.ts)
- [ ] Для Vercel: добавить `Dockerfile` или использовать `vercel-community/pdftotext` layer
  - **Альтернатива для prod**: использовать `pdfreader` npm (чистый JS, без binary deps):
```bash
npm install pdfreader
```
```typescript
import { PdfReader } from "pdfreader";
// Pure JS, работает в Vercel serverless
```

---

### Task 7: Final QA + commit

- [ ] Проверить все 7 вкладок в браузере
- [ ] Нажать «Запустить проверку всех агентов» — подтвердить зелёные/жёлтые статусы
- [ ] Загрузить реальный PDF → подтвердить извлечение данных
- [ ] Проверить что таймер "Мониторинг: xx:xx" обновляется
- [ ] Final commit:
```bash
git add -A && git commit -m "feat: premium architecture — Vercel deploy, Telegram, cron, bot-protection fix"
git push origin main
```

---

## Приоритеты выполнения

| # | Задача | Важность | Время |
|---|---|---|---|
| 1 | Bot-blocked статусы → жёлтый | 🔴 Срочно | 5 мин |
| 2 | Git + GitHub push | 🔴 Срочно | 10 мин |
| 3 | Vercel деплой + домен | 🔴 Высокая | 20 мин |
| 4 | Telegram уведомления | 🟡 Средняя | 15 мин |
| 5 | eKatastar fix | 🟡 Средняя | 10 мин |
| 6 | PDF на Vercel (pdfreader) | 🟡 Средняя | 10 мин |
| 7 | QA + final commit | 🟢 Завершение | 10 мин |

**Итого: ~80 минут для production-ready сайта**
