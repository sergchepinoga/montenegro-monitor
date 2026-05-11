import { NextResponse } from "next/server";

// All sources to check — called by Vercel Cron daily at 07:00 UTC (09:00 Podgorica)
// Also accessible via cron-job.org for 2nd daily check at 16:00 UTC (18:00 Podgorica)
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_URL || "http://localhost:3456";

  // ALL monitoring sources
  const sources = [
    // Courts
    { id: "court_odluke",  url: "https://sudovi.me/pscg/odluke/" },
    { id: "court_rocista", url: "https://sudovi.me/pscg/kategorija/Qa" },
    { id: "court_pscg",    url: "https://sudovi.me/pscg" },
    { id: "court_ascg",    url: "https://sudovi.me/ascg" },
    // Cadastre
    { id: "katastar_e",    url: "https://ekatastar.me" },
    { id: "geoportal",     url: "https://geoportal.co.me/geoportal/geoportal_eng.html" },
    { id: "katastar_gov",  url: "https://www.gov.me/en/upravazan-ekretnine" },
    { id: "mpa",           url: "https://www.gov.me/mpa" },
    // Company registry
    { id: "crps_search",   url: "http://www.pretraga.crps.me" },
    { id: "irms",          url: "https://irms.tax.gov.me/public/search-register/business-entities" },
    { id: "efirma",        url: "http://efirma.tax.gov.me" },
    // Tax
    { id: "tax_pu",        url: "http://www.poreskauprava.gov.me" },
    { id: "tax_e",         url: "https://etaxes.tax.gov.me" },
    // Prosecution
    { id: "prosec_main",   url: "https://tuzilastvo.me" },
    { id: "police",        url: "https://www.upolicija.gov.me" },
    // Real estate
    { id: "estitor",       url: "https://estitor.com/me-en/real-estates/purpose-sale/type-land-lot/city-budva/neighbourhood-becici" },
    { id: "investropa",    url: "https://investropa.com/blogs/news/montenegro-price-forecasts" },
    { id: "srbija_nek",    url: "https://www.srbija-nekretnine.org/en/plots/for-sale/budva" },
    // Lawyer
    { id: "lawyer",        url: "https://lawoffice-vujacic.com" },
  ];

  try {
    // 1. Run source monitoring
    const res = await fetch(`${base}/api/monitor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkAll: true, sources }),
    });
    const data = await res.json();
    const checked = Object.keys(data.sources ?? {}).length;
    const ok = Object.values(data.sources ?? {}).filter((s: unknown) => (s as {status:string}).status === "ok").length;

    // 2. Run case agents — automatically search court decisions for each case
    let caseResults = null;
    try {
      const caseRes = await fetch(`${base}/api/case-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkAll: true }),
      });
      caseResults = await caseRes.json();
    } catch { /* case agent errors don't fail the cron */ }

    return NextResponse.json({
      ok: true,
      ran: new Date().toISOString(),
      sourcesChecked: checked,
      sourcesOnline: ok,
      caseAgents: caseResults?.results?.length ?? 0,
      updatedAt: data.updatedAt,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
