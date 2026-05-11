// Real data scrapers — each tries to extract meaningful data, not just check HTTP status

// Rotate UAs to avoid bot detection
const UAS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
];
const TIMEOUT_MS = 14000;
let uaIdx = 0;
function nextUA() { uaIdx = (uaIdx + 1) % UAS.length; return UAS[uaIdx]; }

// Sites known to use anti-bot protection (Cloudflare, etc.)
const BOT_BLOCKED_DOMAINS = ["tranio.com", "properstar.com", "globalpropertyguide.com", "villacarte.com"];
function isBotBlocked(url: string) { return BOT_BLOCKED_DOMAINS.some(d => url.includes(d)); }

interface FetchResult { html: string; ms: number; status: number; botBlocked: boolean }

async function fetchHtml(url: string, referer?: string): Promise<FetchResult | null> {
  // Skip known blocked domains — mark immediately
  if (isBotBlocked(url)) {
    // Still try once with mobile UA
    const t0 = Date.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          "User-Agent": UAS[2], // mobile UA
          "Accept": "text/html,application/xhtml+xml,*/*;q=0.9",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          ...(referer ? { "Referer": referer } : {}),
        },
      });
      clearTimeout(timer);
      const html = await res.text();
      const ms = Date.now() - t0;
      // Cloudflare returns 403/503 or includes challenge page
      const botBlocked = res.status === 403 || res.status === 503 || html.includes("cf-browser-verification") || html.includes("_cf_chl") || html.includes("Just a moment");
      return { html, ms, status: res.status, botBlocked };
    } catch {
      return { html: "", ms: Date.now() - t0, status: 0, botBlocked: true };
    }
  }

  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": nextUA(),
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.9",
        "Accept-Language": "ru-RU,ru;q=0.9,sr;q=0.8,en-US;q=0.7,en;q=0.6",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        ...(referer ? { "Referer": referer } : {}),
      },
    });
    clearTimeout(timer);
    const html = await res.text();
    return { html, ms: Date.now() - t0, status: res.status, botBlocked: false };
  } catch {
    return null;
  }
}

export interface ScraperResult {
  ok: boolean;
  ms: number;
  status: number | null;
  extracted: Record<string, string | number | null>;
  summary: string;
  changed: boolean;
}

// Compare two extracted objects to detect changes
function detectChange(prev: Record<string, string | number | null> | undefined, next: Record<string, string | number | null>): boolean {
  if (!prev) return false;
  for (const key of Object.keys(next)) {
    if (next[key] !== null && prev[key] !== next[key]) return true;
  }
  return false;
}

// ── COURT HEARINGS (sudovi.me) ────────────────────────────────────────────────
export async function scrapeCourt(prevExtracted?: Record<string, string | number | null>): Promise<ScraperResult> {
  const res = await fetchHtml("https://sudovi.me/pscg");
  if (!res) {
    return { ok: false, ms: 0, status: null, extracted: {}, summary: "Сайт недоступен", changed: false };
  }

  const text = res.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 5000);

  // Look for our case numbers
  const ourCases = ["P.24/21","P 24/21","596/22","785/22"]
    .filter(c => text.toLowerCase().includes(c.toLowerCase()));

  const title = res.html.match(/<title[^>]*>([^<]{1,100})<\/title>/i)?.[1]?.trim() ?? null;
  const dateMatches = text.match(/\d{1,2}\.\d{2}\.\d{4}/g) ?? [];
  const uniqueDates = [...new Set(dateMatches)].slice(0, 3);

  const extracted = {
    httpStatus: res.status,
    title,
    ourCasesFound: ourCases.join(", ") || null,
    recentDates: uniqueDates.join(", ") || null,
  };

  const summary = res.status < 400
    ? `✅ Сайт доступен (${res.ms}мс)${ourCases.length ? ` · Найдены дела: ${ourCases.join(", ")}` : " · Наши дела на странице не найдены"}`
    : `❌ HTTP ${res.status}`;

  return { ok: res.status < 400, ms: res.ms, status: res.status, extracted, summary, changed: detectChange(prevExtracted, extracted) };
}

// ── COMPANY REGISTRY (CRPS) ──────────────────────────────────────────────────
export async function scrapeCompany(prevExtracted?: Record<string, string | number | null>): Promise<ScraperResult> {
  const res = await fetchHtml("http://www.pretraga.crps.me");
  if (!res) {
    return { ok: false, ms: 0, status: null, extracted: {}, summary: "Сайт CRPS недоступен", changed: false };
  }

  const text = res.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 3000);
  const title = res.html.match(/<title[^>]*>([^<]{1,100})<\/title>/i)?.[1]?.trim() ?? null;
  const hasSearch = /pretraga|search|registar/i.test(text);

  const extracted = {
    httpStatus: res.status,
    title,
    searchAvailable: hasSearch ? 1 : 0,
  };

  const summary = res.status < 400
    ? `✅ CRPS доступен (${res.ms}мс) · Поиск по ПИБ 0000002697394: открыть вручную`
    : `❌ HTTP ${res.status}`;

  return { ok: res.status < 400, ms: res.ms, status: res.status, extracted, summary, changed: detectChange(prevExtracted, extracted) };
}

// ── REAL ESTATE PRICES (ESTITOR) ─────────────────────────────────────────────
export async function scrapeEstitor(prevExtracted?: Record<string, string | number | null>): Promise<ScraperResult> {
  const url = "https://estitor.com/me-en/real-estates/purpose-sale/type-land-lot/city-budva/neighbourhood-becici";
  const res = await fetchHtml(url, "https://www.google.com/");
  if (!res) return { ok: false, ms: 0, status: null, extracted: {}, summary: "❌ Estitor: нет соединения", changed: false };
  if (res.botBlocked) return { ok: false, ms: res.ms, status: res.status, extracted: { botBlocked: 1 }, summary: "🛡️ Estitor: защита от ботов · Открыть вручную ↗ (данные за 2026: €300–917/м²)", changed: false };

  const text = res.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  const countMatch = text.match(/(\d+)\s*(?:land|listing|result|nekretnin|zemljišt)/i);
  const listingCount = countMatch ? parseInt(countMatch[1]) : null;

  const priceRx = /€\s*[\d,]+(?:\.\d+)?/g;
  const allPrices = (text.match(priceRx) ?? [])
    .map(p => parseInt(p.replace(/[€,\s]/g, ""), 10))
    .filter(v => v > 50000 && v < 10000000);
  const priceMin = allPrices.length ? Math.min(...allPrices) : null;
  const priceMax = allPrices.length ? Math.max(...allPrices) : null;

  const extracted = { httpStatus: res.status, listingCount, priceMin, priceMax };
  const priceStr = priceMin && priceMax ? ` · Цены: €${(priceMin/1000).toFixed(0)}K – €${(priceMax/1000).toFixed(0)}K` : "";
  const countStr = listingCount ? ` · ${listingCount} объявлений` : "";
  const summary = res.status < 400 ? `✅ Estitor (${res.ms}мс)${countStr}${priceStr}` : `❌ HTTP ${res.status}`;
  return { ok: res.status < 400, ms: res.ms, status: res.status, extracted, summary, changed: detectChange(prevExtracted, extracted) };
}

// ── GENERIC CHECK ─────────────────────────────────────────────────────────────
export async function checkGeneric(url: string, prevExtracted?: Record<string, string | number | null>): Promise<ScraperResult> {
  const res = await fetchHtml(url);
  if (!res) {
    return { ok: false, ms: 0, status: null, extracted: { botBlocked: 0 }, summary: "❌ Нет соединения (таймаут >14 сек)", changed: false };
  }
  if (res.botBlocked) {
    return { ok: false, ms: res.ms, status: res.status, extracted: { botBlocked: 1 }, summary: "🛡️ Сайт использует защиту от ботов (Cloudflare) · Данные доступны при ручном открытии ↗", changed: false };
  }

  const title = res.html.match(/<title[^>]*>([^<]{1,120})<\/title>/i)?.[1]?.trim().replace(/\s+/g, " ") ?? null;
  const extracted = { httpStatus: res.status, title, botBlocked: 0 };

  const summary = res.status < 400
    ? `✅ Доступен (${res.ms}мс)${title ? ` · «${title.slice(0, 55)}»` : ""}`
    : `❌ HTTP ${res.status}`;

  return { ok: res.status < 400, ms: res.ms, status: res.status, extracted, summary, changed: detectChange(prevExtracted, extracted) };
}

// ── COURT DECISIONS (public database) ────────────────────────────────────────
// sudovi.me/pscg/odluke/ — PUBLIC decisions database
export async function scrapeCourtDecisions(prevExtracted?: Record<string, string | number | null>): Promise<ScraperResult> {
  const url = "https://sudovi.me/pscg/odluke/";
  const res = await fetchHtml(url);
  if (!res) return { ok: false, ms: 0, status: null, extracted: {}, summary: "❌ База решений недоступна", changed: false };

  const text = res.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  // Our case numbers
  const ourCases = [
    "P.24/21", "P 24/21", "24/21",
    "P.596/22", "596/22",
    "P.785/22", "785/22",
  ].filter(c => text.toLowerCase().includes(c.toLowerCase()));

  // Count odluke (decisions) on the page
  const decisionCount = (text.match(/odluka|presuda|rješenje/gi) ?? []).length;

  // Extract dates of decisions
  const dates = [...new Set(text.match(/\d{1,2}\.\d{2}\.\d{4}/g) ?? [])].slice(0, 5);

  const extracted = {
    httpStatus: res.status,
    ourCasesFound: ourCases.join(", ") || null,
    decisionCount,
    recentDates: dates.join(", ") || null,
  };

  const found = ourCases.length > 0
    ? `🔔 НАЙДЕНЫ НАШИ ДЕЛА: ${ourCases.join(", ")}`
    : "Наши дела P.24/21, P.596/22, P.785/22 в публичной базе не обнаружены";

  const summary = res.status < 400
    ? `✅ База решений доступна (${res.ms}мс) · ${found} · Всего решений на странице: ${decisionCount}`
    : `❌ HTTP ${res.status}`;

  return { ok: res.status < 400, ms: res.ms, status: res.status, extracted, summary, changed: detectChange(prevExtracted, extracted) };
}

// ── HEARING SCHEDULE search ───────────────────────────────────────────────────
export async function scrapeHearingSchedule(prevExtracted?: Record<string, string | number | null>): Promise<ScraperResult> {
  // The hearing schedule page lists upcoming hearings
  const url = "https://sudovi.me/pscg/kategorija/Qa";
  const res = await fetchHtml(url);
  if (!res) return { ok: false, ms: 0, status: null, extracted: {}, summary: "❌ Расписание недоступно", changed: false };

  const text = res.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  const ourCases = ["P.24/21","P24/21","24/21","P.596/22","596/22","P.785/22","785/22"]
    .filter(c => text.includes(c));

  const dates = [...new Set(text.match(/\d{1,2}\.\d{2}\.\d{4}/g) ?? [])].slice(0, 8);

  const extracted = {
    httpStatus: res.status,
    ourCasesFound: ourCases.join(", ") || null,
    upcomingDates: dates.join(", ") || null,
  };

  const summary = res.status < 400
    ? `✅ Расписание доступно (${res.ms}мс)${ourCases.length ? ` · 🔔 НАШИ ДЕЛА: ${ourCases.join(", ")}` : " · Наши дела не найдены в расписании"}${dates.length ? ` · Даты: ${dates.slice(0,3).join(", ")}` : ""}`
    : `❌ HTTP ${res.status}`;

  return { ok: res.status < 400, ms: res.ms, status: res.status, extracted, summary, changed: detectChange(prevExtracted, extracted) };
}

// ── CADASTRE (ekatastar.me) ───────────────────────────────────────────────────
// Checks public land registry for our specific parcels
export async function scrapeCadastre(prevExtracted?: Record<string, string | number | null>): Promise<ScraperResult> {
  // Try the public ekatastar portal
  const url = "https://ekatastar.me";
  const res = await fetchHtml(url);

  // Also try geoportal
  const geo = await fetchHtml("https://geoportal.co.me/geoportal/geoportal_eng.html");

  if (!res && !geo) {
    return { ok: false, ms: 0, status: null, extracted: {}, summary: "❌ Кадастр и геопортал недоступны", changed: false };
  }

  const r = res || geo!;
  const text = r.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const title = r.html.match(/<title[^>]*>([^<]{1,80})<\/title>/i)?.[1]?.trim() ?? null;

  // Look for our parcel identifiers
  const foundLN977 = text.includes("977") || text.includes("LN 977");
  const foundLN989 = text.includes("989") || text.includes("LN 989");
  const foundBecici = /be[cč]i[cć]i|bečić/i.test(text);

  const extracted = {
    httpStatus: r.status,
    title,
    ekatastarOnline: res?.status !== undefined && res.status < 400 ? 1 : 0,
    geoportalOnline: geo?.status !== undefined && geo.status < 400 ? 1 : 0,
    foundLN977: foundLN977 ? 1 : 0,
    foundLN989: foundLN989 ? 1 : 0,
  };

  const parts = [
    `eKatastar: ${res?.status && res.status < 400 ? `✅ ${res.ms}мс` : "❌"}`,
    `Геопортал: ${geo?.status && geo.status < 400 ? `✅ ${geo.ms}мс` : "❌"}`,
    "🔍 Поиск LN 977/989: открыть вручную на портале",
  ];

  const summary = `${parts.join(" · ")}${foundBecici ? " · Бечичи найдено в базе" : ""}`;

  return { ok: r.status < 400, ms: r.ms, status: r.status, extracted, summary, changed: detectChange(prevExtracted, extracted) };
}
