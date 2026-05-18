"use client";

import { useState, useEffect, useCallback } from "react";

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

interface FunilData {
  funnel: { step: string; count: number }[];
  leads: Lead[];
  pagos: number;
  obrigados: { session_id: string; email: string; nome: string | null; updated_at: string; telefone: string | null }[];
}

const FUNNEL_STEPS = [
  { key: "quiz_1",   label: "Card 1 — Nome/foto",      color: "#3b82f6" },
  { key: "quiz_2",   label: "Card 2 — Clube",           color: "#3b82f6" },
  { key: "quiz_3",   label: "Card 3 — Email",           color: "#3b82f6" },
  { key: "loading",  label: "Gerou figurinha",          color: "#eab308" },
  { key: "result_ok",label: "Viu preview c/ preço",     color: "#f97316" },
  { key: "checkout", label: "Clicou em comprar",        color: "#a855f7" },
];

const STEP_LABEL: Record<string, string> = {
  quiz_1:       "Card 1 — Nome/foto",
  quiz_2:       "Card 2 — Clube",
  quiz_3:       "Card 3 — Email",
  loading:      "Gerou figurinha",
  result_ok:    "Viu preview c/ preço",
  result_error: "Erro na geração",
  checkout:     "Clicou em comprar",
  obrigado:     "Comprou ✓",
};

export default function AdminDashboard() {
  const [funil, setFunil] = useState<FunilData>({ funnel: [], leads: [], pagos: 0, obrigados: [] });
  const [tab, setTab] = useState<"funil" | "leads">("funil");
  const [loading, setLoading] = useState(true);

  const fetchFunil = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/funil");
      if (res.ok) setFunil(await res.json());
    } catch { /* ignora */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFunil(); }, [fetchFunil]);
  useEffect(() => {
    const iv = setInterval(fetchFunil, 30000);
    return () => clearInterval(iv);
  }, [fetchFunil]);

  const deleteLead = async (session_id: string) => {
    await fetch("/api/track", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id }) });
    fetchFunil();
  };

  const downloadLeads = () => {
    const rows = [
      ["Nome", "Email", "Telefone", "Último card", "Clicou comprar", "Data"].join(","),
      ...funil.leads.map(l => [
        l.nome || "", l.email, l.telefone || "",
        STEP_LABEL[l.step] || l.step,
        l.cta_clicked ? "Sim" : "Não",
        new Date(l.updated_at).toLocaleString("pt-BR"),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")),
    ];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8;" }));
    a.download = "leads.csv";
    a.click();
  };

  const stepCounts = FUNNEL_STEPS.map(({ key }) => ({
    key,
    count: funil.funnel.find(f => f.step === key)?.count ?? 0,
  }));
  const maxCount = Math.max(...stepCounts.map(s => s.count), 1);

  return (
    <main className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Funil de leads</h1>
          <div className="flex gap-2">
            <button onClick={downloadLeads} className="bg-green-700 hover:bg-green-600 px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors">
              ⬇ Baixar leads CSV
            </button>
            <button onClick={fetchFunil} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors">
              {loading ? "..." : "Atualizar"}
            </button>
          </div>
        </div>

        {/* Funil / Leads tabs */}
        <div className="bg-gray-800 rounded-xl p-5 mb-6">
          <div className="flex gap-3 mb-5">
            <button onClick={() => setTab("funil")} className={`text-sm px-4 py-2 rounded-lg cursor-pointer font-bold transition-colors ${tab === "funil" ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600"}`}>
              Funil
            </button>
            <button onClick={() => setTab("leads")} className={`text-sm px-4 py-2 rounded-lg cursor-pointer font-bold transition-colors ${tab === "leads" ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600"}`}>
              Leads ({funil.leads.length})
            </button>
          </div>

          {tab === "funil" ? (
            <div className="space-y-4">
              {stepCounts.map(({ key, count }, i) => {
                const step = FUNNEL_STEPS[i];
                const pct = Math.round((count / maxCount) * 100);
                const dropPct = i > 0 && stepCounts[i - 1].count > 0
                  ? Math.round((1 - count / stepCounts[i - 1].count) * 100)
                  : null;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-300">{step.label}</span>
                      <div className="flex items-center gap-3">
                        {dropPct !== null && dropPct > 0 && (
                          <span className="text-xs text-red-400">-{dropPct}% desistiram</span>
                        )}
                        <span className="text-base font-bold text-white">{count}</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-7 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 flex items-center pl-3"
                        style={{ width: `${Math.max(pct, count > 0 ? 3 : 0)}%`, background: step.color }}
                      >
                        {pct > 10 && <span className="text-white text-xs font-bold">{pct}%</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="sticky top-0 bg-gray-800">
                  <tr className="text-gray-400 text-left text-xs border-b border-gray-700">
                    <th className="py-2 pr-4">Nome</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Telefone</th>
                    <th className="py-2 pr-4">Último card</th>
                    <th className="py-2 pr-4">Clicou comprar</th>
                    <th className="py-2 pr-4">Data</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {funil.leads.length === 0 && (
                    <tr><td colSpan={7} className="py-8 text-center text-gray-500">Nenhum lead ainda.</td></tr>
                  )}
                  {funil.leads.map(l => (
                    <tr key={l.session_id} className="border-t border-gray-700/50 text-xs hover:bg-gray-700/30">
                      <td className="py-2 pr-4 text-gray-300">{l.nome || "—"}</td>
                      <td className="py-2 pr-4 text-gray-400">{l.email}</td>
                      <td className="py-2 pr-4">
                        {l.telefone
                          ? <a href={`https://wa.me/${l.telefone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300">{l.telefone}</a>
                          : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="py-2 pr-4">
                        <span className="bg-gray-700 px-2 py-0.5 rounded text-gray-200">{STEP_LABEL[l.step] || l.step}</span>
                      </td>
                      <td className="py-2 pr-4">
                        {l.cta_clicked
                          ? <span className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded font-bold">Sim</span>
                          : <span className="text-gray-600">Não</span>}
                      </td>
                      <td className="py-2 pr-4 text-gray-500">
                        {new Date(l.updated_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-2">
                        <button onClick={() => deleteLead(l.session_id)} className="text-gray-600 hover:text-red-400 transition-colors cursor-pointer text-sm">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Obrigado — quem comprou */}
        <div className="bg-gray-800 rounded-xl p-5 mb-8">
          <h2 className="text-lg font-bold mb-4">
            Chegaram na página de obrigado
            <span className="text-green-400 ml-2 text-base">({funil.obrigados.length})</span>
          </h2>
          {funil.obrigados.length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhuma visita ainda.</p>
          ) : (
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-sm min-w-[400px]">
                <thead className="sticky top-0 bg-gray-800">
                  <tr className="text-gray-400 text-left text-xs border-b border-gray-700">
                    <th className="py-2 pr-4">Nome</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Telefone</th>
                    <th className="py-2">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {funil.obrigados.map(o => (
                    <tr key={o.session_id} className="border-t border-gray-700/50 text-xs hover:bg-gray-700/30">
                      <td className="py-2 pr-4 text-gray-300">{o.nome || "—"}</td>
                      <td className="py-2 pr-4 text-gray-400">{o.email}</td>
                      <td className="py-2 pr-4">
                        {o.telefone
                          ? <a href={`https://wa.me/${o.telefone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300">{o.telefone}</a>
                          : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="py-2 text-gray-500">
                        {new Date(o.updated_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
