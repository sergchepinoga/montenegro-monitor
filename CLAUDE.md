# Montenegro Asset Monitor — CLAUDE.md

## CRITICAL: Project Identity
- **Это НЕ CHEVORA и НЕ AGON** — отдельный личный проект Сергея
- Всегда работать из папки `/Users/chepinoga/GitHub-Agon/montenegro-app/`
- GitHub: `sergchepinoga/montenegro-monitor` (аккаунт `sergchepinoga`, НЕ chevora, НЕ Agonsg)
- Vercel: аккаунт `schepinoga` / workspace `schepinogas-projects`

## URLs
- **Prod:** `https://montenegro.chepinoga.com` ✅
- **Vercel alias:** `https://montenegro-app.vercel.app`
- **Dev:** `npm run dev -- --port 3456` → http://localhost:3456

## Tokens (хранить в памяти, НЕ в коде)
- Vercel token: в `project_journey_yerevan.md` памяти → `vcp_1OTM...`
- GitHub PAT sergchepinoga (classic): `ghp_***[в памяти Claude]`
- Telegram bot token: `***[в памяти Claude]`
- Deploy: `vercel --token vcp_... --yes --scope schepinogas-projects --prod`
- Git push: `git push "https://sergchepinoga:ghp_VBGb...@github.com/sergchepinoga/montenegro-monitor.git" main`

## Stack
- Next.js 16 + TypeScript + React 19 + Tailwind v4
- `@import "tailwindcss"` (НЕ `@tailwind base`)
- НЕТ Supabase, НЕТ Prisma
- pdftotext (системная утилита `/opt/homebrew/bin/pdftotext`) — для PDF, НЕ npm pdf-parse (конфликт ESM)

## Vercel + Storage
- **`/tmp`** — единственная writable папка на Vercel serverless
- `monitor-state.json` пишется в `/tmp` (ephemeral между инвокациями!)
- Env var `VERCEL` существует на проде → `process.env.VERCEL ? "/tmp/..." : process.cwd()+"/..."`
- Hobby plan: max 1 cron/day → используем cron-job.org для второго запуска

## GitHub Actions (browser agents)
- Repo: `sergchepinoga/montenegro-agents`
- Запускать: `gh api repos/sergchepinoga/montenegro-agents/actions/workflows/monitor.yml/dispatches --method POST -f ref=main`
- Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, VERCEL_URL, CRON_SECRET
- НЕ можно вызывать внутренние Vercel API routes из cron endpoint (serverless self-call не работает)

## Расписание агентов
- 09:05 Братислава (07:05 UTC) — GitHub Actions
- 20:05 Братислава (18:05 UTC) — GitHub Actions + cron-job.org job #7589398
- Vercel Cron: `0 7 * * *` (только 09:00 — Hobby ограничение)

## Telegram
- Бот: @Montenegro_capitalplusbot
- Chat ID Сергея: `73116273` (проверено)
- Env vars в Vercel: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`

## 8 Вкладок
1. **Обзор** — командный центр, обратный отсчёт до заседания
2. **Суд. дела** — 5 дел, кнопка «🤖 Запустить агента»
3. **Банченко** — мониторинг лиц: Владимир, Славица, Hrast CG, Romulus Partners
4. **Стоимость** — 4 сценария, аналоги рынка
5. **Актив** — LN 977 + LN 989 + Capital Plus DOO
6. **Локация** — Google Maps + фото
7. **Проект** — 3D рендеры + PDF проекта + контакт +421 904 878 937
8. **Мониторинг** — 22 источника с аккордеоном + агенты дел

## API Routes
- `GET/POST /api/monitor` — проверка источников
- `POST /api/case-agent` — агент по номерам дел (ищет в sudovi.me)
- `DELETE /api/case-update` — удалить обновление
- `GET /api/cron` — main cron (принимает `?secret=` ИЛИ `Authorization: Bearer`)
- `POST /api/parse-pdf` — парсинг PDF через pdftotext (системная утилита)

## Актив: земля
- LN 977: уч. 634 = 6 039 м² · LN 989: уч. 16-20 = 2 628 м² · Итого 8 667 м²
- КО Бечичи · над Splendid 5★ · 800 м от моря · Ивановичи, Будва

## Компания
- Capital Plus DOO · ПИБ 0000002697394 · Подгорица
- Законный учредитель: Чепинога Сергей ✅
- Незаконный директор: Банченко Владимир ⚠️

## 5 Судебных дел
| Дело | Суть | Следующее |
|---|---|---|
| P.24/21 | Исключение Банченко | 29.05.2026 |
| P.596/22 | Отмена договора→возврат земли | ждём |
| P.785/22 | Capital Plus vs Hrast CG | приост. |
| UPI224/22 | Кадастровая отметка | исп. |
| Kt.96/25 | Уголовное vs Банченко | активное |

## Банченко (ответчики)
- Владимир Банченко (Украина) — директор Capital Plus DOO ⚠️
- Славица Банченко — соответчик P.24/21
- Hrast CG DOO (директор Lazar Radnić) — незаконный получатель земли
- Romulus Partners DOO — четвёртый получатель
- Уголовное Kt.96/25: мошенничество (244), злоупотребление (272), подлог (412)

## eKatastar (кадастр)
- URL: `https://www.ekatastar.me/ekatastar-web/action/elogin`
- Публичный логин: `KORISNIK` / `KORISNIK`
- Поиск: «Pretraga po nosiocu prava» → Capital Plus

## Терминология (ОБЯЗАТЕЛЬНО)
- «Коммерческий суд» (НЕ «Привредни суд»)
- «Государственная прокуратура» (НЕ «Тужилаштво»)
- «Управление недвижимостью» (НЕ «Управа за некретнине»)

## Адвокат
- Law Office Vujačić (Саша Вуячич)
- Тел: **+382 67 538 885** · info@lawoffice-vujacic.com

## Правила разработки
- Язык интерфейса: РУССКИЙ (профессиональный, не дословный сербский)
- NO PDF upload на сайте — PDF через отдельные сессии Claude
- Коммиты footer: `CHEVORA OU. All rights reserved. Powered by Sergej Chepinoga.`
- НЕ использовать `chevora` или `Agonsg` аккаунты GitHub для этого проекта
- Медиафайлы: `/public/media/{location,pictures,project}/`

## Стратегии выхода
1. Продажа земли (после победы в P.596/22) — €2.6M–€6.1M
2. Со-инвестиция → строительство → продажа квартир
3. Продажа компании Capital Plus DOO с землёй

## GitHub Actions — важные детали
- Приватный репо требует `permissions: contents: read` в workflow
- Cleanup action: `Mattraks/delete-workflow-runs@v2` — ставить `continue-on-error: true`
- НЕ делать `needs: cleanup` — browser-agents должны быть независимыми
- Timeout: 25 минут (браузерные агенты медленные)
