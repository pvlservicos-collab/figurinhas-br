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

export default function Merci() {
  const [stickerUrl, setStickerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idFromUrl = params.get("src");
    const idFromStorage = (() => { try { return localStorage.getItem("figurinha_sticker_id"); } catch { return null; } })();
    const id = idFromUrl || idFromStorage;

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
    a.href = `/api/download?url=${encodeURIComponent(stickerUrl)}&name=ma-vignette-copa2026`;
    a.click();
  };

  return (
    <main className="flex flex-col items-center min-h-screen bg-white px-5 py-8 overflow-hidden">

      {/* Figurinhas animadas no topo */}
      <div className="relative w-56 h-56 sm:w-64 sm:h-64 mb-4 flex-shrink-0">
        <div
          className="absolute left-0 top-4 w-24 h-36 rounded-xl overflow-hidden shadow-xl z-10"
          style={{ transform: "rotate(-8deg)", animation: "wiggle 5.5s ease-in-out infinite" }}
        >
          <div className="relative w-full h-full">
            <Image src="/figurinha-camille.png" alt="Figurinha" fill className="object-cover" sizes="96px" />
            <div className="absolute inset-0 shine-effect" />
          </div>
        </div>
        <div
          className="absolute left-[58%] -translate-x-1/2 top-2 w-32 h-48 rounded-xl overflow-hidden shadow-2xl z-30"
          style={{ animation: "wiggle 5.5s ease-in-out infinite 0.5s" }}
        >
          <div className="relative w-full h-full">
            <Image src="/figurinha-antoine.png" alt="Figurinha" fill className="object-cover" sizes="128px" />
            <div className="absolute inset-0 shine-effect" style={{ animationDelay: "1s" }} />
          </div>
        </div>
        <div
          className="absolute right-0 top-4 w-24 h-36 rounded-xl overflow-hidden shadow-xl z-10"
          style={{ transform: "rotate(8deg)", animation: "wiggle-down 5.5s ease-in-out infinite 1s" }}
        >
          <div className="relative w-full h-full">
            <Image src="/figurinha-camille.png" alt="Figurinha" fill className="object-cover" sizes="96px" />
            <div className="absolute inset-0 shine-effect" style={{ animationDelay: "2s" }} />
          </div>
        </div>
      </div>

      {/* Título sempre centralizado */}
      <div className="w-full max-w-3xl flex flex-col items-center animate-slide-up">
        <h1
          className="text-5xl md:text-7xl font-bold text-copa-blue text-center tracking-[0.1em] mb-1"
          style={{ fontFamily: "var(--font-titulo)" }}
        >
          MERCI !
        </h1>
        <span className="text-5xl mb-6">⚽</span>

        {/* Card com a figurinha da pessoa — mobile: aqui (abaixo do título), PC: à direita via flex-row */}
        <div className={`w-full flex flex-col ${stickerUrl || loading ? "md:flex-row md:gap-10 md:items-start" : ""}`}>

          {/* Coluna do card — no mobile aparece primeiro (abaixo do título), no PC vai pra direita */}
          {(loading || stickerUrl) && (
            <div className="flex flex-col items-center gap-3 mb-6 md:mb-0 md:order-2 md:flex-shrink-0">
              {loading ? (
                <div className="w-48 h-72 rounded-2xl bg-gray-100 animate-pulse border-4 border-gray-200" />
              ) : stickerUrl ? (
                <>
                  <div className="w-48 rounded-2xl overflow-hidden shadow-2xl border-4 border-copa-blue">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={stickerUrl} alt="Votre vignette" className="w-full h-auto" />
                  </div>
                  <button
                    onClick={handleDownload}
                    className="w-full max-w-xs bg-copa-blue text-white font-bold text-base py-4 rounded-2xl
                      shadow-lg hover:bg-copa-blue-hover active:scale-95 transition-all duration-200 cursor-pointer tracking-[0.1em] flex items-center justify-center gap-2"
                    style={{ fontFamily: "var(--font-titulo)" }}
                  >
                    ⬇ TÉLÉCHARGER MA VIGNETTE
                  </button>
                  <p className="text-sm text-copa-blue font-bold text-center" style={{ fontFamily: "var(--font-papernotes)" }}>
                    Cliquez pour télécharger votre vignette
                  </p>
                </>
              ) : null}
            </div>
          )}

          {/* Coluna do texto — no mobile aparece depois do card, no PC vai pra esquerda */}
          <div className="flex flex-col items-center flex-1 md:order-1">
            <p
              className="text-xl text-center leading-relaxed mb-2"
              style={{ fontFamily: "var(--font-papernotes)" }}
            >
              Votre paiement a été confirmé !
            </p>

            <p
              className="text-lg text-center leading-relaxed mb-2"
              style={{ fontFamily: "var(--font-papernotes)" }}
            >
              Votre <strong className="text-copa-blue">vignette personnalisée</strong> vous sera
              envoyée par <strong className="text-copa-blue">e-mail</strong> dans
              moins de <strong className="text-copa-blue">30 minutes</strong>.
            </p>

            <p
              className="text-base text-gray-600 text-center mb-6"
              style={{ fontFamily: "var(--font-papernotes)" }}
            >
              Le fichier PDF sera prêt à imprimer, avec 9 vignettes au format standard (6,5 x 9 cm).
            </p>

            <a
              href="/"
              className="w-full bg-copa-blue text-copa-white font-bold text-xl py-5 rounded-2xl
                shadow-lg hover:bg-copa-blue-hover active:scale-95 transition-all duration-200 cursor-pointer tracking-[0.1em] text-center block"
              style={{ fontFamily: "var(--font-titulo)" }}
            >
              CRÉER UNE NOUVELLE VIGNETTE
            </a>
          </div>

        </div>
      </div>
    </main>
  );
}
