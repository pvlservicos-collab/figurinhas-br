"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Chart as ChartType } from "chart.js";

interface Lead {
  session_id: string;
  email: string;
  nome: string | null;
  step: string;
  updated_at: string;
  telefone: string | null;
  cta_clicked: boolean;
  obrigado: boolean;
}

interface ApiKeyStats {
  api_key_used: number;
  total: number;
  avg_ms: number;
  min_ms: number;
  max_ms: number;
}
interface ApiGenRecente {
  nome: string | null;
  email: string;
  api_key_used: number;
  generation_ms: number;
  created_at: string;
}
interface ApiStats {
  perKey: ApiKeyStats[];
  recentes: ApiGenRecente[];
}

interface FunilData {
  funnel: { step: string; count: number }[];
  leads: Lead[];
  pagos: number;
  obrigados: { session_id: string; email: string; nome: string | null; updated_at: string; telefone: string | null }[];
  daily: { day: string; count: number }[];
}

const FUNNEL_STEPS = [
  { key: "quiz_1",       label: "Card 2 — Nome/foto",       color: "#3b82f6" },
  { key: "quiz_2",       label: "Card 3 — Clube",           color: "#3b82f6" },
  { key: "quiz_3",       label: "Card 4 — Email",           color: "#3b82f6" },
  { key: "confirm",      label: "Confira seus dados",       color: "#06b6d4" },
  { key: "loading",      label: "Gerou figurinha",          color: "#eab308" },
  { key: "saiu_gerando", label: "Saiu durante geração",     color: "#f97316" },
  { key: "result_ok",    label: "Viu preview c/ preço",     color: "#22c55e" },
  { key: "result_error", label: "Erro na geração",          color: "#ef4444" },
  { key: "checkout",     label: "Clicou em comprar",        color: "#a855f7" },
];

const STEP_LABEL: Record<string, string> = {
  quiz_1:       "Card 2 — Nome/foto",
  quiz_2:       "Card 3 — Clube",
  quiz_3:       "Card 4 — Email",
  confirm:      "Confira seus dados",
  loading:      "Gerou figurinha",
  saiu_gerando: "Saiu durante geração",
  result_ok:    "Viu preview c/ preço",
  result_error: "Erro na geração",
  checkout:     "Clicou em comprar",
  obrigado:     "Comprou ✓",
};

type Period = "today" | "7d" | "30d" | "all";

const EMPTY: FunilData = { funnel: [], leads: [], pagos: 0, obrigados: [], daily: [] };

export default function AdminDashboard() {
  const [data, setData]       = useState<FunilData>(EMPTY);
  const [period, setPeriod]   = useState<Period>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage]         = useState(0);
  const [apiStats, setApiStats] = useState<ApiStats | null>(null);

  // Busca de figurinha por nome
  const [searchQuery, setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState<{ id: number; nome: string; email: string; sticker_url: string | null; status: string; created_at: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchDone, setSearchDone]       = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchDone(false);
    try {
      const res = await fetch(`/api/admin/pedidos?search=${encodeURIComponent(searchQuery.trim())}&limit=20`);
      const json = await res.json();
      setSearchResults(json.pedidos || []);
    } catch { setSearchResults([]); }
    finally { setSearchLoading(false); setSearchDone(true); }
  };

  const dailyRef  = useRef<HTMLCanvasElement>(null);
  const funnelRef = useRef<HTMLCanvasElement>(null);
  const dailyInst  = useRef<ChartType | null>(null);
  const funnelInst = useRef<ChartType | null>(null);

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/funil?period=${p}`);
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(period); }, [period, fetchData]);

  useEffect(() => {
    fetch("/api/admin/api-stats")
      .then(r => r.json())
      .then(setApiStats)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { fetchData(period); return 60; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [period, fetchData]);

  // Charts
  useEffect(() => {
    if (!dailyRef.current || !funnelRef.current) return;

    import("chart.js/auto").then(({ default: Chart }) => {
      // Daily chart
      const last14 = Array.from({ length: 14 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - 13 + i);
        return d.toISOString().slice(0, 10);
      });
      const dailyMap = new Map(data.daily.map(d => [String(d.day).slice(0, 10), d.count]));
      const dailyCounts = last14.map(d => dailyMap.get(d) || 0);
      const dailyLabels = last14.map(d => { const [,m,dy] = d.split("-"); return `${dy}/${m}`; });

      if (dailyInst.current) dailyInst.current.destroy();
      if (dailyRef.current) {
        dailyInst.current = new Chart(dailyRef.current, {
          type: "bar",
          data: {
            labels: dailyLabels,
            datasets: [{ label: "Sessões", data: dailyCounts, backgroundColor: "#3b82f699", borderColor: "#3b82f6", borderWidth: 1.5, borderRadius: 4 }],
          },
          options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, grid: { color: "#E2E8F0" } }, x: { grid: { display: false } } },
          },
        });
      }

      // Funnel chart
      const funnelCounts = FUNNEL_STEPS.map(s => data.funnel.find(f => f.step === s.key)?.count || 0);
      if (funnelInst.current) funnelInst.current.destroy();
      if (funnelRef.current) {
        funnelInst.current = new Chart(funnelRef.current, {
          type: "bar",
          data: {
            labels: FUNNEL_STEPS.map(s => s.label),
            datasets: [{
              label: "Sessões",
              data: funnelCounts,
              backgroundColor: FUNNEL_STEPS.map(s => s.color + "66"),
              borderColor: FUNNEL_STEPS.map(s => s.color),
              borderWidth: 1.5,
              borderRadius: 4,
            }],
          },
          options: {
            responsive: true,
            indexAxis: "y" as const,
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true, grid: { color: "#E2E8F0" } }, y: { grid: { display: false } } },
          },
        });
      }
    });

    return () => {
      dailyInst.current?.destroy();
      funnelInst.current?.destroy();
      dailyInst.current = null;
      funnelInst.current = null;
    };
  }, [data]);

  const sortedLeads   = [...data.leads].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  const totalSessions = sortedLeads.length;
  const ctaCount      = sortedLeads.filter(l => l.cta_clicked).length;
  const taxaCTA       = totalSessions > 0 ? Math.round(ctaCount / totalSessions * 100) : 0;
  const totalPages    = Math.max(1, Math.ceil(totalSessions / pageSize));
  const pagedLeads    = sortedLeads.slice(page * pageSize, page * pageSize + pageSize);

  const deleteLead = async (session_id: string) => {
    await fetch("/api/track", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id }) });
    fetchData(period);
  };

  const downloadCSV = () => {
    const rows = [
      ["Nome", "Email", "Telefone", "Último card", "Clicou comprar", "Data"].join(","),
      ...data.leads.map(l => [
        l.nome || "", l.email, l.telefone || "",
        STEP_LABEL[l.step] || l.step,
        l.cta_clicked ? "Sim" : "Não",
        new Date(l.updated_at).toLocaleString("pt-BR"),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")),
    ];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8;" }));
    a.download = "leads-figurinha.csv";
    a.click();
  };

  const PERIODS: { key: Period; label: string }[] = [
    { key: "today", label: "Hoje" },
    { key: "7d",   label: "7 dias" },
    { key: "30d",  label: "30 dias" },
    { key: "all",  label: "Tudo" },
  ];

  const KPI_CARDS = [
    { label: "Sessões",   value: totalSessions,         sub: "com email capturado",  color: "#0F172A" },
    { label: "CTA",       value: ctaCount,              sub: "clicaram em comprar",  color: "#a855f7" },
    { label: "Compras",   value: data.pagos,            sub: "pagamentos confirmados", color: "#059669" },
    { label: "Taxa CTA",  value: `${taxaCTA}%`,         sub: "sessões → compra",     color: "#E2642A" },
  ];

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: "#F1F5F9", minHeight: "100vh", fontSize: 14, color: "#1E293B" }}>

      {/* Header */}
      <header style={{ background: "#0f0f0f", color: "#fff", padding: "14px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, background: "#3b82f6", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: "#fff" }}>F</div>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: ".04em" }}>FIGURINHA</span>
        </div>
        <h1 style={{ fontSize: 16, fontWeight: 600, color: "#93c5fd", flex: 1, margin: 0 }}>Dashboard Analytics</h1>
        <div style={{ display: "flex", gap: 6 }}>
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => { setPeriod(p.key); setCountdown(60); }}
              style={{ background: period === p.key ? "#3b82f6" : "transparent", color: period === p.key ? "#fff" : "#94A3B8", border: `1px solid ${period === p.key ? "#3b82f6" : "#333"}`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "all .15s" }}>
              {p.label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: "#555", marginLeft: "auto" }}>
          {loading ? "Carregando..." : `Atualiza em ${countdown}s`}
        </span>
      </header>

      <main style={{ maxWidth: 1320, margin: "0 auto", padding: "24px 20px" }}>

        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 12 }}>
            {error}
          </div>
        )}

        {/* KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 24 }}>
          {KPI_CARDS.map(c => (
            <div key={c.label} style={{ background: "#fff", borderRadius: 12, padding: "18px 16px", boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>{c.label}</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</div>
              <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 3 }}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 24 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 14 }}>📈 Sessões por dia (últimos 14 dias)</h3>
            <canvas ref={dailyRef} style={{ maxHeight: 220 }} />
          </div>
          <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 14 }}>🚪 Funil — onde as pessoas saem</h3>
            <canvas ref={funnelRef} style={{ maxHeight: 220 }} />
          </div>
        </div>

        {/* Busca de figurinha */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.07)", marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>🔍 Buscar figurinha por nome / email</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Nome, email, clube ou telefone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              style={{ flex: 1, border: "1px solid #E2E8F0", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none" }}
            />
            <button
              onClick={handleSearch}
              disabled={searchLoading}
              style={{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: searchLoading ? 0.6 : 1 }}
            >
              {searchLoading ? "..." : "Buscar"}
            </button>
          </div>

          {searchDone && (
            searchResults.length === 0 ? (
              <p style={{ fontSize: 13, color: "#94A3B8" }}>Nenhum resultado encontrado.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["Nome", "Email", "Status", "Data", "Figurinha", "Link"].map(h => (
                      <th key={h} style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#64748B", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map(p => (
                    <tr key={p.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "8px 12px", color: "#334155", fontWeight: 600 }}>{p.nome || "—"}</td>
                      <td style={{ padding: "8px 12px", color: "#64748B" }}>{p.email}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700, background: p.status === "entregue" ? "#D1FAE5" : "#FEF3C7", color: p.status === "entregue" ? "#065F46" : "#92400E" }}>
                          {p.status}
                        </span>
                      </td>
                      <td style={{ padding: "8px 12px", color: "#64748B" }}>
                        {new Date(p.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        {p.sticker_url ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <img src={p.sticker_url} alt="figurinha" style={{ width: 32, height: 48, borderRadius: 4, objectFit: "cover", border: "1px solid #E2E8F0" }} />
                            <a
                              href={`/api/download?url=${encodeURIComponent(p.sticker_url)}&name=figurinha-${(p.nome || "").toLowerCase().replace(/\s+/g, "-")}`}
                              style={{ background: "#059669", color: "#fff", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 700, textDecoration: "none" }}
                            >
                              ⬇ Baixar
                            </a>
                          </div>
                        ) : (
                          <span style={{ color: "#CBD5E1", fontSize: 11 }}>Sem figurinha</span>
                        )}
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        {p.email && (
                          <button
                            onClick={() => {
                              const link = `https://gerarfigurinhas.vercel.app/obrigado?email=${encodeURIComponent(p.email)}`;
                              navigator.clipboard.writeText(link);
                            }}
                            style={{ background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                          >
                            🔗 Copiar link
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>

        {/* API Stats */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.07)", marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>⚡ Uso das APIs de geração</h3>

          {/* Por key */}
          {apiStats && apiStats.perKey.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 18 }}>
              {apiStats.perKey.map(k => (
                <div key={k.api_key_used} style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 14px", border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>
                    API Key {k.api_key_used}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>{k.total}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>gerações</div>
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ fontSize: 12, color: "#334155" }}>
                      <span style={{ fontWeight: 700 }}>{k.avg_ms ? (k.avg_ms / 1000).toFixed(1) : "—"}s</span>
                      <span style={{ color: "#94A3B8" }}> média</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>
                      {k.min_ms ? (k.min_ms / 1000).toFixed(1) : "—"}s – {k.max_ms ? (k.max_ms / 1000).toFixed(1) : "—"}s
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: "#94A3B8", marginBottom: 14 }}>Nenhuma geração com tracking ainda. Novos dados aparecerão aqui.</p>
          )}

          {/* Últimas gerações */}
          {apiStats && apiStats.recentes.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".04em" }}>Últimas gerações</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {["Nome", "Email", "API Key", "Tempo", "Data"].map(h => (
                        <th key={h} style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", padding: "7px 10px", textAlign: "left", fontWeight: 700, color: "#64748B", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {apiStats.recentes.map((r, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "7px 10px", color: "#334155", fontWeight: 600 }}>{r.nome || "—"}</td>
                        <td style={{ padding: "7px 10px", color: "#64748B" }}>{r.email}</td>
                        <td style={{ padding: "7px 10px" }}>
                          <span style={{ background: "#DBEAFE", color: "#1D4ED8", borderRadius: 99, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                            Key {r.api_key_used}
                          </span>
                        </td>
                        <td style={{ padding: "7px 10px" }}>
                          <span style={{
                            fontWeight: 700,
                            color: r.generation_ms < 30000 ? "#059669" : r.generation_ms < 60000 ? "#d97706" : "#dc2626"
                          }}>
                            {(r.generation_ms / 1000).toFixed(1)}s
                          </span>
                        </td>
                        <td style={{ padding: "7px 10px", color: "#94A3B8" }}>
                          {new Date(r.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Leads table */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.07)", marginBottom: 24, overflowX: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>👥 Leads ({totalSessions})</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
              <label style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Mostrar:</label>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
                style={{ border: "1px solid #E2E8F0", borderRadius: 6, padding: "4px 8px", fontSize: 12, color: "#334155", cursor: "pointer" }}
              >
                {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} por página</option>)}
              </select>
              <button onClick={downloadCSV}
                style={{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                ⬇ Exportar CSV
              </button>
            </div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 600 }}>
            <thead>
              <tr>
                {["Data", "Nome", "Email", "Telefone", "Último Card", "CTA", ""].map(h => (
                  <th key={h} style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#64748B", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedLeads.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "#94A3B8", padding: 32, fontSize: 13 }}>Nenhuma sessão ainda.</td></tr>
              ) : pagedLeads.map(l => (
                <tr key={l.session_id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "8px 12px", color: "#334155" }}>
                    {new Date(l.updated_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td style={{ padding: "8px 12px", color: "#334155" }}>{l.nome || "—"}</td>
                  <td style={{ padding: "8px 12px", color: "#64748B" }}>{l.email}</td>
                  <td style={{ padding: "8px 12px" }}>
                    {l.telefone
                      ? <a href={`https://wa.me/${l.telefone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ color: "#059669", textDecoration: "none" }}>{l.telefone}</a>
                      : <span style={{ color: "#CBD5E1" }}>—</span>}
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700, background: "#F1F5F9", color: "#475569" }}>
                      {STEP_LABEL[l.step] || l.step}
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    {l.cta_clicked
                      ? <span style={{ padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700, background: "#D1FAE5", color: "#065F46" }}>Clicou</span>
                      : <span style={{ color: "#CBD5E1" }}>—</span>}
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <button onClick={() => deleteLead(l.session_id)}
                      style={{ background: "none", border: "1px solid #E2E8F0", borderRadius: 6, color: "#94A3B8", cursor: "pointer", fontSize: 12, width: 26, height: 26, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 11, color: "#64748B" }}>
                {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalSessions)} de {totalSessions}
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => setPage(0)} disabled={page === 0}
                  style={{ border: "1px solid #E2E8F0", borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: page === 0 ? "default" : "pointer", color: page === 0 ? "#CBD5E1" : "#334155", background: "#fff" }}>«</button>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  style={{ border: "1px solid #E2E8F0", borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: page === 0 ? "default" : "pointer", color: page === 0 ? "#CBD5E1" : "#334155", background: "#fff" }}>‹</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(0, Math.min(page - 2, totalPages - 5));
                  const p = start + i;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      style={{ border: "1px solid #E2E8F0", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", background: p === page ? "#3b82f6" : "#fff", color: p === page ? "#fff" : "#334155", fontWeight: p === page ? 700 : 400 }}>
                      {p + 1}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                  style={{ border: "1px solid #E2E8F0", borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: page === totalPages - 1 ? "default" : "pointer", color: page === totalPages - 1 ? "#CBD5E1" : "#334155", background: "#fff" }}>›</button>
                <button onClick={() => setPage(totalPages - 1)} disabled={page === totalPages - 1}
                  style={{ border: "1px solid #E2E8F0", borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: page === totalPages - 1 ? "default" : "pointer", color: page === totalPages - 1 ? "#CBD5E1" : "#334155", background: "#fff" }}>»</button>
              </div>
            </div>
          )}
        </div>

        {/* Obrigado */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.07)", marginBottom: 24, overflowX: "auto" }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: data.obrigados.length > 0 ? 14 : 0 }}>
            ✅ Chegaram na página de obrigado ({data.obrigados.length})
          </h3>
          {data.obrigados.length === 0 ? (
            <p style={{ fontSize: 13, color: "#94A3B8", marginTop: 8 }}>Nenhuma visita ainda.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 400 }}>
              <thead>
                <tr>
                  {["Nome", "Email", "Telefone", "Data"].map(h => (
                    <th key={h} style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#64748B", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.obrigados.map(o => (
                  <tr key={o.session_id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "8px 12px", color: "#334155" }}>{o.nome || "—"}</td>
                    <td style={{ padding: "8px 12px", color: "#64748B" }}>{o.email}</td>
                    <td style={{ padding: "8px 12px" }}>
                      {o.telefone
                        ? <a href={`https://wa.me/${o.telefone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ color: "#059669", textDecoration: "none" }}>{o.telefone}</a>
                        : <span style={{ color: "#CBD5E1" }}>—</span>}
                    </td>
                    <td style={{ padding: "8px 12px", color: "#64748B" }}>
                      {new Date(o.updated_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>


      </main>
    </div>
  );
}
