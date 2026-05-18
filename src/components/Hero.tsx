"use client";

import Image from "next/image";

interface HeroProps {
  onStart: () => void;
}

export default function Hero({ onStart }: HeroProps) {
  return (
    <section className="flex flex-col items-center min-h-[100dvh] w-full px-5 pt-8 pb-4 text-center overflow-hidden justify-center gap-3 md:gap-2 md:py-6" style={{ background: "#FFDF00" }}>
      <h1
        className="text-[2.85rem] sm:text-[2.85rem] md:text-[3.42rem] lg:text-[3.42rem] font-normal leading-[1.32] mb-1 w-full max-w-2xl"
        style={{ fontFamily: "var(--font-titulo)" }}
      >
        Transforme seu filho em uma{" "}
        <span style={{ color: "#002395" }}>figurinha personalizada</span> da Copa do Mundo
      </h1>

      <div className="relative w-72 h-72 sm:w-80 sm:h-80 md:w-96 md:h-[340px] mb-6 -mt-3">
        <div
          className="absolute left-0 top-14 md:top-16 w-36 h-52 md:w-48 md:h-72 rounded-xl overflow-hidden shadow-md z-10"
          style={{
            transform: "rotate(-8deg) translateZ(0)",
            animation: "wiggle 4s ease-in-out infinite",
            willChange: "transform",
            backfaceVisibility: "hidden",
          }}
        >
          <div className="relative w-full h-full">
            <Image
              src="/figurinha-helena.png"
              alt="Figurinha Helena"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 144px, 192px"
              priority
            />
            <div className="absolute inset-0 shine-effect" />
          </div>
        </div>

        <div
          className="absolute left-[58%] -translate-x-1/2 top-8 w-44 h-64 md:w-60 md:h-[340px] rounded-xl overflow-hidden shadow-md z-30"
          style={{
            transform: "translateZ(0)",
            animation: "wiggle-center 4s ease-in-out infinite 0.5s",
            willChange: "transform",
            backfaceVisibility: "hidden",
          }}
        >
          <div className="relative w-full h-full">
            <Image
              src="/figurinha-miguel.png"
              alt="Figurinha Miguel"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 176px, 240px"
              priority
            />
            <div className="absolute inset-0 shine-effect" style={{ animationDelay: "1s" }} />
          </div>
        </div>

        <div
          className="absolute right-0 top-14 md:top-16 w-36 h-52 md:w-48 md:h-72 rounded-xl overflow-hidden shadow-md z-10"
          style={{
            transform: "rotate(8deg) translateZ(0)",
            animation: "wiggle-down 4s ease-in-out infinite 1s",
            willChange: "transform",
            backfaceVisibility: "hidden",
          }}
        >
          <div className="relative w-full h-full">
            <Image
              src="/figurinha-helena.png"
              alt="Figurinha Helena"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 144px, 192px"
              priority
            />
            <div className="absolute inset-0 shine-effect" style={{ animationDelay: "2s" }} />
          </div>
        </div>
      </div>

      <p
        className="text-lg md:text-xl max-w-md mb-2 leading-relaxed mt-2 md:mt-5"
        style={{ fontFamily: "var(--font-papernotes)" }}
      >
        Responda algumas perguntas rápidas e veja como criar uma figurinha exclusiva,
        com o nome, foto e estilo do seu pequeno craque.
      </p>

      <button
        onClick={onStart}
        className="w-full max-w-md bg-copa-blue text-copa-white font-bold text-2xl md:text-3xl py-5 rounded-2xl
          shadow-lg hover:bg-copa-blue-hover active:scale-95 transition-all duration-200
          animate-pulse-glow cursor-pointer tracking-[0.15em]"
        style={{ fontFamily: "var(--font-titulo)" }}
      >
        INICIAR
      </button>

      <div className="mt-2 flex flex-col items-center gap-2">
        <div className="flex items-center gap-1">
          {[
            { code: "br", label: "Brasil", big: true },
            { code: "fr", label: "França", big: false },
            { code: "ar", label: "Argentina", big: false },
            { code: "de", label: "Alemanha", big: false },
            { code: "es", label: "Espanha", big: false },
          ].map(({ code, label, big }) => (
            <img
              key={code}
              src={`https://flagcdn.com/w${big ? "80" : "40"}/${code}.png`}
              alt={label}
              width={big ? 44 : 32}
              height={big ? 30 : 21}
              className={`rounded shadow-md border border-gray-200 ${big ? "" : "opacity-80"}`}
              style={{ transition: "transform 0.2s" }}
            />
          ))}
        </div>
        <p className="text-sm font-bold" style={{ fontFamily: "var(--font-papernotes)" }}>
          +2.500 figurinhas já criadas!
        </p>
      </div>
    </section>
  );
}
