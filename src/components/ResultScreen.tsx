"use client";

import { useEffect, useRef } from "react";

const RECENTES = ["/f1.webp", "/f2.webp", "/f3.webp", "/f4.webp"];

function FigurinhasCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame: number;
    let x = 0;
    const speed = 0.18;
    const totalWidth = track.scrollWidth / 2;

    const tick = () => {
      x -= speed;
      if (Math.abs(x) >= totalWidth) x = 0;
      track.style.transform = `translateX(${x}px)`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const items = [...RECENTES, ...RECENTES];

  return (
    <div className="w-full overflow-hidden" style={{ maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)" }}>
      <div ref={trackRef} className="flex gap-3" style={{ width: "max-content", willChange: "transform" }}>
        {items.map((src, i) => (
          <div key={i} className="flex-shrink-0 w-20 rounded-lg overflow-hidden shadow-md" style={{ opacity: 0.5, aspectRatio: "2/3" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="w-full h-full object-cover" draggable={false} />
          </div>
        ))}
      </div>
    </div>
  );
}

interface ResultScreenProps {
  stickerUrl: string;
  stickerId: string;
  onRetry: () => void;
  onCheckout?: () => void;
}

export default function ResultScreen({ stickerUrl, stickerId, onRetry, onCheckout }: ResultScreenProps) {
  const handleCheckout = () => {
    onCheckout?.();
    try {
      const sid = sessionStorage.getItem("_fsid");
      if (sid) navigator.sendBeacon("/api/track", new Blob([JSON.stringify({ session_id: sid, step: "checkout" })], { type: "application/json" }));
    } catch { /* ignora */ }
    sessionStorage.removeItem("figurinha_sticker_url");
    sessionStorage.removeItem("figurinha_sticker_id");
    try { localStorage.setItem("figurinha_sticker_id", stickerId); } catch { /* ignore */ }
    const checkoutUrl = process.env.NEXT_PUBLIC_CHECKOUT_URL || "https://checkout.figurinhadacopadomundo.com/VCCL1O8SD2DW";

    // Capturar UTMs da URL original e cookies pra passar pro checkout
    const params = new URLSearchParams(window.location.search);
    const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid", "ttclid", "sck", "src"];
    const utms: string[] = [];

    for (const key of utmKeys) {
      // Tentar da URL atual
      let val = params.get(key);
      // Tentar do cookie (UTMify salva lá)
      if (!val) {
        const cookie = document.cookie.split(";").find(c => c.trim().startsWith(`${key}=`));
        if (cookie) val = cookie.split("=")[1];
      }
      // Tentar do localStorage (UTMify também salva lá)
      if (!val) {
        try { val = localStorage.getItem(key); } catch { /* ignore */ }
      }
      if (val && key !== "src") utms.push(`${key}=${encodeURIComponent(val)}`);
    }

    const separator = checkoutUrl.includes("?") ? "&" : "?";
    const utmString = utms.length > 0 ? `&${utms.join("&")}` : "";
    window.location.href = `${checkoutUrl}${separator}src=${stickerId}${utmString}`;
  };

  useEffect(() => {
    const preventContext = (e: MouseEvent) => e.preventDefault();
    const preventKeys = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && (e.key === "s" || e.key === "u" || e.key === "S" || e.key === "U")) ||
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "C" || e.key === "c")) ||
        e.key === "F12" ||
        e.key === "PrintScreen"
      ) {
        e.preventDefault();
      }
    };
    const preventDrag = (e: DragEvent) => e.preventDefault();

    // Bloquear zoom por pinch
    const preventZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };

    document.addEventListener("contextmenu", preventContext);
    document.addEventListener("keydown", preventKeys);
    document.addEventListener("dragstart", preventDrag);
    document.addEventListener("touchmove", preventZoom, { passive: false });

    return () => {
      document.removeEventListener("contextmenu", preventContext);
      document.removeEventListener("keydown", preventKeys);
      document.removeEventListener("dragstart", preventDrag);
      document.removeEventListener("touchmove", preventZoom);
    };
  }, []);

  return (
    <section
      className="flex flex-col items-center min-h-[100dvh] w-full px-4 py-8 justify-center"
      style={{ background: "#FFDF00", userSelect: "none", WebkitUserSelect: "none" }}
    >
      {!stickerUrl ? (
        <div className="bg-white rounded-2xl p-8 text-center border-4 border-copa-blue max-w-sm w-full animate-slide-up">
          <p className="text-4xl mb-3">⏳</p>
          <h2
            className="text-2xl font-bold text-copa-blue mb-2"
            style={{ fontFamily: "var(--font-titulo)" }}
          >
            TENTE NOVAMENTE
          </h2>
          <p className="text-base text-gray-600 mb-2" style={{ fontFamily: "var(--font-papernotes)" }}>
            Às vezes os servidores da OpenAI congestionam.
          </p>
          <p className="text-base text-gray-600 mb-6" style={{ fontFamily: "var(--font-papernotes)" }}>
            Clique em tentar novamente e será gerado automaticamente.
          </p>
          <button
            onClick={onRetry}
            className="w-full bg-copa-blue text-copa-white font-bold text-lg py-4 rounded-2xl
              shadow-lg hover:bg-copa-blue-hover active:scale-95 transition-all duration-200 cursor-pointer tracking-[0.1em]"
            style={{ fontFamily: "var(--font-titulo)" }}
          >
            TENTAR NOVAMENTE
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center w-full max-w-sm animate-slide-up">

          {/* Barra de progresso */}
          <div className="w-full px-1 mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-bold text-copa-blue" style={{ fontFamily: "var(--font-papernotes)" }}>
                Você já criou sua figurinha 🔥
              </span>
              <span className="text-sm font-black text-copa-green" style={{ fontFamily: "var(--font-titulo)" }}>95%</span>
            </div>
            <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ background: "rgba(0,35,149,0.15)" }}>
              <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: "95%", background: "linear-gradient(90deg, #009C3B, #00c94d)" }} />
            </div>
            <p className="text-xs mt-1 text-right" style={{ fontFamily: "var(--font-papernotes)", color: "rgba(0,35,149,0.5)" }}>só falta confirmar</p>
          </div>

          {/* Preview da figurinha com marca d'água */}
          <div
            className="relative w-56 md:w-64 rounded-xl overflow-hidden shadow-2xl border-3 border-copa-blue mb-6"
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={stickerUrl}
              alt="Figurinha personalizada"
              className="w-full aspect-[2/3] object-cover"
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              style={{
                pointerEvents: "none",
                userSelect: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
              }}
            />
            {/* Marca d'água repetida cobrindo toda a imagem */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ background: "rgba(0,0,0,0.04)" }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="rotate-[-30deg] absolute w-[200%]" style={{ top: `${i * 22 - 10}%`, left: "-30%" }}>
                  <p className="text-white text-xl font-black tracking-[0.3em] whitespace-nowrap"
                    style={{ fontFamily: "var(--font-titulo)", textShadow: "1px 1px 4px rgba(0,0,0,0.4)", opacity: 0.3 }}>
                    PREVIEW &nbsp; PREVIEW &nbsp; PREVIEW
                  </p>
                  <p className="text-white text-[9px] font-bold tracking-widest whitespace-nowrap mt-1"
                    style={{ fontFamily: "var(--font-papernotes)", textShadow: "1px 1px 3px rgba(0,0,0,0.3)", opacity: 0.25 }}>
                    minha-figurinha-copa2026 &nbsp;&nbsp; minha-figurinha-copa2026 &nbsp;&nbsp; minha-figurinha-copa2026
                  </p>
                </div>
              ))}
            </div>
            {/* Overlay anti-cópia */}
            <div className="absolute inset-0" />
          </div>

          {/* GOOLL */}
          <h1
            className="text-6xl md:text-8xl text-copa-blue text-center tracking-[0.1em] mb-1"
            style={{ fontFamily: "var(--font-titulo)", fontWeight: 400 }}
          >
            GOOLL!
          </h1>

          {/* Subtítulo */}
          <p
            className="text-lg md:text-xl text-copa-blue text-center font-bold mb-2"
            style={{ fontFamily: "var(--font-papernotes)" }}
          >
            Sua figurinha está pronta!
          </p>

          {/* Descrição */}
          <p
            className="text-base text-gray-600 text-center mb-6"
            style={{ fontFamily: "var(--font-papernotes)" }}
          >
            Adquira sua figurinha HOJE e concorra a 1000 reais<br />Sorteio será realizado dia 11/06/2026
          </p>

          {/* Preço centralizado com brilho */}
          <p
            className="text-5xl md:text-6xl text-copa-green text-center mb-6 relative inline-block shine-effect"
            style={{ fontFamily: "'Montserrat', Arial Black, sans-serif", fontWeight: 900 }}
          >
            R$12,90
          </p>

          {/* Botão */}
          <button
            onClick={handleCheckout}
            className="w-full text-white font-bold text-xl md:text-2xl py-5 rounded-2xl
              active:scale-95 transition-all duration-200 cursor-pointer tracking-[0.15em] relative overflow-hidden"
            style={{
              fontFamily: "var(--font-titulo)",
              background: "linear-gradient(135deg, #002395 0%, #0040CC 50%, #002395 100%)",
              boxShadow: "0 6px 24px rgba(0,35,149,0.45), inset 0 1px 0 rgba(255,255,255,0.15)",
            }}
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              ⚽ RECEBER MINHA FIGURINHA
            </span>
          </button>

          <p className="text-sm text-gray-600 text-center mt-3" style={{ fontFamily: "var(--font-papernotes)" }}>
            ✅ Inclui download em alta qualidade
          </p>

          {/* Carrossel de figurinhas */}
          <div className="w-full mt-6">
            <p className="text-xs text-center mb-2 font-bold tracking-widest uppercase" style={{ fontFamily: "var(--font-papernotes)", color: "rgba(0,35,149,0.5)" }}>
              Últimas figurinhas geradas
            </p>
            <FigurinhasCarousel />
          </div>
        </div>
      )}
    </section>
  );
}
