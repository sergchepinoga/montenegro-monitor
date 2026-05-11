import { NextResponse } from "next/server";

// Called by Vercel Cron every 30 minutes — checks all high-priority sources
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3456";

  const sources = [
    { id: "court_odluke",  url: "https://sudovi.me/pscg/odluke/" },
    { id: "court_rocista", url: "https://sudovi.me/pscg/kategorija/Qa" },
    { id: "katastar_e",    url: "https://ekatastar.me" },
    { id: "geoportal",     url: "https://geoportal.co.me/geoportal/geoportal_eng.html" },
    { id: "crps_search",   url: "http://www.pretraga.crps.me" },
    { id: "irms",          url: "https://irms.tax.gov.me/public/search-register/business-entities" },
    { id: "tax_pu",        url: "http://www.poreskauprava.gov.me" },
    { id: "prosec_main",   url: "https://tuzilastvo.me" },
    { id: "estitor",       url: "https://estitor.com/me-en/real-estates/purpose-sale/type-land-lot/city-budva/neighbourhood-becici" },
    { id: "investropa",    url: "https://investropa.com/blogs/news/montenegro-price-forecasts" },
    { id: "srbija_nek",    url: "https://www.srbija-nekretnine.org/en/plots/for-sale/budva" },
  ];

  try {
    const res = await fetch(`${base}/api/monitor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkAll: true, sources }),
    });
    const data = await res.json();
    return NextResponse.json({ ok: true, ran: new Date().toISOString(), sources: Object.keys(data.sources ?? {}).length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
