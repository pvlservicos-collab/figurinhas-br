"use client";

import type { QuizData } from "./QuizStep";

interface ConfirmScreenProps {
  data: QuizData;
  fotoPreviewUrl: string | null;
  onConfirm: () => void;
  onBack: () => void;
}

export default function ConfirmScreen({ data, fotoPreviewUrl, onConfirm, onBack }: ConfirmScreenProps) {
  const formatDate = (iso: string) => {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };

  const rows = [
    { label: "NOME",      value: data.nome || "—" },
    { label: "WHATSAPP",  value: data.telefone || "—" },
    { label: "CLUBE",     value: data.clube || "—" },
    { label: "DATA",   value: formatDate(data.dataNascimento) },
    ...(data.peso   ? [{ label: "PESO",   value: `${data.peso} kg` }]   : []),
    ...(data.altura ? [{ label: "ALTURA", value: `${data.altura} cm` }] : []),
  ];

  return (
    <section
      className="flex flex-col items-center min-h-[100dvh] w-full px-4 py-6 justify-start"
      style={{ background: "#FFDF00" }}
    >
      {/* Card */}
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-lg overflow-hidden animate-slide-up">

        {/* Progress bar */}
        <div className="px-5 pt-5 pb-2">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-gray-500" style={{ fontFamily: "var(--font-papernotes)" }}>
              Passo 4 de 4
            </span>
            <span className="text-xs font-bold text-copa-blue" style={{ fontFamily: "var(--font-papernotes)" }}>
              100%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-copa-blue h-2 rounded-full w-full" />
          </div>
        </div>

        {/* Body */}
        <div className="px-5 pb-6 pt-4 flex flex-col items-center">

          {/* Warning icon */}
          <div className="text-4xl mb-3">⚠️</div>

          {/* Title */}
          <h2
            className="text-2xl font-bold text-copa-blue text-center mb-3 tracking-wide"
            style={{ fontFamily: "var(--font-titulo)" }}
          >
            CONFIRA SEUS DADOS
          </h2>

          {/* Subtitle */}
          <p className="text-sm text-gray-600 text-center mb-1" style={{ fontFamily: "var(--font-papernotes)" }}>
            A figurinha será gerada em breve. Revise os dados abaixo com atenção.
          </p>
          <p className="text-sm font-bold text-gray-800 text-center mb-5" style={{ fontFamily: "var(--font-papernotes)" }}>
            Não fazemos alterações após a aprovação e pagamento.
          </p>

          {/* Photo */}
          <div className="flex flex-col items-center mb-5">
            {fotoPreviewUrl ? (
              <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-copa-blue shadow-md mb-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fotoPreviewUrl} alt="Sua foto" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-200 border-4 border-copa-blue flex items-center justify-center mb-2">
                <span className="text-3xl">📷</span>
              </div>
            )}
            <p className="text-xs font-bold text-copa-blue text-center" style={{ fontFamily: "var(--font-papernotes)" }}>
              VERIFIQUE SE O ROSTO ESTÁ BEM VISÍVEL
            </p>
          </div>

          {/* Data table */}
          <div className="w-full rounded-xl overflow-hidden border border-gray-100 mb-6">
            {rows.map((row, i) => (
              <div
                key={row.label}
                className={`flex justify-between items-center px-4 py-3 ${i < rows.length - 1 ? "border-b border-gray-100" : ""}`}
                style={{ background: i % 2 === 0 ? "#F8FAFC" : "#fff" }}
              >
                <span className="text-xs font-bold text-gray-400 tracking-widest" style={{ fontFamily: "var(--font-titulo)" }}>
                  {row.label}
                </span>
                <span className="text-sm font-bold text-gray-700 text-right max-w-[60%] truncate" style={{ fontFamily: "var(--font-papernotes)" }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          {/* Confirm button */}
          <button
            onClick={onConfirm}
            className="w-full bg-copa-blue text-copa-white font-bold text-lg py-4 rounded-2xl
              shadow-lg hover:bg-copa-blue-hover active:scale-95 transition-all duration-200 cursor-pointer tracking-[0.1em] mb-3"
            style={{ fontFamily: "var(--font-titulo)" }}
          >
            ENTENDI, GERAR FIGURINHA ⚽
          </button>

          {/* Back button */}
          <button
            onClick={onBack}
            className="w-full bg-white text-copa-blue font-bold text-base py-4 rounded-2xl
              border-2 border-copa-blue hover:bg-blue-50 active:scale-95 transition-all duration-200 cursor-pointer tracking-[0.1em]"
            style={{ fontFamily: "var(--font-titulo)" }}
          >
            CORRIGIR DADOS
          </button>
        </div>
      </div>

      {/* Dots */}
      <div className="flex gap-2 mt-5">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="w-3 h-3 rounded-full bg-copa-blue" />
        ))}
      </div>
    </section>
  );
}
