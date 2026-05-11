# Montenegro Asset Monitor — CLAUDE.md

## Проект
Персональный дашборд мониторинга актива в Черногории для Сергея Чепиноги.

- **Путь:** `/Users/chepinoga/GitHub-Agon/montenegro-app`
- **Домен:** `montenegro.chepinoga.com` (подключить в Vercel dashboard)
- **Prod URL:** `https://montenegro-app.vercel.app`
- **GitHub:** `sergchepinoga/montenegro-monitor` (аккаунт `sergchepinoga`) — НИКОГДА не использовать CHEVORA
- **Vercel:** аккаунт `schepinoga` / workspace `schepinogas-projects`
- **Dev порт:** 3456 (`npm run dev -- --port 3456`)
- **Vercel token:** в памяти Claude (project_journey_yerevan.md)
- **GitHub PAT (sergchepinoga classic):** в памяти Claude (сессия 11.05.2026)

## Stack
- Next.js 16 + TypeScript + React 19
- Tailwind CSS v4 (`@import "tailwindcss"`)
- node-cron (local), Vercel Cron (prod — 1x/day at 07:00 UTC = 09:00 Подгорица)
- pdftotext (системная утилита, для парсинга PDF в отдельных сессиях Claude)
- Хранилище: `monitor-state.json` в корне (local + Vercel ephemeral)

## API Routes
- `GET/POST /api/monitor` — проверка источников мониторинга (22 источника)
- `POST /api/case-agent` — агент по конкретным делам (сканирует суд по номерам дел)
- `GET /api/case-agent` — статус последних проверок агента по делам
- `DELETE /api/case-update` — удалить обновление дела
- `GET /api/cron` — cron endpoint (запускает ВСЕ источники + агенты дел)

## Ключевые правила
- **NO PDF upload** на сайте — PDF разбираются отдельно в сессиях Claude
- Агенты сами находят обновления в официальных источниках суда
- Язык интерфейса: РУССКИЙ (профессиональный перевод, не дословный сербский)
- Суд = "Коммерческий суд" (НЕ "Привредни суд")
- Прокуратура = "Государственная прокуратура" (НЕ "Тужилаштво")
- Коммиты: footer = `CHEVORA OU. All rights reserved. Powered by Sergej Chepinoga.`

## Архитектура мониторинга
```
Vercel Cron (09:00 Подгорица ежедневно)
  → /api/cron
    → /api/monitor (22 источника: суды, кадастр, CRPS, налоги, прокуратура, рынок)
    → /api/case-agent (5 дел: P.24/21, P.596/22, P.785/22, UPI224/22, Kt.96/25)
      → scanners: sudovi.me/pscg/odluke/ + sudovi.me расписание
      → при найденном обновлении → saveUpdate(source:"🤖 Агент") + Telegram alert
```

## Актив
- **Итого:** 8 667 м² в Бечичи/Ивановичи, Будва, КО Бечичи
  - LN 977: уч. 634 = 6 039 м²
  - LN 989: уч. 16–20 = 2 628 м²
- Коэф. 1.6 → до 13 867 м² · Ц+3+подвал · до моря 800 м
- Оценка 2021: €2.11M · Реалист. 2026: €3.21M (370 €/м²)

## Компания: Capital Plus DOO
- ПИБ: 0000002697394 · Подгорица
- Законный учредитель: Чепинога Сергей ✅
- Незаконный директор: Банченко В. ⚠️

## Судебные дела
| Дело | Суть | Статус | Следующее |
|---|---|---|---|
| P.24/21 | Исключение Банченко | АКТИВНОЕ | 29.05.2026 |
| P.596/22 | Отмена договора | АКТИВНОЕ | ждём даты |
| P.785/22 | Capital Plus vs Hrast | ПРИОСТАНОВЛЕНО | — |
| UPI224/22 | Кадастровая отметка | ИСПОЛНЕНО | — |
| Kt.96/25 | Уголовное vs Банченко | АКТИВНОЕ | — |

## 7 вкладок сайта
1. **Обзор** — command center: алерт-баннер (18 дней до заседания), KPI, все дела, события
2. **Суд. дела** — 5 дел + агентские обновления + ручной запуск агента
3. **Стоимость** — 4 сценария + аналоги рынка
4. **Актив** — LN 977 + LN 989 + Capital Plus DOO
5. **Локация** — Google Maps + схемы + фото участка
6. **Проект** — 3D рендеры + PDF документы проекта
7. **Мониторинг** — 22 источника с кнопкой проверки

## Адвокат
- Law Office Vujačić (Саша Вуячич) · +382 20 229 725
- info@lawoffice-vujacic.com · Bul. Ivana Crnojevića 56/2, Podgorica

## Для 2-й проверки в день (19:00 Подгорица)
Создать задание на cron-job.org:
- URL: `https://montenegro-app.vercel.app/api/cron`
- Header: `Authorization: Bearer mont2026secret`
- Schedule: `0 17 * * *` (17:00 UTC = 19:00 Подгорица)

## Telegram (при наличии токена)
- Env: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID=73116273`
- Алерты при: изменениях в мониторинге + найденных обновлениях по делам
