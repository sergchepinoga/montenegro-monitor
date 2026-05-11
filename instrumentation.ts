// Server-side cron: auto-check all monitoring sources every 30 minutes
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const cron = await import("node-cron");
    const { readState, writeState } = await import("./lib/monitor-store");
    const { scrapeCourt, scrapeCompany, scrapeEstitor, checkGeneric } = await import("./lib/scrapers");

    const SOURCES = [
      { id: "court_pscg",   url: "https://sudovi.me/pscg",                 scraper: scrapeCourt },
      { id: "crps_search",  url: "http://www.pretraga.crps.me",             scraper: scrapeCompany },
      { id: "estitor",      url: "https://estitor.com/me-en/real-estates/purpose-sale/type-land-lot/city-budva/neighbourhood-becici", scraper: scrapeEstitor },
      { id: "katastar_e",   url: "https://ekatastarcg.me",                  scraper: (p: Record<string, string | number | null> | undefined) => checkGeneric("https://ekatastarcg.me", p) },
      { id: "tax_pu",       url: "http://www.poreskauprava.gov.me",         scraper: (p: Record<string, string | number | null> | undefined) => checkGeneric("http://www.poreskauprava.gov.me", p) },
      { id: "prosec_main",  url: "https://tuzilastvo.me",                   scraper: (p: Record<string, string | number | null> | undefined) => checkGeneric("https://tuzilastvo.me", p) },
    ];

    // Run every 30 minutes
    cron.schedule("*/30 * * * *", async () => {
      console.log("[Montenegro Monitor] Auto-check started:", new Date().toISOString());
      const state = readState();
      for (const src of SOURCES) {
        try {
          const prev = state.sources[src.id]?.extracted;
          const r = await src.scraper(prev);
          state.sources[src.id] = {
            lastChecked: new Date().toISOString(),
            status: r.ok ? (r.ms > 6000 ? "slow" : "ok") : "error",
            httpStatus: r.status,
            responseMs: r.ms,
            note: r.summary,
            extracted: r.extracted,
            changed: r.changed,
          };
          console.log(`  [${src.id}] ${r.summary}`);
        } catch (e) {
          console.error(`  [${src.id}] error:`, e);
        }
      }
      state.updatedAt = new Date().toISOString();
      writeState(state);
      console.log("[Montenegro Monitor] Auto-check done.");
    });

    console.log("[Montenegro Monitor] Cron scheduler started — auto-check every 30 min.");
  }
}
