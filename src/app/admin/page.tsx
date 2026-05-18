"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Pedido {
  id: number;
  nome: string;
  clube: string;
  jogador_favorito: string;
  sticker_url: string;
  sticker_id: string;
  status: string;
  email: string | null;
  telefone: string | null;
  pdf_url: string | null;
  whats_pendente: boolean;
  whats_enviado: boolean;
  created_at: string;
  paid_at: string | null;
  delivered_at: string | null;
}

interface Stats {
  total: number;
  pendentes: number;
  pagos: number;
  entregues: number;
}

interface FunilData {
  funnel: { step: string; count: number }[];
  leads: { session_id: string; email: string; nome: string | null; step: string; updated_at: string; telefone: string | null }[];
  pagos: number;
}

const FUNNEL_STEPS = [
  { key: "quiz_1", label: "Iniciou quiz", color: "text-white" },
  { key: "quiz_2", label: "Etapa 2", color: "text-blue-300" },
  { key: "quiz_3", label: "Etapa 3", color: "text-blue-400" },
  { key: "loading", label: "Gerou figurinha", color: "text-yellow-400" },
  { key: "result_ok", label: "Viu preview", color: "text-orange-400" },
  { key: "checkout", label: "Clicou checkout", color: "text-purple-400" },
  { key: "pago", label: "Pagou", color: "text-green-400" },
];

const STEP_LABEL: Record<string, string> = {
  quiz_1: "Iniciou quiz", quiz_2: "Etapa 2", quiz_3: "Etapa 3",
  loading: "Gerou figurinha", result_ok: "Viu preview", result_error: "Erro geração", checkout: "Clicou checkout",
};

export default function AdminDashboard() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pendentes: 0, pagos: 0, entregues: 0 });
  const [loading, setLoading] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [searchDebounce, setSearchDebounce] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendPedidoId, setResendPedidoId] = useState<number | null>(null);
  const [resendStatus, setResendStatus] = useState("");
  const [funil, setFunil] = useState<FunilData | null>(null);
  const [funilTab, setFunilTab] = useState<"funil" | "leads">("funil");

  const pedidosRef = useRef(pedidos);
  pedidosRef.current = pedidos;

  const fetchFunil = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/funil");
      if (res.ok) setFunil(await res.json());
    } catch { /* ignora */ }
  }, []);

  const fetchPedidos = useCallback(async (searchTerm = "", append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);
    try {
      const offset = append ? pedidosRef.current.length : 0;
      const params = new URLSearchParams({ offset: String(offset), limit: "100" });
      if (searchTerm.trim()) params.set("search", searchTerm.trim());
      const res = await fetch(`/api/admin/pedidos?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      if (append) {
        setPedidos(prev => [...prev, ...data.pedidos]);
      } else {
        setPedidos(data.pedidos);
      }
      setStats(data.stats);
      setHasMore(data.hasMore);
    } catch { /* ignora */ } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchPedidos();
    fetchFunil();
  }, [fetchPedidos, fetchFunil]);

  // Debounce pesquisa
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounce(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchPedidos(searchDebounce);
  }, [searchDebounce, fetchPedidos]);

  useEffect(() => {
    const interval = setInterval(() => { fetchPedidos(searchDebounce); fetchFunil(); }, 30000);
    return () => clearInterval(interval);
  }, [searchDebounce, fetchPedidos, fetchFunil]);

  useEffect(() => {
    if (viewerIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewerIndex(null);
      if (e.key === "ArrowLeft" && viewerIndex > 0) setViewerIndex(viewerIndex - 1);
      if (e.key === "ArrowRight" && viewerIndex < pedidos.length - 1) setViewerIndex(viewerIndex + 1);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  });

  const handleResend = async (pedidoId: number, email: string) => {
    setResendStatus("Enviando...");
    try {
      const res = await fetch("/api/admin/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId, email }),
      });
      const data = await res.json();
      if (res.ok) {
        setResendStatus("Enviado!");
        setResendPedidoId(null);
        setResendEmail("");
        fetchPedidos();
      } else {
        setResendStatus(data.error || "Erro");
      }
    } catch {
      setResendStatus("Erro de conexão");
    }
    setTimeout(() => setResendStatus(""), 3000);
  };

  const handleDownload = (url: string, nome: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `figurinha-${nome.toLowerCase().replace(/\s+/g, "-")}.png`;
    link.target = "_blank";
    link.click();
  };

  const formatPhone = (phone: string) => phone.replace(/[^0-9+]/g, "").replace(/^\+/, "");

  const handleWhatsApp = async (p: Pedido) => {
    const phone = p.telefone ? formatPhone(p.telefone) : "";
    let linksMsg = "";
    if (p.email) {
      try {
        const res = await fetch(`/api/admin/materiais?pedidoId=${p.id}&email=${encodeURIComponent(p.email)}`);
        if (res.ok) {
          const data = await res.json();
          for (const m of data.materiais) {
            if (m.url && m.url !== "processando") {
              linksMsg += `\n📎 ${m.nome}:\n${m.url}\n`;
            } else if (m.url === "processando") {
              linksMsg += `\n⏳ ${m.nome}:\nEstamos processando seu album completo para a impressão e enviaremos em breve.\n`;
            }
          }
        }
      } catch { /* ignora */ }
    }
    if (!linksMsg) {
      if (p.sticker_url) linksMsg += `\n🏆 Figurinha Avulsa:\n${p.sticker_url}\n`;
      if (p.pdf_url) linksMsg += `\n📄 PDF para Impressão:\n${p.pdf_url}\n`;
    }
    const msg = `Olá ${p.nome}! ⚽\n\nSua figurinha personalizada da Copa 2026 está pronta!\n\nAqui estão seus materiais:${linksMsg}\nObrigado pela compra! 🇧🇷\n\n✨ Conhece alguém que ia amar ter uma figurinha personalizada? Indique para os amigos:\nhttps://figurinhadacopadomundo.com/`;
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
    try {
      await fetch("/api/admin/whats-ok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId: p.id }),
      });
      fetchPedidos();
    } catch { /* ignora */ }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case "pendente": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "pago": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "entregue": return "bg-green-500/20 text-green-400 border-green-500/30";
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const viewerPedido = viewerIndex !== null ? pedidos[viewerIndex] : null;

  return (
    <main className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Dashboard Figurinhas</h1>
          <button onClick={() => { fetchPedidos(searchDebounce); fetchFunil(); }}
            className="bg-gray-700 px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors text-sm cursor-pointer">
            {loading ? "Carregando..." : "Atualizar"}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800 rounded-xl p-5 text-center">
            <p className="text-3xl font-bold">{stats.total}</p>
            <p className="text-gray-400 text-sm">Total</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-yellow-400">{stats.pendentes}</p>
            <p className="text-gray-400 text-sm">Pendentes</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-blue-400">{stats.pagos}</p>
            <p className="text-gray-400 text-sm">Pagos</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-green-400">{stats.entregues}</p>
            <p className="text-gray-400 text-sm">Entregues</p>
          </div>
        </div>

        {/* Funil */}
        {funil && (() => {
          const stepCounts = FUNNEL_STEPS.map(({ key }) => ({
            key,
            count: key === "pago" ? funil.pagos : (funil.funnel.find(f => f.step === key)?.count ?? 0),
          }));
          const maxCount = Math.max(...stepCounts.map(s => s.count), 1);

          const downloadLeads = () => {
            const rows = [
              ["Nome", "Email", "Telefone", "Etapa", "Data"].join(","),
              ...funil.leads.map(l => [
                l.nome || "", l.email, l.telefone || "", STEP_LABEL[l.step] || l.step,
                new Date(l.updated_at).toLocaleString("pt-BR"),
              ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")),
            ];
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8;" }));
            a.download = "leads.csv";
            a.click();
          };

          return (
            <div className="bg-gray-800 rounded-xl p-5 mb-6">
              <div className="flex items-center gap-4 mb-5 flex-wrap">
                <h2 className="text-lg font-bold">Funil de conversão</h2>
                <button onClick={() => setFunilTab("funil")} className={`text-sm px-3 py-1 rounded-lg cursor-pointer ${funilTab === "funil" ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600"}`}>Funil</button>
                <button onClick={() => setFunilTab("leads")} className={`text-sm px-3 py-1 rounded-lg cursor-pointer ${funilTab === "leads" ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600"}`}>Leads ({funil.leads.length})</button>
                <button onClick={downloadLeads} className="ml-auto text-sm bg-green-700 hover:bg-green-600 px-3 py-1 rounded-lg cursor-pointer">
                  ⬇ Baixar leads
                </button>
              </div>

              {funilTab === "funil" ? (
                <div className="space-y-3">
                  {stepCounts.map(({ key, count }, i) => {
                    const step = FUNNEL_STEPS[i];
                    const pct = Math.round((count / maxCount) * 100);
                    const dropPct = i > 0 && stepCounts[i - 1].count > 0
                      ? Math.round((1 - count / stepCounts[i - 1].count) * 100)
                      : null;
                    return (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-400">{step.label}</span>
                          <div className="flex items-center gap-3">
                            {dropPct !== null && dropPct > 0 && (
                              <span className="text-xs text-red-400">-{dropPct}%</span>
                            )}
                            <span className={`text-sm font-bold ${step.color}`}>{count}</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-6 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              background: key === "pago" ? "#22c55e" : key === "checkout" ? "#a855f7" : key === "result_ok" ? "#f97316" : key === "loading" ? "#eab308" : "#3b82f6",
                              minWidth: count > 0 ? "2%" : "0",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead className="sticky top-0 bg-gray-800">
                      <tr className="text-gray-400 text-left text-xs border-b border-gray-700">
                        <th className="pb-2 pr-4 py-2">Nome</th>
                        <th className="pb-2 pr-4 py-2">Email</th>
                        <th className="pb-2 pr-4 py-2">Telefone</th>
                        <th className="pb-2 pr-4 py-2">Etapa</th>
                        <th className="pb-2 py-2">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {funil.leads.map(l => (
                        <tr key={l.session_id} className="border-t border-gray-700/50 text-xs hover:bg-gray-700/30">
                          <td className="py-2 pr-4 text-gray-300">{l.nome || "—"}</td>
                          <td className="py-2 pr-4 text-gray-400">{l.email}</td>
                          <td className="py-2 pr-4">
                            {l.telefone
                              ? <a href={`https://wa.me/${l.telefone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300">{l.telefone}</a>
                              : <span className="text-gray-600">—</span>}
                          </td>
                          <td className="py-2 pr-4"><span className="bg-gray-600 px-2 py-0.5 rounded text-gray-200">{STEP_LABEL[l.step] || l.step}</span></td>
                          <td className="py-2 text-gray-500">{new Date(l.updated_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}

        {/* Busca */}
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, email ou clube..."
            className="w-full px-4 py-3 rounded-xl bg-gray-800 text-white border border-gray-700 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Status de reenvio */}
        {resendStatus && (
          <div className={`mb-4 px-4 py-3 rounded-xl text-center font-bold ${resendStatus === "Enviado!" ? "bg-green-500/20 text-green-400" : resendStatus === "Enviando..." ? "bg-blue-500/20 text-blue-400" : "bg-red-500/20 text-red-400"}`}>
            {resendStatus}
          </div>
        )}

        {/* Lista de pedidos */}
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400 text-left">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Figurinha</th>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Clube</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Criado</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p, i) => (
                  <tr key={p.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 text-gray-500">{p.id}</td>
                    <td className="px-4 py-3">
                      {p.sticker_url ? (
                        <button onClick={() => setViewerIndex(i)} className="cursor-pointer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.sticker_url} alt={p.nome} className="w-12 h-16 object-cover rounded border border-gray-600 hover:border-blue-500 transition-colors" />
                        </button>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.nome}</p>
                      {p.email && <p className="text-gray-500 text-xs">{p.email}</p>}
                      {p.telefone && (
                        <a href={`https://wa.me/${formatPhone(p.telefone)}`} target="_blank" rel="noopener noreferrer"
                          className="text-green-400 text-xs hover:text-green-300">{p.telefone}</a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-300">{p.clube}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full border font-medium ${statusBadge(p.status)}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDate(p.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {p.sticker_url && (
                          <button onClick={() => handleDownload(p.sticker_url, p.nome)}
                            title="Download figurinha"
                            className="bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded text-xs cursor-pointer transition-colors">
                            ⬇
                          </button>
                        )}
                        <button onClick={() => { setResendPedidoId(p.id); setResendEmail(p.email || ""); }}
                          title="Reenviar por email"
                          className="bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded text-xs cursor-pointer transition-colors">
                          ✉
                        </button>
                        {p.whats_pendente && !p.whats_enviado ? (
                          <button onClick={() => handleWhatsApp(p)}
                            title="Entregar no WhatsApp"
                            className="bg-orange-500 hover:bg-orange-400 px-2 py-1 rounded text-xs cursor-pointer transition-colors animate-pulse font-bold">
                            📲 Entregar
                          </button>
                        ) : p.whats_enviado && p.whats_pendente ? (
                          <span className="bg-green-700/50 text-green-400 px-2 py-1 rounded text-xs border border-green-600/30">🤖 Auto</span>
                        ) : p.whats_enviado ? (
                          <span className="bg-green-700/50 text-green-400 px-2 py-1 rounded text-xs border border-green-600/30">✅ OK</span>
                        ) : (
                          <button onClick={() => handleWhatsApp(p)}
                            title="Enviar via WhatsApp"
                            className="bg-green-600 hover:bg-green-500 px-2 py-1 rounded text-xs cursor-pointer transition-colors">
                            💬
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pedidos.length === 0 && !loading && (
            <p className="text-gray-500 text-center py-12">Nenhum pedido encontrado.</p>
          )}
        </div>

        {hasMore && (
          <button
            onClick={() => fetchPedidos(searchDebounce, true)}
            disabled={loadingMore}
            className="w-full mt-4 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl cursor-pointer transition-colors disabled:opacity-50">
            {loadingMore ? "Carregando..." : `Ver mais (${pedidos.length} exibidos)`}
          </button>
        )}
      </div>

      {/* Modal de reenvio */}
      {resendPedidoId !== null && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center" onClick={() => setResendPedidoId(null)}>
          <div className="bg-gray-800 p-6 rounded-2xl max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Reenviar Figurinha #{resendPedidoId}</h3>
            <input
              type="email"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              placeholder="Email do destinatário"
              className="w-full px-4 py-3 rounded-xl bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setResendPedidoId(null)}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-xl cursor-pointer transition-colors">
                Cancelar
              </button>
              <button onClick={() => { if (resendEmail) handleResend(resendPedidoId, resendEmail); }}
                disabled={!resendEmail}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl cursor-pointer transition-colors disabled:opacity-50">
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Viewer de figurinha */}
      {viewerPedido && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center" onClick={() => setViewerIndex(null)}>
          <button onClick={() => setViewerIndex(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white text-4xl cursor-pointer z-10">&times;</button>
          {viewerIndex! > 0 && (
            <button onClick={(e) => { e.stopPropagation(); setViewerIndex(viewerIndex! - 1); }}
              className="absolute left-4 text-white/70 hover:text-white text-5xl cursor-pointer z-10">&#8249;</button>
          )}
          <div className="flex flex-col items-center gap-4 max-w-md px-12" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewerPedido.sticker_url} alt={viewerPedido.nome} className="max-h-[60vh] w-auto rounded-xl shadow-2xl" />
            <div className="text-center">
              <p className="text-white text-xl font-bold">{viewerPedido.nome}</p>
              <p className="text-gray-400">{viewerPedido.clube} &bull; {viewerPedido.jogador_favorito}</p>
              {viewerPedido.email && <p className="text-gray-500 text-sm">{viewerPedido.email}</p>}
              {viewerPedido.telefone && (
                <a href={`https://wa.me/${formatPhone(viewerPedido.telefone)}`} target="_blank" rel="noopener noreferrer"
                  className="text-green-400 text-sm hover:text-green-300">{viewerPedido.telefone}</a>
              )}
              <p className="text-gray-500 text-sm">{formatDate(viewerPedido.created_at)}</p>
              <span className={`text-xs px-3 py-1 rounded-full border font-medium mt-2 inline-block ${statusBadge(viewerPedido.status)}`}>
                {viewerPedido.status}
              </span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => handleDownload(viewerPedido.sticker_url, viewerPedido.nome)}
                className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors">
                ⬇ Download
              </button>
              <button onClick={() => { setViewerIndex(null); setResendPedidoId(viewerPedido.id); setResendEmail(viewerPedido.email || ""); }}
                className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors">
                ✉ Reenviar
              </button>
              {viewerPedido.whats_pendente && !viewerPedido.whats_enviado ? (
                <button onClick={() => handleWhatsApp(viewerPedido)}
                  className="bg-orange-500 hover:bg-orange-400 animate-pulse px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors">
                  📲 Entregar WhatsApp
                </button>
              ) : viewerPedido.whats_enviado ? (
                <span className="bg-green-700/50 text-green-400 px-4 py-2 rounded-lg text-sm border border-green-600/30">✅ Entregue</span>
              ) : (
                <button onClick={() => handleWhatsApp(viewerPedido)}
                  className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors">
                  💬 WhatsApp
                </button>
              )}
            </div>
            <p className="text-gray-600 text-xs">{viewerIndex! + 1} de {pedidos.length}</p>
          </div>
          {viewerIndex! < pedidos.length - 1 && (
            <button onClick={(e) => { e.stopPropagation(); setViewerIndex(viewerIndex! + 1); }}
              className="absolute right-4 text-white/70 hover:text-white text-5xl cursor-pointer z-10">&#8250;</button>
          )}
        </div>
      )}
    </main>
  );
}
