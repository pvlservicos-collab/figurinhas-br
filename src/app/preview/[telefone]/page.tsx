import { getDb } from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ telefone: string }>;
}

async function getPedido(telefone: string) {
  const clean = telefone.replace(/\D/g, "").slice(0, 20);
  if (clean.length < 8) return null;

  const sql = getDb();
  // Aceita com ou sem DDI (55)
  const rows = await sql`
    SELECT nome, sticker_id, preview_url, sticker_url
    FROM pedidos
    WHERE (telefone = ${clean} OR telefone = ${"55" + clean} OR telefone = ${clean.replace(/^55/, "")})
      AND sticker_url IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1
  `.catch(() => []);

  return rows[0] ?? null;
}

export default async function PreviewTelefonePage({ params }: Props) {
  const { telefone } = await params;
  const pedido = await getPedido(telefone);

  if (!pedido) notFound();

  const imageUrl = pedido.preview_url || pedido.sticker_url;
  const nome = pedido.nome || "Craque";
  const stickerId = pedido.sticker_id || "";
  const checkoutUrl = process.env.NEXT_PUBLIC_CHECKOUT_URL || "https://pay.onprofit.com.br/5Sh0FbF4?off=3wCdRS";
  const finalUrl = `${checkoutUrl}${checkoutUrl.includes("?") ? "&" : "?"}src=${stickerId}`;

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-white px-4 py-8">
      <div className="w-full max-w-sm flex flex-col items-center animate-slide-up">

        {/* Preview da figurinha */}
        <div
          className="relative w-52 md:w-64 rounded-xl overflow-hidden shadow-2xl border-3 border-copa-blue mb-6"
          onContextMenu={undefined}
          style={{ userSelect: "none" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={`Figurinha de ${nome}`}
            className="w-full aspect-[2/3] object-cover"
            draggable={false}
            style={{ pointerEvents: "none" }}
          />
          {/* Watermark overlay */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ background: "rgba(0,0,0,0.08)" }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="rotate-[-30deg] absolute w-[200%]" style={{ top: `${i * 22 - 10}%`, left: "-30%" }}>
                <p className="text-white text-xl font-black tracking-[0.3em] whitespace-nowrap"
                  style={{ fontFamily: "var(--font-titulo)", textShadow: "1px 1px 4px rgba(0,0,0,0.6)", opacity: 0.5 }}>
                  PREVIEW &nbsp; PREVIEW &nbsp; PREVIEW
                </p>
              </div>
            ))}
          </div>
        </div>

        <h1
          className="text-4xl md:text-5xl font-bold text-copa-blue text-center tracking-[0.1em] mb-2"
          style={{ fontFamily: "var(--font-titulo)" }}
        >
          ÚLTIMA CHANCE!
        </h1>

        <p className="text-lg text-center leading-relaxed mb-2" style={{ fontFamily: "var(--font-papernotes)" }}>
          A figurinha de <strong className="text-copa-blue">{nome}</strong> está prestes a ser excluída!
        </p>

        <p className="text-lg text-gray-400 line-through text-center" style={{ fontWeight: 900 }}>
          R$19,90
        </p>
        <p className="text-5xl md:text-6xl text-copa-green text-center mb-6 shine-effect" style={{ fontWeight: 900 }}>
          R$12,90
        </p>

        <a
          href={finalUrl}
          className="w-full bg-copa-green text-copa-white font-bold text-xl py-5 rounded-2xl
            shadow-lg hover:brightness-110 active:scale-95 transition-all duration-200 cursor-pointer
            tracking-[0.1em] text-center block"
          style={{ fontFamily: "var(--font-titulo)" }}
        >
          QUERO MINHA FIGURINHA
        </a>
      </div>
    </main>
  );
}
