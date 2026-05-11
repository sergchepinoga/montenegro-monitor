"use client";
import { useState, useEffect, useCallback } from "react";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface SourceStatus {
  lastChecked: string | null;
  status: "ok" | "slow" | "error" | "unknown";
  httpStatus: number | null;
  responseMs: number | null;
  note: string | null;
  extracted?: Record<string, string | number | null>;
  changed?: boolean;
}

interface CaseUpdate {
  id: string;
  date: string;
  dateRu: string;
  text: string;
  source: string;
}

interface MonitorState {
  updatedAt: string;
  sources: Record<string, SourceStatus>;
  caseUpdates: Record<string, CaseUpdate[]>;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const TODAY = "11.05.2026";
const AREA_M2 = 8667;

const PRICE_SCENARIOS = [
  { label: "Консервативно", perM2: 300, note: "нижняя граница рынка 2026" },
  { label: "Реалистично",   perM2: 370, note: "средняя цена аналогов Бечичи" },
  { label: "Оптимально",    perM2: 500, note: "урбанизированный + ДУП" },
  { label: "Премиум",       perM2: 700, note: "вид на море + готовый проект" },
];

const CASES = [
  {
    id: "P.24/21", status: "active", statusLabel: "АКТИВНОЕ",
    title: "Исключение Банченко из Capital Plus DOO",
    court: "Коммерческий суд Черногории", started: "12.01.2021",
    nextHearing: "29.05.2026",
    lastAction: "30.04.2026 — Заседание прошло. Ожидаем заключение финансового эксперта.",
    summary: "Иск об исключении Банченко (Владимир + Славица) из учредителей компании. Ведётся 5+ лет.",
    courtUrl: "https://sudovi.me/pscg",
    history: ["12.01.2021 — Подача иска","2023 — Смена судьи → пауза до дек. 2023","06.12.2023 — Первое заседание с новым судьёй","2024 — 8 заседаний","2025 — 6 заседаний + ходатайства","2026 — 5 заседаний (янв.–апр.)","29.05.2026 — Следующее заседание ⟵"],
  },
  {
    id: "P.596/22", status: "active", statusLabel: "АКТИВНОЕ",
    title: "Отмена договора о совместном строительстве",
    court: "Коммерческий суд Черногории", started: "24.12.2021",
    nextHearing: "08.05.2026",
    lastAction: "24.03.2026 — Судья: «передача незаконна». Планирует направить дело прокурору.",
    summary: "Отмена договора UZZ 712/20, по которому земля мошеннически передана Hrast CG DOO. Мин-во отменило передачу 18.06.2025.",
    courtUrl: "https://sudovi.me/pscg",
    history: ["24.12.2021 — Подача иска","2023 — 4 заседания + встречный иск от Hrast CG","Смена судьи → пауза апр. 2024 — март 2025","23.09.2025 — Судья: «передача незаконна»","18.06.2025 — Мин-во ОТМЕНИЛО решение UPI-1175/25","08.05.2026 — Следующее заседание"],
  },
  {
    id: "P.785/22", status: "paused", statusLabel: "ПРИОСТАНОВЛЕНО",
    title: "Capital Plus DOO vs Hrast CG DOO",
    court: "Коммерческий суд Черногории", started: "2022",
    nextHearing: "—",
    lastAction: "Адвокат Capital Plus (Банченко) не явился → суд приостановил дело.",
    summary: "Инициировано Банченко. Мы вступили как третья сторона (09.11.2024).",
    courtUrl: "https://sudovi.me/pscg",
    history: ["2022 — Подача иска","09.11.2024 — Вступление третьей стороной","18.03.2025 — Подача новых фактов","Адвокат не явился → дело приостановлено"],
  },
  {
    id: "UPI224/22", status: "done", statusLabel: "ИСПОЛНЕНО ✓",
    title: "Уведомление в кадастре о споре",
    court: "Управление недвижимостью (кадастр)", started: "2022",
    nextHearing: "—",
    lastAction: "Передача LN 989 → Crnovršanin ОТМЕНЕНА. Отметка в кадастре активна.",
    summary: "Отметка в LN 977 и LN 989 с 05.04.2022. Блокирует любую продажу земли.",
    courtUrl: "https://ekatastarcg.me",
    history: ["05.04.2022 — Кадастр внёс отметку в LN 977 и LN 989","20.03.2025 — Жалоба на решение UPI-1175/25","Кадастр принял — передача Crnovršanin ОТМЕНЕНА ✓","18.06.2025 — Мин-во ОТМЕНИЛО решение ✓"],
  },
  {
    id: "Kt.96/25", status: "criminal", statusLabel: "УГОЛОВНОЕ",
    title: "Уголовное дело против Банченко",
    court: "Высшая прокуратура Подгорицы (Ирена Бурич)", started: "12.01.2021",
    nextHearing: "—",
    lastAction: "07.04.2026 — Полиция не предоставила материалы. Направлено 6 ургенций.",
    summary: "Обвинения: злоупотребление (ст.272), мошенничество (ст.244), подлог (ст.412). Дело в Высшей прокуратуре.",
    courtUrl: "https://tuzilastvo.me",
    history: ["12.01.2021 — Подача уголовной жалобы","16.06.2023 — Прокуратура отказала","31.07.2023 — Высшая прокуратура вернула дело","27.12.2024 — Совет прокуроров: жалоба обоснована","07.04.2025 — Дело в Высшей прокуратуре","07.04.2026 — Полиция: 6 ургенций без ответа"],
  },
];

const STATUS_CFG: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  active:   { bg: "#dbeafe", text: "#1d4ed8", dot: "#3b82f6", border: "#bfdbfe" },
  paused:   { bg: "#fef3c7", text: "#92400e", dot: "#f59e0b", border: "#fde68a" },
  done:     { bg: "#dcfce7", text: "#15803d", dot: "#22c55e", border: "#bbf7d0" },
  criminal: { bg: "#f3e8ff", text: "#7e22ce", dot: "#a855f7", border: "#e9d5ff" },
};

const ALL_SOURCES = [
  { cat: "⚖️ Суды — ваши дела напрямую", color: "#1d4ed8", items: [
    { id: "court_odluke",  name: "📋 База решений суда", url: "https://sudovi.me/pscg/odluke/", hi: true,
      desc: "✅ Открывается без логина · Ищите: P.24/21 · P.596/22 · P.785/22 · агент ищет автоматически" },
    { id: "court_rocista", name: "📅 Расписание заседаний", url: "https://sudovi.me/ospg/rocista", hi: true,
      desc: "✅ Открывается без логина · Расписание всех заседаний Коммерческого суда" },
    { id: "court_pscg",    name: "🏛️ Коммерческий суд ЧГ", url: "https://sudovi.me/pscg", hi: false,
      desc: "✅ Главная страница · Все разделы суда" },
    { id: "court_ascg",    name: "🏛️ Апелляционный суд ЧГ", url: "https://sudovi.me/ascg", hi: false,
      desc: "✅ Для обжалования решений" },
  ]},
  { cat: "🗺️ Кадастр — ваша земля LN 977 / LN 989", color: "#15803d", items: [
    { id: "katastar_e",    name: "🔐 eKatastar — поиск ваших участков", url: "https://www.ekatastar.me/ekatastar-web/action/elogin", hi: true,
      desc: "🔑 ЛОГИН: KORISNIK / ПАРОЛЬ: KORISNIK → Pretraga po nosiocu prava → Capital Plus → выбрать КО Будва" },
    { id: "geoportal",     name: "🗺️ Геопортал ЧГ — карта участка", url: "https://geoportal.co.me/Geoportal01/", hi: true,
      desc: "✅ Без логина · Интерактивная карта · найдите Ивановичи/Бечичи · КО Будва" },
    { id: "katastar_gov",  name: "🏢 Управление недвижимостью ЧГ", url: "http://www.uzn.me/", hi: false,
      desc: "⚠️ Доступ только из ЧГ · Официальный орган управления кадастром" },
    { id: "mpa",           name: "📐 Мин-во пространств. план.", url: "https://www.gov.me/mpa", hi: false,
      desc: "✅ Контроль решений UPI-1175/25 · Строительные разрешения" },
  ]},
  { cat: "🏢 Capital Plus DOO — реестр и налоги", color: "#7e22ce", items: [
    { id: "crps_search",   name: "🏢 CRPS — Capital Plus DOO", url: "http://www.pretraga.crps.me/", hi: true,
      desc: "✅ Без логина · ПИБ для поиска: 0000002697394 · Проверить директора / учредителей" },
    { id: "irms",          name: "📊 IRMS — Налоговый статус компании", url: "https://irms.tax.gov.me/public/search-register/business-entities", hi: true,
      desc: "✅ Без логина · Проверить налоговый статус Capital Plus DOO · ПИБ: 0000002697394" },
    { id: "efirma",        name: "💻 eFirma — Электронный реестр", url: "http://efirma.tax.gov.me/", hi: false,
      desc: "✅ Альтернативный поиск по компании" },
  ]},
  { cat: "💰 Налоговая задолженность Capital Plus", color: "#b45309", items: [
    { id: "tax_pu",        name: "💰 Пореска управа ЧГ", url: "http://www.poreskauprava.gov.me/", hi: true,
      desc: "⚠️ Доступно только с IP Черногории · Налоговые задолженности компании" },
    { id: "tax_e",         name: "🧾 eTaxes ЧГ", url: "https://etaxes.tax.gov.me/", hi: false,
      desc: "⚠️ Доступно только с IP Черногории · Электронная налоговая отчётность" },
  ]},
  { cat: "⚔️ Прокуратура — дело Kt.96/25", color: "#dc2626", items: [
    { id: "prosec_main",   name: "⚔️ Государственная прокуратура ЧГ", url: "https://tuzilastvo.me/", hi: true,
      desc: "✅ Открывается · Дело Kt.96/25 против Банченко В. · Прокурор Ирена Бурич" },
    { id: "police",        name: "👮 Полиция Черногории", url: "https://www.upolicija.gov.me/", hi: false,
      desc: "✅ Полиция (задержала материалы по Kt.96/25) · 6 ургенций направлено" },
  ]},
  { cat: "📈 Рынок — цены Бечичи 2026", color: "#0891b2", items: [
    { id: "estitor",       name: "📊 Estitor — участки Бечичи СЕЙЧАС", url: "https://estitor.com/me-en/real-estates/purpose-sale/type-land-lot/city-budva/neighbourhood-becici", hi: true,
      desc: "✅ Прямая ссылка на участки Бечичи · Актуальные цены · Аналоги вашего участка" },
    { id: "srbija_nek",    name: "🏷️ Srbija-nekretnine — Будва", url: "https://www.srbija-nekretnine.org/en/plots/for-sale/budva", hi: true,
      desc: "✅ Без блокировки · Участки Будва · Сравнение цен" },
    { id: "investropa",    name: "📈 Investropa — прогноз роста 2026", url: "https://investropa.com/blogs/news/montenegro-price-forecasts", hi: false,
      desc: "✅ Прогноз: +10–15%/год · Бечичи · Будва" },
    { id: "tranio",        name: "🌍 Tranio — Бечичи", url: "https://tranio.com/montenegro/budva/becici/land/", hi: false,
      desc: "🛡️ Cloudflare · Открыть вручную в браузере" },
  ]},
  { cat: "📋 Адвокат — Law Office Vujačić", color: "#374151", items: [
    { id: "lawyer",        name: "📋 Саша Вуячич — сайт конторы", url: "https://lawoffice-vujacic.com/", hi: true,
      desc: "✅ Контакт: +382 67 538 885 · info@lawoffice-vujacic.com · Подгорица" },
  ]},
];

const FLAT_SOURCES = ALL_SOURCES.flatMap(c => c.items);

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return "не проверялось";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1)  return "только что";
  if (mins < 60) return `${mins} мин. назад`;
  if (hrs  < 24) return `${hrs} ч. назад`;
  return `${days} дн. назад`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function StatusBadge({ st, small }: { st: SourceStatus | undefined; small?: boolean }) {
  if (!st || st.status === "unknown" || !st.lastChecked) {
    return <span style={{ fontSize: small ? 10 : 11, color: "#94a3b8", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "2px 8px", borderRadius: "999px" }}>Не проверялось</span>;
  }
  const isBotBlocked = st.extracted?.botBlocked === 1;
  const cfg = isBotBlocked
    ? { bg: "#fef3c7", text: "#92400e", label: `🛡️ Защита бота` }
    : {
        ok:    { bg: "#dcfce7", text: "#15803d", label: `✅ Доступен (${st.responseMs}мс)` },
        slow:  { bg: "#fef3c7", text: "#92400e", label: `⚠️ Медленно (${st.responseMs}мс)` },
        error: { bg: "#fee2e2", text: "#dc2626", label: "❌ Нет ответа" },
      }[st.status] ?? { bg: "#f1f5f9", text: "#64748b", label: "?" };
  return (
    <span style={{ fontSize: small ? 10 : 11, fontWeight: 700, background: cfg.bg, color: cfg.text, padding: "2px 8px", borderRadius: "999px" }}>
      {cfg.label}
    </span>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview",   label: "Обзор",      icon: "🏠" },
  { id: "cases",      label: "Суд. дела",  icon: "⚖️" },
  { id: "value",      label: "Стоимость",  icon: "💶" },
  { id: "asset",      label: "Актив",      icon: "🏞️" },
  { id: "location",   label: "Локация",    icon: "📍" },
  { id: "project",    label: "Проект",     icon: "🏗️" },
  { id: "monitoring", label: "Мониторинг", icon: "🔍" },
];

// ── ЛОКАЦИЯ: схемы, карты и реальные фотографии участка ──────────────────────
const LOCATION_MAPS = [
  { src: "/media/pictures/p8.jpg",       caption: "Карта-схема: расположение участка в Ивановичи (отмечено звездой)" },
  { src: "/media/location/skica.jpg",    caption: "Кадастровая схема земельного участка — Ивановичи" },
  { src: "/media/location/gradelista.jpg", caption: "Градельска листа — официальный строительный план территории" },
  { src: "/media/location/map.jpg",      caption: "Карта района с координатами участка" },
];

const LOCATION_PHOTOS = [
  { src: "/media/location/foundation.jpg",  caption: "Вид с дороги — участок указан стрелкой, видны опорные стены" },
  { src: "/media/location/view.jpg",        caption: "Вид с участка — панорама Бечичи, море и горы" },
  { src: "/media/pictures/p7.jpg",          caption: "Пляж Бечичи — 800 м от участка" },
  { src: "/media/pictures/becici.jpg",      caption: "Аэрофото — Бечичи, побережье и гора над отелем Splendid" },
  { src: "/media/pictures/map2.jpg",        caption: "Вид с дороги на район Ивановичи" },
];

// ── ПРОЕКТ: 3D рендеры и архитектурные модели застройки ──────────────────────
const PROJECT_RENDERS = [
  { src: "/media/pictures/p1.jpg",  caption: "3D модель — общий вид жилого комплекса с окрестностями" },
  { src: "/media/pictures/p2.jpg",  caption: "3D модель — вид сверху на жилой комплекс и инфраструктуру" },
  { src: "/media/pictures/p3.jpg",  caption: "3D рендер — территория комплекса (бассейн, дворы, дорожки)" },
  { src: "/media/pictures/p4.jpg",  caption: "3D рендер — панорамный вид, аутентичная черногорская архитектура" },
  { src: "/media/pictures/p5.jpg",  caption: "3D рендер — детальный вид объекта застройки, вид 1" },
  { src: "/media/pictures/p6.jpg",  caption: "3D рендер — детальный вид объекта застройки, вид 2" },
];

const PROJECT_DOCS = [
  { src: "/media/project/plan-katastar.pdf",     label: "Кадастровый план участка",              note: "slik. 4 — katastarski plan" },
  { src: "/media/project/plan-faza1.pdf",        label: "Проект застройки — Фаза 1",             note: "slik. 5 — pl. faza 1" },
  { src: "/media/project/plan-faza3.pdf",        label: "Проект застройки — Фаза 3",             note: "slik. 7 — pl. faza 3" },
  { src: "/media/project/situacija-temelja.pdf", label: "Ситуация фундаментов (план оснований)", note: "slik. 19 — Situacija temelja" },
];

export default function Home() {
  const [tab, setTab] = useState("overview");
  const [openCase, setOpenCase] = useState<string | null>(null);
  const [priceIdx, setPriceIdx] = useState(1);
  const [monState, setMonState] = useState<MonitorState | null>(null);
  const [checking, setChecking] = useState<Record<string, boolean>>({});
  const [checkingAll, setCheckingAll] = useState(false);
  // Case agent state
  const [caseAgentStatus, setCaseAgentStatus] = useState<Record<string, {lastChecked:string|null;found:boolean;note:string}>>({});
  const [runningAgent, setRunningAgent] = useState<string | null>(null);

  const sc = PRICE_SCENARIOS[priceIdx];
  const est = AREA_M2 * sc.perM2;
  const growth = est - AREA_M2 * 244;

  // Load monitoring state on mount + auto-refresh every 30 min
  const loadState = useCallback(async () => {
    try {
      const res = await fetch("/api/monitor");
      if (res.ok) setMonState(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadState();
    // Auto-reload state from server every 30 minutes (server cron updates it)
    const interval = setInterval(loadState, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadState]);

  // Check single source
  async function checkSource(id: string, url: string) {
    setChecking(c => ({ ...c, [id]: true }));
    try {
      const res = await fetch("/api/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: id, url }),
      });
      if (res.ok) {
        const updated = await res.json();
        setMonState(prev => prev ? {
          ...prev,
          sources: { ...prev.sources, [id]: updated },
          updatedAt: new Date().toISOString(),
        } : prev);
      }
    } finally {
      setChecking(c => ({ ...c, [id]: false }));
    }
  }

  // Check all sources
  async function checkAll() {
    setCheckingAll(true);
    try {
      const res = await fetch("/api/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkAll: true, sources: FLAT_SOURCES.map(s => ({ id: s.id, url: s.url })) }),
      });
      if (res.ok) {
        const data = await res.json();
        setMonState(prev => prev ? { ...prev, sources: data.sources, updatedAt: new Date().toISOString() } : prev);
      }
    } finally {
      setCheckingAll(false);
    }
  }

  // Run case agent manually for a single case
  async function runCaseAgent(caseId: string) {
    setRunningAgent(caseId);
    try {
      const res = await fetch("/api/case-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId }),
      });
      if (res.ok) {
        const data = await res.json();
        // Reload monitor state to show new update
        const stateRes = await fetch("/api/monitor");
        if (stateRes.ok) setMonState(await stateRes.json());
        // Update agent status
        const statusRes = await fetch("/api/case-agent");
        if (statusRes.ok) setCaseAgentStatus(await statusRes.json());
      }
    } finally {
      setRunningAgent(null);
    }
  }

  // Delete update
  async function deleteUpdate(caseId: string, updateId: string) {
    await fetch("/api/case-update", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId, updateId }),
    });
    setMonState(prev => {
      if (!prev) return prev;
      return { ...prev, caseUpdates: { ...prev.caseUpdates, [caseId]: (prev.caseUpdates[caseId] || []).filter(u => u.id !== updateId) } };
    });
  }

  const okSources = Object.values(monState?.sources || {}).filter(s => s.status === "ok").length;
  const totalChecked = Object.values(monState?.sources || {}).filter(s => s.lastChecked).length;

  // ── Shared components ──
  const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", ...style }}>
      {children}
    </div>
  );
  const Sec = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px" }}>{children}</div>
  );

  return (
    <div style={{ background: "#f1f5f9", minHeight: "100vh", fontFamily: "-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif", WebkitFontSmoothing: "antialiased" }}>

      {/* ── NAV ── */}
      <nav style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 28px", position: "sticky", top: 0, zIndex: 200, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ height: "50px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "30px", height: "30px", borderRadius: "7px", background: "linear-gradient(135deg,#1d4ed8,#3b82f6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" }}>🏔️</div>
            <span style={{ fontWeight: 700, fontSize: "14px", color: "#0f172a" }}>Montenegro Asset Monitor</span>
            <span style={{ background: "#eff6ff", color: "#1d4ed8", fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "4px", border: "1px solid #bfdbfe" }}>ЛИЧНЫЙ АКТИВ</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: "12px" }}>
            {monState?.updatedAt && (
              <span style={{ color: "#64748b" }}>Мониторинг: <strong style={{ color: "#374151" }}>{fmtDate(monState.updatedAt)}</strong></span>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "#374151", fontWeight: 600 }}>
              <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 5px #22c55e80" }} />
              {TODAY}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "2px", borderTop: "1px solid #f1f5f9" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "10px 18px", fontSize: "13px", fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? "#1d4ed8" : "#64748b",
              background: "none", border: "none", cursor: "pointer",
              borderBottom: tab === t.id ? "2px solid #1d4ed8" : "2px solid transparent",
              display: "flex", alignItems: "center", gap: "6px",
            }}>
              {t.icon} {t.label}
              {t.id === "cases" && <span style={{ background: "#fef3c7", color: "#92400e", fontSize: "10px", fontWeight: 700, padding: "0 5px", borderRadius: "10px" }}>5</span>}
              {t.id === "monitoring" && totalChecked > 0 && (
                <span style={{ background: "#dcfce7", color: "#15803d", fontSize: "10px", fontWeight: 700, padding: "0 5px", borderRadius: "10px" }}>{okSources}/{FLAT_SOURCES.length}</span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px 28px 60px" }}>

        {/* ════ ОБЗОР — ГЛАВНЫЙ ДАШБОРД ════ */}
        {tab === "overview" && (() => {
          // Countdown to next hearing
          const nextHearingDate = new Date("2026-05-29");
          const today = new Date("2026-05-11");
          const daysLeft = Math.ceil((nextHearingDate.getTime() - today.getTime()) / 86400000);
          const monOk = monState?.updatedAt;

          return (
          <div>
            {/* NEXT HEARING ALERT BAR */}
            <div style={{ background: "linear-gradient(135deg, #0f2744 0%, #1e3a5f 100%)", borderRadius: "12px", padding: "16px 22px", marginBottom: "18px", display: "flex", alignItems: "center", gap: "16px", border: "1px solid #1e4a7a" }}>
              <div style={{ fontSize: "22px" }}>📅</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#f0c96a", marginBottom: "3px", letterSpacing: "0.3px" }}>
                  БЛИЖАЙШЕЕ ЗАСЕДАНИЕ: P.24/21 · 29.05.2026
                </div>
                <div style={{ fontSize: "12px", color: "#93c5fd" }}>
                  Коммерческий суд Черногории · Исключение Банченко из Capital Plus DOO · Ожидаем заключение финансового эксперта
                </div>
              </div>
              <div style={{ textAlign: "center", background: "#f0c96a", borderRadius: "10px", padding: "10px 18px", flexShrink: 0 }}>
                <div style={{ fontSize: "32px", fontWeight: 900, color: "#0f2744", lineHeight: 1 }}>{daysLeft}</div>
                <div style={{ fontSize: "11px", color: "#1e3a5f", fontWeight: 700 }}>дней</div>
              </div>
              <button onClick={() => { setTab("cases"); setOpenCase("P.24/21"); }} style={{ background: "rgba(240,201,106,0.15)", border: "1px solid #f0c96a", color: "#f0c96a", borderRadius: "7px", padding: "8px 14px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                Открыть дело →
              </button>
            </div>

            {/* TOP KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "16px" }}>
              {[
                { icon: "💶", val: `€${(est/1e6).toFixed(2)}M`, label: "Стоимость актива", sub: `${sc.perM2} €/м² · реалист. 2026`, accent: "#15803d", tab: "value" },
                { icon: "📈", val: `+${Math.round((sc.perM2/244-1)*100)}%`, label: "Рост с 2021",   sub: `€2.11M → €${(est/1e6).toFixed(2)}M`, accent: "#7e22ce", tab: "value" },
                { icon: "📍", val: "8 667 м²",  label: "Площадь",  sub: "LN 977 + LN 989 · Бечичи", accent: "#1d4ed8", tab: "asset" },
                { icon: "🔍", val: totalChecked > 0 ? `${okSources}/${FLAT_SOURCES.length}` : "—", label: "Агенты онлайн", sub: monOk ? `Проверено ${fmtDate(monOk)}` : "Не проверялось", accent: "#0891b2", tab: "monitoring" },
              ].map(k => (
                <button key={k.label} onClick={() => setTab(k.tab)} style={{ background: "#fff", borderRadius: "12px", padding: "14px 16px", border: "1px solid #e2e8f0", borderLeft: `4px solid ${k.accent}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)", textAlign: "left", cursor: "pointer" }}>
                  <div style={{ fontSize: "18px", marginBottom: "6px" }}>{k.icon}</div>
                  <div style={{ fontSize: "19px", fontWeight: 800, color: "#0f172a", marginBottom: "2px" }}>{k.val}</div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#374151", marginBottom: "2px" }}>{k.label}</div>
                  <div style={{ fontSize: "10px", color: "#64748b" }}>{k.sub}</div>
                </button>
              ))}
            </div>

            {/* MAIN DASHBOARD GRID */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>

              {/* Судебные дела — мини дашборд */}
              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <Sec>⚖️ Судебные дела</Sec>
                  <button onClick={() => setTab("cases")} style={{ fontSize: "11px", color: "#1d4ed8", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Все дела →</button>
                </div>
                {CASES.map(c => {
                  const s = STATUS_CFG[c.status];
                  const updates = monState?.caseUpdates[c.id] || [];
                  return (
                    <button key={c.id} onClick={() => { setTab("cases"); setOpenCase(c.id); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", marginBottom: "4px", borderRadius: "7px", background: "#f8fafc", border: "1px solid #f1f5f9", cursor: "pointer", textAlign: "left" }}>
                      <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#fff", background: "#1d4ed8", padding: "1px 6px", borderRadius: "4px", flexShrink: 0 }}>{c.id}</span>
                      <span style={{ fontSize: "11px", color: "#374151", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title.slice(0, 32)}…</span>
                      <div style={{ display: "flex", gap: "4px", alignItems: "center", flexShrink: 0 }}>
                        {c.nextHearing !== "—" && <span style={{ fontSize: "10px", color: "#dc2626", fontWeight: 700 }}>📅{c.nextHearing}</span>}
                        {updates.length > 0 && <span style={{ fontSize: "10px", color: "#3b82f6", fontWeight: 700, background: "#eff6ff", padding: "1px 5px", borderRadius: "6px" }}>+{updates.length}</span>}
                      </div>
                    </button>
                  );
                })}
              </Card>

              {/* Последние события + следующие шаги */}
              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <Sec>📋 Последние события</Sec>
                  <span style={{ fontSize: "10px", color: "#94a3b8" }}>11.05.2026</span>
                </div>
                {[
                  { date: "30.04.2026", text: "P.24/21: заседание прошло, ожидаем финансового эксперта", color: "#1d4ed8", urgent: true },
                  { date: "07.04.2026", text: "Kt.96/25: полиция не предоставила материалы, 6 ургенций", color: "#dc2626", urgent: true },
                  { date: "24.03.2026", text: "P.596/22: судья «передача незаконна»", color: "#1d4ed8", urgent: false },
                  { date: "18.06.2025", text: "Мин-во ОТМЕНИЛО решение UPI-1175/25 ✅", color: "#15803d", urgent: false },
                ].map((e, i) => (
                  <div key={i} style={{ display: "flex", gap: "10px", padding: "7px 0", borderBottom: i < 3 ? "1px solid #f1f5f9" : "none", alignItems: "flex-start" }}>
                    <span style={{ fontSize: "10px", color: e.urgent ? "#dc2626" : "#64748b", whiteSpace: "nowrap", paddingTop: "2px", minWidth: "68px", fontWeight: e.urgent ? 700 : 400 }}>{e.date}</span>
                    <span style={{ fontSize: "12px", color: "#1e293b", lineHeight: "1.4", borderLeft: `2px solid ${e.color}`, paddingLeft: "8px" }}>{e.text}</span>
                  </div>
                ))}

                {/* Следующие шаги */}
                <div style={{ marginTop: "10px", padding: "10px 12px", background: "#f0fdf4", borderRadius: "7px", border: "1px solid #bbf7d0" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "#15803d", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "6px" }}>Следующие действия</div>
                  {[
                    "29.05.2026 — Заседание P.24/21 (Коммерческий суд)",
                    "Уточнить у адвоката статус P.596/22 (08.05.2026)",
                    "Запросить обновление по Kt.96/25 (полиция)",
                  ].map((step, i) => (
                    <div key={i} style={{ fontSize: "11px", color: "#374151", padding: "3px 0", display: "flex", gap: "6px" }}>
                      <span style={{ color: "#15803d", flexShrink: 0 }}>→</span>
                      {step}
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* BOTTOM ROW: Asset + Value + Monitoring summary */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              {/* Актив */}
              <button onClick={() => setTab("asset")} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px", textAlign: "left", cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "10px" }}>🏞️ Актив</div>
                {[["LN 977", "6 039 м²", "#15803d"], ["LN 989", "2 628 м²", "#15803d"], ["Итого", "8 667 м²", "#0f172a"], ["Застройка", "≤13 867 м²", "#7e22ce"]].map(([k,v,c]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #f8fafc" }}>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>{k}</span>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: c }}>{v}</span>
                  </div>
                ))}
                <div style={{ fontSize: "11px", color: "#1d4ed8", marginTop: "8px", fontWeight: 600 }}>Открыть раздел →</div>
              </button>

              {/* Стоимость */}
              <button onClick={() => setTab("value")} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px", textAlign: "left", cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#15803d", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "10px" }}>💶 Стоимость</div>
                {[
                  ["Консервативно", `€${(8667*300/1e6).toFixed(2)}M`, "#64748b"],
                  ["Реалистично",   `€${(est/1e6).toFixed(2)}M`,     "#15803d"],
                  ["Оптимально",    `€${(8667*500/1e6).toFixed(2)}M`, "#7e22ce"],
                  ["Тренд 2026",    "+10–15%/год",                     "#d97706"],
                ].map(([k,v,c]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #f8fafc" }}>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>{k}</span>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: c }}>{v}</span>
                  </div>
                ))}
                <div style={{ fontSize: "11px", color: "#15803d", marginTop: "8px", fontWeight: 600 }}>Открыть раздел →</div>
              </button>

              {/* Мониторинг */}
              <button onClick={() => setTab("monitoring")} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px", textAlign: "left", cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#0891b2", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "10px" }}>🔍 Агенты</div>
                {([
                  ["Суды (Odluke)", "court_odluke"],
                  ["Кадастр (eKatastar)", "katastar_e"],
                  ["CRPS (Реестр)", "crps_search"],
                  ["Рынок (Estitor)", "estitor"],
                ] as [string, string][]).map(([k, id]) => {
                  const src = monState?.sources?.[id];
                  const isBotBlocked = src?.extracted?.botBlocked === 1;
                  const label = !src?.lastChecked ? "⏳ Ожидает"
                    : isBotBlocked ? "🛡️ Защита бота"
                    : src.status === "ok" ? "✅ Онлайн"
                    : src.status === "error" ? "❌ Недоступен"
                    : src.status === "slow" ? "⚠️ Медленно"
                    : "⏳ Ожидает";
                  const color = !src?.lastChecked ? "#94a3b8"
                    : isBotBlocked ? "#d97706"
                    : src.status === "ok" ? "#15803d"
                    : src.status === "error" ? "#dc2626"
                    : "#d97706";
                  return (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #f8fafc" }}>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>{k}</span>
                      <span style={{ fontSize: "11px", fontWeight: 700, color }}>{label}</span>
                    </div>
                  );
                })}
                <div style={{ fontSize: "11px", color: "#0891b2", marginTop: "8px", fontWeight: 600 }}>
                  {totalChecked > 0 ? `Проверено: ${fmtDate(monState?.updatedAt || null)}` : "Запустить агентов →"}
                </div>
              </button>
            </div>
          </div>
          );
        })()}

        {/* ════ СУДЕБНЫЕ ДЕЛА ════ */}
        {tab === "cases" && (
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", marginBottom: "4px" }}>Судебные дела</h1>

            {/* Cases mini-dashboard */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px", marginBottom: "20px" }}>
              {[
                { label: "Активных",      val: "3",            sub: "P.24/21 · P.596/22 · Kt.96/25", color: "#3b82f6" },
                { label: "Приостановлено", val: "1",           sub: "P.785/22 — адвокат не явился",  color: "#f59e0b" },
                { label: "Исполнено",     val: "1",            sub: "UPI224/22 — кадастр ✅",         color: "#22c55e" },
                { label: "Следующее",     val: "29.05.2026",   sub: "P.24/21 · через 18 дней",        color: "#ef4444" },
              ].map(k => (
                <div key={k.label} style={{ background: "#fff", borderRadius: "10px", padding: "12px 14px", border: "1px solid #e2e8f0", borderTop: `3px solid ${k.color}` }}>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", marginBottom: "2px" }}>{k.val}</div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#374151" }}>{k.label}</div>
                  <div style={{ fontSize: "10px", color: "#64748b", marginTop: "2px" }}>{k.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {CASES.map(c => {
                const st = STATUS_CFG[c.status];
                const open = openCase === c.id;
                const updates = monState?.caseUpdates[c.id] || [];
                const srcStatus = monState?.sources[c.id === "UPI224/22" ? "katastar_e" : "court_pscg"];

                return (
                  <div key={c.id} style={{ background: "#fff", border: `1px solid ${open ? st.border : "#e2e8f0"}`, borderRadius: "14px", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                    <div style={{ padding: "18px 22px" }}>
                      {/* Header */}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#fff", background: "#1d4ed8", padding: "3px 9px", borderRadius: "5px" }}>{c.id}</span>
                        <span style={{ fontSize: "10px", fontWeight: 700, background: st.bg, color: st.text, padding: "2px 9px", borderRadius: "999px", border: `1px solid ${st.border}`, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: st.dot, display: "inline-block" }} />{c.statusLabel}
                        </span>
                        {c.nextHearing !== "—" && <span style={{ fontSize: "11px", fontWeight: 700, color: "#dc2626", background: "#fef2f2", padding: "2px 8px", borderRadius: "5px", border: "1px solid #fecaca" }}>📅 {c.nextHearing}</span>}
                        <span style={{ marginLeft: "auto", fontSize: "11px", color: "#475569" }}>Начато: {c.started}</span>

                        {/* Source status badge */}
                        <a href={c.courtUrl} target="_blank" rel="noopener noreferrer" title="Открыть источник" style={{ textDecoration: "none" }}>
                          <StatusBadge st={srcStatus} small />
                        </a>
                      </div>

                      <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", marginBottom: "3px" }}>{c.title}</h2>
                      <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "10px" }}>{c.court}</p>
                      <p style={{ fontSize: "13px", color: "#374151", lineHeight: "1.55", marginBottom: "12px" }}>{c.summary}</p>

                      {/* Last action */}
                      <div style={{ background: "#f8fafc", borderLeft: "3px solid #3b82f6", borderRadius: "0 7px 7px 0", padding: "9px 13px", marginBottom: "12px" }}>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "3px" }}>Последнее известное действие</div>
                        <div style={{ fontSize: "13px", color: "#1e293b", fontWeight: 500 }}>{c.lastAction}</div>
                      </div>

                      {/* Actions row — agent status + manual trigger */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", flexWrap: "wrap" }}>
                        <button onClick={() => setOpenCase(open ? null : c.id)} style={{ fontSize: "12px", color: "#1d4ed8", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0, display: "flex", alignItems: "center", gap: "4px" }}>
                          <span style={{ transform: open ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.15s", display: "inline-block", fontSize: "10px" }}>▶</span>
                          {open ? "Скрыть историю" : "История дела"} ({c.history.length} событий)
                        </button>

                        {/* Agent status badge */}
                        {(() => {
                          const agentKey = `case_${c.id.replace(/[./]/g, "_")}`;
                          const agentSrc = monState?.sources?.[agentKey];
                          if (agentSrc?.lastChecked) {
                            return (
                              <span style={{ fontSize: "10px", color: agentSrc.status === "ok" ? "#15803d" : "#64748b", background: agentSrc.status === "ok" ? "#f0fdf4" : "#f8fafc", padding: "2px 8px", borderRadius: "5px", border: `1px solid ${agentSrc.status === "ok" ? "#bbf7d0" : "#e2e8f0"}` }}>
                                🤖 {agentSrc.status === "ok" ? "Найдено в суде" : "Не найдено"} · {fmtDate(agentSrc.lastChecked)}
                              </span>
                            );
                          }
                          return null;
                        })()}

                        {updates.length > 0 && (
                          <span style={{ fontSize: "11px", color: "#3b82f6", fontWeight: 700, background: "#eff6ff", padding: "2px 8px", borderRadius: "5px", border: "1px solid #bfdbfe" }}>
                            🤖 {updates.length} обновлений агента
                          </span>
                        )}

                        {/* Manual agent trigger */}
                        <button onClick={() => runCaseAgent(c.id)} disabled={runningAgent === c.id}
                          style={{ marginLeft: "auto", fontSize: "12px", fontWeight: 700, color: "#fff", background: runningAgent === c.id ? "#94a3b8" : "#0f2744", border: "none", padding: "6px 13px", borderRadius: "6px", cursor: "pointer" }}>
                          {runningAgent === c.id ? "⟳ Агент проверяет…" : "🤖 Запустить агента"}
                        </button>
                      </div>
                    </div>

                    {/* Expanded: history + saved updates */}
                    {open && (
                      <div style={{ borderTop: "1px solid #f1f5f9", background: "#fafafa" }}>
                        {/* Saved updates */}
                        {updates.length > 0 && (
                          <div style={{ padding: "14px 22px", borderBottom: "1px solid #f1f5f9" }}>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>
                              🔔 Обновления ({updates.length})
                            </div>
                            {updates.map(u => (
                              <div key={u.id} style={{ display: "flex", gap: "12px", padding: "9px 0", borderBottom: "1px solid #f1f5f9", alignItems: "flex-start" }}>
                                <div style={{ minWidth: "100px" }}>
                                  <div style={{ fontSize: "11px", color: "#64748b" }}>{u.dateRu}</div>
                                  <div style={{ fontSize: "10px", color: "#94a3b8" }}>📌 {u.source}</div>
                                </div>
                                <div style={{ flex: 1, fontSize: "13px", color: "#1e293b", lineHeight: "1.5" }}>{u.text}</div>
                                <button onClick={() => deleteUpdate(c.id, u.id)} title="Удалить" style={{ fontSize: "12px", color: "#94a3b8", background: "none", border: "none", cursor: "pointer", flexShrink: 0, padding: "2px 4px" }}>✕</button>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Original history */}
                        <div style={{ padding: "14px 22px 16px" }}>
                          <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>Хронология дела</div>
                          {c.history.map((h, i) => (
                            <div key={i} style={{ display: "flex", gap: "10px", padding: "6px 0", borderBottom: i < c.history.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                              <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: i === c.history.length - 1 ? "#3b82f6" : "#cbd5e1", flexShrink: 0, marginTop: "5px" }} />
                              <span style={{ fontSize: "13px", color: i === c.history.length - 1 ? "#0f172a" : "#374151", fontWeight: i === c.history.length - 1 ? 600 : 400 }}>{h}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ════ СТОИМОСТЬ ════ */}
        {tab === "value" && (
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", marginBottom: "4px" }}>Мониторинг стоимости актива</h1>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px", marginBottom: "20px" }}>
              {[
                { label: "Текущая оценка",   val: `€${(est/1e6).toFixed(2)}M`,           sub: `${sc.perM2} €/м² · ${sc.note}`,      color: "#15803d" },
                { label: "Цена 2021",        val: "€2.11M",                             sub: "244 €/м² × 8 667 м²",                color: "#64748b" },
                { label: "Прирост",          val: `+€${(growth/1e3).toFixed(0)}K`,       sub: `+${Math.round((sc.perM2/244-1)*100)}% за 5 лет`, color: "#7e22ce" },
                { label: "Тренд 2026",       val: "+10–15%/год",                         sub: "прогноз Investropa · Бечичи",         color: "#d97706" },
              ].map(k => (
                <div key={k.label} style={{ background: "#fff", borderRadius: "10px", padding: "12px 14px", border: "1px solid #e2e8f0", borderTop: `3px solid ${k.color}` }}>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: k.color, marginBottom: "2px" }}>{k.val}</div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#374151" }}>{k.label}</div>
                  <div style={{ fontSize: "10px", color: "#64748b", marginTop: "2px" }}>{k.sub}</div>
                </div>
              ))}
            </div>

            <Card style={{ marginBottom: "14px" }}>
              <Sec>Сценарий оценки</Sec>
              <div style={{ display: "flex", gap: "8px", marginBottom: "18px", flexWrap: "wrap" }}>
                {PRICE_SCENARIOS.map((s, i) => (
                  <button key={s.label} onClick={() => setPriceIdx(i)} style={{ padding: "9px 16px", borderRadius: "9px", fontSize: "13px", fontWeight: 600, border: i === priceIdx ? "2px solid #1d4ed8" : "1px solid #e2e8f0", background: i === priceIdx ? "#eff6ff" : "#f8fafc", color: i === priceIdx ? "#1d4ed8" : "#374151", cursor: "pointer" }}>
                    {s.label}
                    <div style={{ fontSize: "11px", fontWeight: 400, color: i === priceIdx ? "#3b82f6" : "#94a3b8", marginTop: "1px" }}>{s.perM2} €/м² · {s.note}</div>
                  </button>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px" }}>
                {[
                  { label: "По сценарию",     val: `€${(est/1e6).toFixed(2)}M`,            sub: `8 667 × ${sc.perM2} €/м²`,   color: "#15803d" },
                  { label: "Цена 2021",        val: "€2.11M",                              sub: "244 €/м² × 8 667 м²",         color: "#475569" },
                  { label: "Прирост к 2021",   val: `+€${(growth/1e3).toFixed(0)}K`,       sub: `+${Math.round((sc.perM2/244-1)*100)}%`, color: "#7e22ce" },
                  { label: "Тренд 2026",       val: "+10–15%/год",                          sub: "прогноз · Бечичи",            color: "#d97706" },
                ].map(c => (
                  <div key={c.label} style={{ background: "#f8fafc", borderRadius: "10px", padding: "14px 15px", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: c.color, marginBottom: "3px" }}>{c.val}</div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "1px" }}>{c.label}</div>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>{c.sub}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card style={{ marginBottom: "14px" }}>
              <Sec>Аналоги на рынке (Бечичи/Будва, май 2026)</Sec>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Площадь","Цена","За м²","Источник","Примечание"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#475569", fontWeight: 700, fontSize: "11px", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { s:"500 м²",           p:"185 000 €",   pm:"370 €/м²",  src:"Estitor",  n:"Бечичи, 2026" },
                    { s:"1 308 м² (урб.)",  p:"1 200 000 €", pm:"917 €/м²",  src:"Estitor",  n:"с правом застройки 4 900 м²" },
                    { s:"3 688 м²",         p:"1 260 000 €", pm:"342 €/м²",  src:"Tranio",   n:"Будва, 2026" },
                    { s:"4 482 м²",         p:"1 344 000 €", pm:"300 €/м²",  src:"Tranio",   n:"Будва, 2026" },
                  ].map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "9px 12px", fontWeight: 600, color: "#0f172a" }}>{r.s}</td>
                      <td style={{ padding: "9px 12px", fontWeight: 700, color: "#15803d" }}>{r.p}</td>
                      <td style={{ padding: "9px 12px", color: "#1d4ed8", fontWeight: 600 }}>{r.pm}</td>
                      <td style={{ padding: "9px 12px", color: "#374151" }}>{r.src}</td>
                      <td style={{ padding: "9px 12px", color: "#475569" }}>{r.n}</td>
                    </tr>
                  ))}
                  <tr style={{ background: "#eff6ff", borderTop: "2px solid #3b82f6" }}>
                    <td style={{ padding: "9px 12px", fontWeight: 800, color: "#1d4ed8" }}>⭐ 8 667 м² (МОЙ)</td>
                    <td style={{ padding: "9px 12px", fontWeight: 800, color: "#1d4ed8" }}>€{(est/1e6).toFixed(2)}M</td>
                    <td style={{ padding: "9px 12px", fontWeight: 800, color: "#1d4ed8" }}>{sc.perM2} €/м²</td>
                    <td style={{ padding: "9px 12px", color: "#1d4ed8" }}>Расчёт</td>
                    <td style={{ padding: "9px 12px", color: "#1d4ed8" }}>Сценарий: {sc.label}</td>
                  </tr>
                </tbody>
              </table>
            </Card>

            <Card>
              <Sec>Источники рыночных цен — мониторинг</Sec>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "8px" }}>
                {ALL_SOURCES.find(m => m.cat.includes("Рынок"))?.items.map(item => {
                  const st = monState?.sources[item.id];
                  return (
                    <div key={item.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderLeft: item.hi ? "3px solid #0891b2" : "1px solid #e2e8f0", borderRadius: "8px", padding: "10px 12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", textDecoration: "none" }}>{item.name} ↗</a>
                        <button onClick={() => checkSource(item.id, item.url)} disabled={checking[item.id]} style={{ fontSize: "10px", color: "#1d4ed8", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "4px", padding: "2px 6px", cursor: "pointer" }}>
                          {checking[item.id] ? "…" : "Проверить"}
                        </button>
                      </div>
                      <StatusBadge st={st} small />
                      {st?.lastChecked && <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "3px" }}>{timeAgo(st.lastChecked)}</div>}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {/* ════ АКТИВ ════ */}
        {tab === "asset" && (
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", marginBottom: "4px" }}>Актив — земельные участки</h1>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px", marginBottom: "20px" }}>
              {[
                { label: "Общая площадь", val: "8 667 м²",    sub: "LN 977 + LN 989 · КО Бечичи",    color: "#1d4ed8" },
                { label: "Застройка",     val: "≤13 867 м²",  sub: "Коэф. 1.6 · Ц+3+подвал",         color: "#7e22ce" },
                { label: "Кадастр",       val: "✅ Отметка",  sub: "Блокировка продажи с 05.04.2022", color: "#15803d" },
                { label: "Компания",      val: "Активна ⚠️",  sub: "Capital Plus DOO · Банченко в ней", color: "#d97706" },
              ].map(k => (
                <div key={k.label} style={{ background: "#fff", borderRadius: "10px", padding: "12px 14px", border: "1px solid #e2e8f0", borderTop: `3px solid ${k.color}` }}>
                  <div style={{ fontSize: "16px", fontWeight: 800, color: k.color, marginBottom: "2px" }}>{k.val}</div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#374151" }}>{k.label}</div>
                  <div style={{ fontSize: "10px", color: "#64748b", marginTop: "2px" }}>{k.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
              {[
                { ln: "LN 977", area: "6 039 м²", rows: [["Участок","634"],["Тип","Шуме 2. класе"],["КО","Бечичи"],["Собственник","Capital Plus DOO ✅"],["Обременения 2017","Отсутствуют"],["Отметка спора","с 05.04.2022"]] },
                { ln: "LN 989", area: "2 628 м²", rows: [["Участки","16, 17, 18, 19, 20"],["Тип","Каменя нива / воћњак"],["КО","Бечичи"],["Собственник","Capital Plus DOO ✅"],["Обременения 2017","Отсутствуют"],["Отметка спора","с 05.04.2022"]] },
              ].map(l => (
                <Card key={l.ln}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#1d4ed8", background: "#eff6ff", padding: "3px 10px", borderRadius: "5px", border: "1px solid #bfdbfe" }}>{l.ln}</span>
                    <span style={{ fontSize: "26px", fontWeight: 800, color: "#0f172a" }}>{l.area}</span>
                  </div>
                  {l.rows.map(([k,v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f1f5f9" }}>
                      <span style={{ fontSize: "13px", color: "#475569" }}>{k}</span>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>{v}</span>
                    </div>
                  ))}
                </Card>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
              <Card>
                <Sec>Параметры застройки (ДУП)</Sec>
                {[["Итого","8 667 м²"],["Коэф. застройки","1.6"],["Застраиваемая пл.","≤13 867 м²"],["Этажность","Ц+3+подвал"],["Кол-во вилл","26 штук"],["До моря","800 м"]].map(([k,v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f1f5f9" }}>
                    <span style={{ fontSize: "13px", color: "#475569" }}>{k}</span>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{v}</span>
                  </div>
                ))}
              </Card>
              <Card>
                <Sec>Capital Plus DOO</Sec>
                {[["ПИБ","0000002697394"],["Регистрация","Подгорица, ЧГ"],["Адрес","Ул. Сердара Јола Пилетића"],["Учредитель","Чепинога Сергей ✅"],["Директор","Банченко В. ⚠️"],["Статус","Активная компания"]].map(([k,v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f1f5f9" }}>
                    <span style={{ fontSize: "13px", color: "#475569" }}>{k}</span>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a", textAlign: "right", maxWidth: "140px" }}>{v}</span>
                  </div>
                ))}
              </Card>
              <Card style={{ borderColor: "#fecaca" }}>
                <Sec>⚠️ Цепочка владения</Sec>
                {[
                  { l: "Capital Plus DOO",      n: "Законный ✅", c: "#15803d" },
                  { l: "↓ договор UZZ 712/20",  n: "ОСПАРИВАЕТСЯ", c: "#dc2626" },
                  { l: "Hrast CG DOO",          n: "Получатель", c: "#d97706" },
                  { l: "↓ UPI-1175/25",         n: "ОТМЕНЕНА ✓", c: "#15803d" },
                  { l: "Сеад Крновршанин",      n: "Отменено ✓", c: "#475569" },
                  { l: "Romulus Partners DOO",  n: "Отклонено ✓", c: "#475569" },
                ].map((r,i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 7px", borderRadius: "4px", background: i%2===0?"#f8fafc":"transparent", marginBottom: "2px" }}>
                    <span style={{ fontSize: "12px", color: "#374151" }}>{r.l}</span>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: r.c }}>{r.n}</span>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        )}

        {/* ════ ЛОКАЦИЯ ════ */}
        {tab === "location" && (
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", marginBottom: "4px" }}>Локация актива</h1>
            <p style={{ fontSize: "13px", color: "#475569", marginBottom: "22px" }}>
              Ивановичи, Бечичи · Будва · Черногория · над отелем Splendid Conference & Spa Resort 5★ · 800 м от моря
            </p>

            {/* Google Maps embed */}
            <Card style={{ marginBottom: "14px", padding: "0", overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9" }}>
                <Sec>Интерактивная карта — Ивановичи, Бечичи</Sec>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <a href="https://www.google.com/maps/place/Ivanovici,+Budva,+Montenegro/@42.2736,18.8631,15z" target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: "12px", fontWeight: 700, color: "#fff", background: "#1d4ed8", padding: "6px 14px", borderRadius: "6px", textDecoration: "none" }}>
                    🗺️ Открыть в Google Maps ↗
                  </a>
                  <a href="https://www.google.com/maps/search/Hotel+Splendid+Becici+Montenegro/@42.268,18.866,14z" target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: "12px", fontWeight: 700, color: "#1d4ed8", background: "#eff6ff", border: "1px solid #bfdbfe", padding: "6px 14px", borderRadius: "6px", textDecoration: "none" }}>
                    📍 Отель Splendid (ориентир) ↗
                  </a>
                  <a href="https://www.google.com/maps/place/Becici,+Montenegro/@42.265,18.870,14z" target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: "12px", fontWeight: 700, color: "#1d4ed8", background: "#eff6ff", border: "1px solid #bfdbfe", padding: "6px 14px", borderRadius: "6px", textDecoration: "none" }}>
                    🏖️ Пляж Бечичи ↗
                  </a>
                </div>
              </div>
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3016.1!2d18.863!3d42.274!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x134debb2aaf7ab91%3A0x8f9dcbdd23e7d8b4!2sBe%C4%8Di%C4%87i%2C%20Montenegro!5e0!3m2!1sru!2s!4v1"
                width="100%" height="400" style={{ border: 0, display: "block" }}
                allowFullScreen loading="lazy"
              />
            </Card>

            {/* Key facts */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px", marginBottom: "14px" }}>
              {[
                { icon: "🏖️", val: "800 м",    label: "До пляжа",        sub: "Пляж Бечичи" },
                { icon: "🏨", val: "~300 м",   label: "До отеля Splendid", sub: "Splendid 5★" },
                { icon: "🌇", val: "~5 км",    label: "До Будвы",         sub: "Центр города" },
                { icon: "✈️", val: "~30 км",   label: "До аэропорта",     sub: "Тиват (TIV)" },
              ].map(k => (
                <div key={k.label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", textAlign: "center" }}>
                  <div style={{ fontSize: "22px", marginBottom: "6px" }}>{k.icon}</div>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>{k.val}</div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#374151" }}>{k.label}</div>
                  <div style={{ fontSize: "11px", color: "#64748b" }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Карты и схемы */}
            <Card style={{ marginBottom: "14px" }}>
              <Sec>Карты и схемы расположения</Sec>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: "10px" }}>
                {LOCATION_MAPS.map((p, i) => (
                  <a key={i} href={p.src} target="_blank" rel="noopener noreferrer" style={{ display: "block", textDecoration: "none" }}>
                    <div style={{ borderRadius: "10px", overflow: "hidden", border: "1px solid #e2e8f0" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.src} alt={p.caption} style={{ width: "100%", height: "200px", objectFit: "cover", display: "block" }}
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <div style={{ padding: "8px 10px", background: "#f8fafc" }}>
                        <div style={{ fontSize: "11px", color: "#374151", fontWeight: 600 }}>{p.caption}</div>
                        <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "2px" }}>Нажмите для полного размера ↗</div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </Card>

            {/* Реальные фото участка */}
            <Card>
              <Sec>Фотографии участка и района Бечичи</Sec>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: "10px" }}>
                {LOCATION_PHOTOS.map((p, i) => (
                  <a key={i} href={p.src} target="_blank" rel="noopener noreferrer" style={{ display: "block", textDecoration: "none" }}>
                    <div style={{ borderRadius: "10px", overflow: "hidden", border: "1px solid #e2e8f0" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.src} alt={p.caption} style={{ width: "100%", height: "210px", objectFit: "cover", display: "block" }}
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <div style={{ padding: "8px 10px", background: "#f8fafc" }}>
                        <div style={{ fontSize: "11px", color: "#374151", fontWeight: 600 }}>{p.caption}</div>
                        <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "2px" }}>Нажмите для полного размера ↗</div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ════ ПРОЕКТ ════ */}
        {tab === "project" && (
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", marginBottom: "4px" }}>Проект застройки — Бечичи, Черногория</h1>
            <p style={{ fontSize: "13px", color: "#475569", marginBottom: "18px" }}>
              Утверждённый проект · 3 фазы · Коэф. застройки 1.6 · Проект приостановлен до завершения судебных дел
            </p>

            {/* Business description */}
            <Card style={{ marginBottom: "14px", borderLeft: "4px solid #1d4ed8" }}>
              <Sec>📋 Описание проекта и условия сотрудничества</Sec>
              <p style={{ fontSize: "13px", color: "#374151", lineHeight: "1.7", marginBottom: "14px" }}>
                Земельный участок 8 667 м² в Бечичи / Ивановичи, Будва, Черногория. Расположен выше отеля Splendid Conference &amp; Spa Resort 5★, в 800 м от моря.
                Проект разработан, пересмотрен и утверждён, разделён на три фазы строительства.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Технические параметры</div>
                  {[
                    ["Право собственности", "1/1 (100%)"],
                    ["Коэф. застройки", "1.6"],
                    ["Коэф. занятия участка", "0.4"],
                    ["Этажность", "Ц+3+подвал (возможно увеличение)"],
                    ["Подвал", "Не включается в БРGП"],
                    ["До моря", "800 м"],
                  ].map(([k,v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #f1f5f9" }}>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>{k}</span>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "#0f172a" }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Варианты сотрудничества</div>
                  {[
                    "Продажа земли полностью (с проектом и компанией)",
                    "Раздельная продажа участков",
                    "Совместная инвестиция (Фаза 1 с фундаментами)",
                    "Замена проекта на альтернативный",
                    "Другие предложения рассматриваются",
                  ].map((v, i) => (
                    <div key={i} style={{ fontSize: "12px", color: "#374151", padding: "4px 0", borderBottom: "1px solid #f1f5f9", display: "flex", gap: "8px" }}>
                      <span style={{ color: "#1d4ed8", flexShrink: 0 }}>→</span>{v}
                    </div>
                  ))}
                </div>
              </div>
              {/* Contact */}
              <div style={{ background: "#f0f9ff", borderRadius: "8px", padding: "12px 16px", border: "1px solid #bae6fd" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#0284c7", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>Контакт для переговоров</div>
                <div style={{ fontSize: "13px", color: "#374151" }}>
                  <div style={{ marginBottom: "8px" }}>
                    <strong>Сергей Чепинога</strong> &nbsp;·&nbsp;
                    <a href="tel:+421904878937" style={{ color: "#1d4ed8" }}>+421 904 878 937</a> &nbsp;·&nbsp;
                    <a href="mailto:serg@chepinoga.com" style={{ color: "#1d4ed8" }}>serg@chepinoga.com</a> &nbsp;·&nbsp;
                    Языки: русский, английский
                  </div>
                  <div style={{ fontSize: "12px", color: "#475569", borderTop: "1px solid #bae6fd", paddingTop: "8px" }}>
                    <strong>Юридическое сопровождение:</strong> Law Office Vujačić &nbsp;·&nbsp;
                    Адвокат: Саша Вуячич &nbsp;·&nbsp;
                    <a href="tel:+38267538885" style={{ color: "#1d4ed8" }}>+382 67 538 885</a> &nbsp;·&nbsp;
                    <a href="mailto:info@lawoffice-vujacic.com" style={{ color: "#1d4ed8" }}>info@lawoffice-vujacic.com</a> &nbsp;·&nbsp;
                    Bul. Ivana Crnojevića 56/2, 81000 Podgorica
                  </div>
                </div>
              </div>
            </Card>

            {/* Project summary */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px", marginBottom: "14px" }}>
              {[
                { icon: "📐", val: "13 867 м²",  label: "Застраиваемая площадь", sub: "Коэф. 1.6 × 8 667 м²" },
                { icon: "🔢", val: "3 фазы",     label: "Фаз строительства", sub: "Фаза 1 — фундаменты готовы" },
                { icon: "📊", val: "€370+/м²",   label: "Рыночная цена 2026", sub: "Рост с €244/м² (2021)" },
                { icon: "⏸️", val: "Приостановлен", label: "Статус", sub: "Ждём решения P.596/22" },
              ].map(k => (
                <div key={k.label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", textAlign: "center" }}>
                  <div style={{ fontSize: "22px", marginBottom: "6px" }}>{k.icon}</div>
                  <div style={{ fontSize: "17px", fontWeight: 800, color: "#0f172a" }}>{k.val}</div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#374151" }}>{k.label}</div>
                  <div style={{ fontSize: "11px", color: "#64748b" }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Phase description */}
            <Card style={{ marginBottom: "14px" }}>
              <Sec>Описание фаз строительства</Sec>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px" }}>
                {[
                  { phase: "Фаза 1 — Участок LN 989", status: "Частично начата", color: "#d97706", bg: "#fffbeb", border: "#fde68a",
                    desc: "2 628 м². Возведены опорные стены и фундаменты для 6 четырёхэтажных вилл. Возможна совместная инвестиция." },
                  { phase: "Фаза 2 — Участок LN 977", status: "Не начата", color: "#64748b", bg: "#f8fafc", border: "#e2e8f0",
                    desc: "Часть LN 977. Опорная стена возведена. По ДУП — следующая очередь вилл. Дорога включена в бюджет муниципалитета." },
                  { phase: "Фаза 3 — Участок LN 977", status: "Не начата", color: "#64748b", bg: "#f8fafc", border: "#e2e8f0",
                    desc: "6 039 м². Завершающая очередь по ДУП. Возможна альтернативная концепция застройки под другой проект." },
                ].map(p => (
                  <div key={p.phase} style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: "10px", padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{p.phase}</span>
                      <span style={{ fontSize: "10px", fontWeight: 700, color: p.color, background: "#fff", padding: "2px 8px", borderRadius: "999px", border: `1px solid ${p.border}` }}>{p.status}</span>
                    </div>
                    <p style={{ fontSize: "12px", color: "#374151", lineHeight: "1.55" }}>{p.desc}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Project documents */}
            <Card style={{ marginBottom: "14px" }}>
              <Sec>Проектные документы (PDF) — открыть в браузере</Sec>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "10px" }}>
                {PROJECT_DOCS.map((doc, i) => (
                  <a key={i} href={doc.src} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderLeft: "4px solid #1d4ed8", borderRadius: "9px", padding: "14px 16px", textDecoration: "none", color: "inherit" }}>
                    <div style={{ fontSize: "30px", flexShrink: 0 }}>📄</div>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "3px" }}>{doc.label}</div>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>{doc.note}</div>
                      <div style={{ fontSize: "11px", color: "#1d4ed8", fontWeight: 600, marginTop: "4px" }}>Открыть PDF ↗</div>
                    </div>
                  </a>
                ))}
              </div>
            </Card>

            {/* 3D Renders */}
            <Card>
              <Sec>3D рендеры и архитектурные модели застройки</Sec>
              <p style={{ fontSize: "12px", color: "#475569", marginBottom: "14px", lineHeight: "1.5" }}>
                Архитектурный проект предусматривает строительство жилого комплекса в черногорском средиземноморском стиле. 26 четырёхэтажных вилл с бассейнами, паркингом и инфраструктурой. Проект заморожен до решения суда по делу P.596/22.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: "12px" }}>
                {PROJECT_RENDERS.map((p, i) => (
                  <a key={i} href={p.src} target="_blank" rel="noopener noreferrer" style={{ display: "block", textDecoration: "none" }}>
                    <div style={{ borderRadius: "10px", overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.src} alt={p.caption} style={{ width: "100%", height: "200px", objectFit: "cover", display: "block" }}
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <div style={{ padding: "9px 12px", background: "#f8fafc", borderTop: "1px solid #f1f5f9" }}>
                        <div style={{ fontSize: "12px", color: "#374151", fontWeight: 600 }}>{p.caption}</div>
                        <div style={{ fontSize: "10px", color: "#1d4ed8", marginTop: "3px" }}>Открыть в полном размере ↗</div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ════ МОНИТОРИНГ ════ */}
        {tab === "monitoring" && (
          <div>
            {/* Header with status bar */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
              <div>
                <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", marginBottom: "4px" }}>Агенты мониторинга 24/7</h1>
                <p style={{ fontSize: "13px", color: "#475569" }}>
                  Агенты автоматически проверяют все источники каждые 30 минут · Извлекают данные · Фиксируют изменения
                </p>
              </div>
              <button onClick={checkAll} disabled={checkingAll} style={{
                fontSize: "13px", fontWeight: 700, color: "#fff",
                background: checkingAll ? "#94a3b8" : "#1d4ed8",
                border: "none", padding: "10px 20px", borderRadius: "9px",
                cursor: checkingAll ? "not-allowed" : "pointer", whiteSpace: "nowrap",
                display: "flex", alignItems: "center", gap: "7px", flexShrink: 0,
              }}>
                {checkingAll
                  ? <><span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span> Проверяю {FLAT_SOURCES.length} источников…</>
                  : "⟳ Запустить проверку всех агентов"}
              </button>
            </div>

            {/* Auto-check status bar */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px 18px", marginBottom: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: totalChecked > 0 ? "#22c55e" : "#94a3b8", boxShadow: totalChecked > 0 ? "0 0 6px #22c55e80" : "none" }} />
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                  {totalChecked > 0 ? `${okSources} из ${FLAT_SOURCES.length} источников онлайн` : "Агенты не запущены"}
                </span>
              </div>
              {monState?.updatedAt && (
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  Последняя проверка: <strong style={{ color: "#374151" }}>{fmtDate(monState.updatedAt)}</strong>
                </span>
              )}
              <span style={{ fontSize: "12px", color: "#94a3b8", marginLeft: "auto" }}>
                🔄 Автоматически каждые 30 мин.
              </span>
            </div>

            {/* Source cards with extracted data */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {ALL_SOURCES.map(cat => (
                <Card key={cat.cat}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                    <h2 style={{ fontSize: "14px", fontWeight: 700, color: cat.color, margin: 0 }}>{cat.cat}</h2>
                    <div style={{ flex: 1, height: "1px", background: "#f1f5f9" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {cat.items.map((item: { id: string; name: string; url: string; hi: boolean; desc?: string }) => {
                      const st = monState?.sources[item.id];
                      const isChecking = checking[item.id];
                      const isBotBlocked = st?.extracted?.botBlocked === 1 || (item.desc?.includes("🛡️") && !st?.lastChecked);
                      const bgColor = isBotBlocked ? "#fffbeb" : st?.status === "ok" ? "#f0fdf4" : st?.status === "error" ? "#fef2f2" : st?.status === "slow" ? "#fffbeb" : "#f8fafc";
                      return (
                        <div key={item.id} style={{
                          background: bgColor,
                          border: `1px solid ${st?.changed ? "#f59e0b" : "#e2e8f0"}`,
                          borderLeft: item.hi ? `4px solid ${cat.color}` : "1px solid #e2e8f0",
                          borderRadius: "9px", padding: "12px 14px",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                            {/* Status dot */}
                            <div style={{ width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0,
                              background: st?.status === "ok" ? "#22c55e" : st?.status === "error" ? "#ef4444" : st?.status === "slow" ? "#f59e0b" : "#94a3b8",
                              boxShadow: st?.status === "ok" ? "0 0 5px #22c55e60" : "none",
                            }} />

                            {/* Name + link */}
                            <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", textDecoration: "none", flex: 1 }}>
                              {item.name} <span style={{ color: cat.color, fontSize: "11px" }}>↗</span>
                            </a>

                            {/* Change badge */}
                            {st?.changed && (
                              <span style={{ fontSize: "10px", fontWeight: 700, background: "#fef3c7", color: "#92400e", padding: "2px 7px", borderRadius: "999px", border: "1px solid #fde68a" }}>
                                🔔 ИЗМЕНЕНИЕ
                              </span>
                            )}

                            {/* Check button */}
                            <button onClick={() => checkSource(item.id, item.url)} disabled={isChecking} style={{
                              fontSize: "11px", fontWeight: 700, flexShrink: 0,
                              color: isChecking ? "#94a3b8" : "#fff",
                              background: isChecking ? "#f1f5f9" : cat.color,
                              border: "none", borderRadius: "5px", padding: "4px 10px", cursor: "pointer",
                            }}>
                              {isChecking ? "⟳ …" : "Проверить"}
                            </button>
                          </div>

                          {/* Agent result / desc */}
                          {st?.note ? (
                            <div style={{ fontSize: "12px", color: isBotBlocked ? "#92400e" : st.status === "error" ? "#dc2626" : "#374151", marginBottom: "4px", fontWeight: 500 }}>
                              {st.note}
                            </div>
                          ) : item.desc ? (
                            <div style={{ fontSize: "12px", color: "#475569", marginBottom: "4px" }}>{item.desc}</div>
                          ) : (
                            <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>Нажмите «Проверить» для запуска агента</div>
                          )}

                          {/* Timestamp */}
                          <div style={{ fontSize: "11px", color: "#64748b" }}>
                            {st?.lastChecked
                              ? <>🕐 Последняя проверка агента: <strong>{fmtDate(st.lastChecked)}</strong> ({timeAgo(st.lastChecked)})</>
                              : "⏳ Нажмите «Проверить» или запустите все агенты"}
                          </div>

                          {/* Extracted data for special sources */}
                          {st?.extracted && st.status === "ok" && (() => {
                            const ex = st.extracted;
                            const parts: string[] = [];
                            if (ex.ourCasesFound)  parts.push(`⚖️ Найдены дела: ${ex.ourCasesFound}`);
                            if (ex.listingCount)   parts.push(`📋 Объявлений: ${ex.listingCount}`);
                            if (ex.priceMin && ex.priceMax) parts.push(`💶 Цены: €${((ex.priceMin as number)/1000).toFixed(0)}K – €${((ex.priceMax as number)/1000).toFixed(0)}K`);
                            if (ex.searchAvailable === 1) parts.push("🔍 Поиск по ПИБ доступен");
                            if (!parts.length) return null;
                            return (
                              <div style={{ marginTop: "6px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                {parts.map((p, i) => (
                                  <span key={i} style={{ fontSize: "11px", fontWeight: 600, background: "#fff", border: `1px solid ${cat.color}30`, color: cat.color, padding: "2px 8px", borderRadius: "5px" }}>
                                    {p}
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ))}
            </div>

            {/* Info block */}
            <div style={{ marginTop: "16px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "10px", padding: "14px 18px" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#1d4ed8", marginBottom: "6px" }}>ℹ️ Как работают агенты</div>
              <div style={{ fontSize: "12px", color: "#374151", lineHeight: "1.7" }}>
                <strong>✅ Что делают агенты автоматически:</strong> Проверяют все официальные источники каждые 30 мин · Ищут ваши дела (P.24/21, P.596/22) в базе ПУБЛИЧНЫХ РЕШЕНИЙ суда · Проверяют статус кадастра (eKatastar) · Извлекают цены с Estitor · Фиксируют изменения с прошлой проверки<br/>
                <strong>🛡️ Почему некоторые сайты показывают «защита бота»:</strong> Tranio, Properstar, Global Property Guide используют Cloudflare Anti-Bot — они блокируют любые серверные запросы. Это НЕ ошибка — это их политика. Эти сайты нужно открывать вручную (клик ↗). Данные известны: Бечичи 2026 = €300–917/м².<br/>
                <strong>📎 Для обновления данных по делам:</strong> Загружайте PDF-отчёты адвоката в разделе «Суд. дела» — агент автоматически извлечёт даты, номера дел и ключевые факты.
              </div>
            </div>
          </div>
        )}

      </div>

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
