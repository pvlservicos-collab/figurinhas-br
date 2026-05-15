"use client";

import Image from "next/image";
import { useState, useEffect } from "react";

async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch { /* continua tentando */ }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 800 * (i + 1)));
  }
  throw new Error("Falhou após tentativas");
}

export default function Obrigado() {
  const [stickerUrl, setStickerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Melhor caso: URL base64 já está na sessão (mesma aba, geração recém feita)
    const urlFromSession = (() => { try { return sessionStorage.getItem("figurinha_sticker_url"); } catch { return null; } })();
    if (urlFromSession) {
      setStickerUrl(urlFromSession);
      setLoading(false);
      return;
    }

    // 2. Fallback: buscar pela API usando ID (URL param > sessionStorage > localStorage)
    const params = new URLSearchParams(window.location.search);
    const id =
      params.get("src") ||
      (() => { try { return sessionStorage.getItem("figurinha_sticker_id"); } catch { return null; } })() ||
      (() => { try { return localStorage.getItem("figurinha_sticker_id"); } catch { return null; } })();

    if (!id) { setLoading(false); return; }

    fetchWithRetry(`/api/sticker?id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data) => { if (data.url) setStickerUrl(data.url); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = () => {
    if (!stickerUrl) return;
    const a = document.createElement("a");
    a.href = `/api/download?url=${encodeURIComponent(stickerUrl)}&name=minha-figurinha-copa2026`;
    a.click();
  };

  const handleShare = () => {
    const url = "https://gerarfigurinhas.vercel.app";
    const text = "Incrível! Transformei meu filho em figurinha da Copa do Mundo 2026! Crie a sua também:";
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text + " " + url)}`;
    window.open(whatsappUrl, "_blank");
  };

  return (
    <main className="flex flex-col items-center min-h-screen px-5 py-4 overflow-hidden" style={{ background: "#FFDF00" }}>

      {/* Figurinhas animadas no topo */}
      <div className="relative w-56 h-56 sm:w-64 sm:h-64 mb-1 flex-shrink-0">
        <div
          className="absolute left-0 top-4 w-24 h-36 rounded-xl overflow-hidden shadow-xl z-10"
          style={{ transform: "rotate(-8deg)", animation: "wiggle 5.5s ease-in-out infinite" }}
        >
          <div className="relative w-full h-full">
            <Image src="/figurinha-helena.png" alt="Figurinha Helena" fill className="object-cover" sizes="96px" />
            <div className="absolute inset-0 shine-effect" />
          </div>
        </div>
        <div
          className="absolute left-[58%] -translate-x-1/2 top-2 w-32 h-48 rounded-xl overflow-hidden shadow-2xl z-30"
          style={{ animation: "wiggle 5.5s ease-in-out infinite 0.5s" }}
        >
          <div className="relative w-full h-full">
            <Image src="/figurinha-miguel.png" alt="Figurinha Miguel" fill className="object-cover" sizes="128px" />
            <div className="absolute inset-0 shine-effect" style={{ animationDelay: "1s" }} />
          </div>
        </div>
        <div
          className="absolute right-0 top-4 w-24 h-36 rounded-xl overflow-hidden shadow-xl z-10"
          style={{ transform: "rotate(8deg)", animation: "wiggle-down 5.5s ease-in-out infinite 1s" }}
        >
          <div className="relative w-full h-full">
            <Image src="/figurinha-helena.png" alt="Figurinha Helena" fill className="object-cover" sizes="96px" />
            <div className="absolute inset-0 shine-effect" style={{ animationDelay: "2s" }} />
          </div>
        </div>
      </div>

      <div className="w-full max-w-3xl flex flex-col items-center animate-slide-up">
        <h1
          className="text-5xl md:text-7xl font-bold text-copa-blue text-center tracking-[0.1em] mb-4"
          style={{ fontFamily: "var(--font-titulo)" }}
        >
          OBRIGADO!
        </h1>

        <div className={`w-full flex flex-col ${stickerUrl || loading ? "md:flex-row md:gap-10 md:items-start" : ""}`}>

          {(loading || stickerUrl) && (
            <div className="flex flex-col items-center gap-3 mb-6 md:mb-0 md:order-2 md:flex-shrink-0">
              {loading ? (
                <div className="w-48 h-72 rounded-2xl bg-yellow-200 animate-pulse border-4 border-copa-blue" />
              ) : stickerUrl ? (
                <>
                  <div className="w-48 rounded-2xl overflow-hidden shadow-2xl border-4 border-copa-blue">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={stickerUrl} alt="Sua figurinha" className="w-full h-auto" />
                  </div>
                  <button
                    onClick={handleDownload}
                    className="w-full max-w-xs bg-copa-blue text-white font-bold text-base py-4 rounded-2xl
                      shadow-lg hover:bg-copa-blue-hover active:scale-95 transition-all duration-200 cursor-pointer tracking-[0.1em] flex items-center justify-center gap-2"
                    style={{ fontFamily: "var(--font-titulo)" }}
                  >
                    ⬇ BAIXAR MINHA FIGURINHA
                  </button>
                  <p className="text-sm text-copa-blue font-bold text-center" style={{ fontFamily: "var(--font-papernotes)" }}>
                    Clique para baixar sua figurinha
                  </p>
                </>
              ) : null}
            </div>
          )}

          <div className="flex flex-col items-center flex-1 md:order-1">
            <p
              className="text-xl text-center leading-relaxed mb-2"
              style={{ fontFamily: "var(--font-papernotes)" }}
            >
              Seu pagamento foi confirmado!
            </p>

            <p
              className="text-lg text-center leading-relaxed mb-4"
              style={{ fontFamily: "var(--font-papernotes)" }}
            >
              Sua <strong className="text-copa-blue">figurinha personalizada</strong> já está pronta! Você tem <strong className="text-copa-blue">2 opções</strong> para recebê-la:
            </p>

            <div className="w-full flex flex-col gap-3 mb-6">
              <div className="bg-white rounded-2xl p-4 border-2 border-copa-blue flex items-start gap-3">
                <span className="text-2xl">📧</span>
                <p className="text-base text-left" style={{ fontFamily: "var(--font-papernotes)" }}>
                  <strong className="text-copa-blue">Por e-mail</strong> — em até <strong>30 minutos</strong> você recebe o arquivo pronto para impressão.
                </p>
              </div>
              <div className="bg-white rounded-2xl p-4 border-2 border-copa-blue flex items-start gap-3">
                <span className="text-2xl">📱</span>
                <p className="text-base text-left" style={{ fontFamily: "var(--font-papernotes)" }}>
                  <strong className="text-copa-blue">Nessa tela</strong> — aguarde alguns instantes e sua figurinha pode aparecer aqui assim que ficar pronta.
                </p>
              </div>
            </div>

            <a
              href="/"
              onClick={() => {
                try { localStorage.removeItem("figurinha_sticker_id"); } catch { /* ignore */ }
                try { sessionStorage.removeItem("figurinha_sticker_url"); sessionStorage.removeItem("figurinha_sticker_id"); } catch { /* ignore */ }
              }}
              className="w-full bg-copa-blue text-copa-white font-bold text-xl py-5 rounded-2xl
                shadow-lg hover:bg-copa-blue-hover active:scale-95 transition-all duration-200 cursor-pointer tracking-[0.1em] text-center block mb-3"
              style={{ fontFamily: "var(--font-titulo)" }}
            >
              CRIAR NOVA FIGURINHA
            </a>

            <button
              onClick={handleShare}
              className="w-full bg-copa-green text-copa-white font-bold text-xl py-5 rounded-2xl
                shadow-lg hover:brightness-110 active:scale-95 transition-all duration-200 cursor-pointer tracking-[0.1em] flex items-center justify-center gap-3"
              style={{ fontFamily: "var(--font-titulo)" }}
            >
              <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              COMPARTILHAR COM AMIGOS
            </button>
          </div>

        </div>
      </div>
    </main>
  );
}
