"use client";

import Image from "next/image";

interface HeroProps {
  onStart: () => void;
}

export default function Hero({ onStart }: HeroProps) {
  return (
    <section className="flex flex-col items-center min-h-[100dvh] w-full px-5 py-4 text-center overflow-hidden justify-between" style={{ background: "#FFFFFF" }}>
      <h1
        className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] mb-1 max-w-2xl"
        style={{ fontFamily: "var(--font-titulo)" }}
      >
        Transformez votre enfant en{" "}
        <span style={{ color: "#002395" }}>vignette Panini personnalisée</span> de la Coupe du Monde
      </h1>

      <div className="relative w-72 h-72 sm:w-80 sm:h-80 md:w-96 md:h-[400px] mb-0 mt-1">
        <div
          className="absolute left-0 top-14 md:top-16 w-36 h-52 md:w-48 md:h-72 rounded-xl overflow-hidden shadow-xl z-10"
          style={{
            transform: "rotate(-8deg)",
            animation: "wiggle 5.5s ease-in-out infinite",
          }}
        >
          <div className="relative w-full h-full">
            <Image
              src="/figurinha-camille.png"
              alt="Figurinha Camille"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 144px, 192px"
              priority
            />
            <div className="absolute inset-0 shine-effect" />
          </div>
        </div>

        <div
          className="absolute left-[58%] -translate-x-1/2 top-8 w-44 h-64 md:w-60 md:h-[340px] rounded-xl overflow-hidden shadow-2xl z-30"
          style={{
            animation: "wiggle 5.5s ease-in-out infinite 0.5s",
          }}
        >
          <div className="relative w-full h-full">
            <Image
              src="/figurinha-antoine.png"
              alt="Figurinha Antoine"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 176px, 240px"
              priority
            />
            <div className="absolute inset-0 shine-effect" style={{ animationDelay: "1s" }} />
          </div>
        </div>

        <div
          className="absolute right-0 top-14 md:top-16 w-36 h-52 md:w-48 md:h-72 rounded-xl overflow-hidden shadow-xl z-10"
          style={{
            transform: "rotate(8deg)",
            animation: "wiggle-down 5.5s ease-in-out infinite 1s",
          }}
        >
          <div className="relative w-full h-full">
            <Image
              src="/figurinha-camille.png"
              alt="Figurinha Camille"
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
        className="text-lg md:text-xl max-w-md mb-2 leading-relaxed"
        style={{ fontFamily: "var(--font-papernotes)" }}
      >
        Répondez à quelques questions et créez une vignette unique avec le nom,
        la photo et le style de votre petit champion.
      </p>

      <button
        onClick={onStart}
        className="w-full max-w-md bg-copa-blue text-copa-white font-bold text-2xl md:text-3xl py-5 rounded-2xl
          shadow-lg hover:bg-copa-blue-hover active:scale-95 transition-all duration-200
          animate-pulse-glow cursor-pointer tracking-[0.15em]"
        style={{ fontFamily: "var(--font-titulo)" }}
      >
        COMMENCER
      </button>

      <div className="mt-2 flex flex-col items-center gap-2">
        <div className="flex items-center gap-1">
          {[
            { code: "fr", label: "França", big: true },
            { code: "br", label: "Brasil", big: false },
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
              className={`rounded shadow-md border border-gray-200 ${big ? "ring-2 ring-copa-blue" : "opacity-80"}`}
              style={{ transition: "transform 0.2s" }}
            />
          ))}
        </div>
        <p className="text-sm font-bold" style={{ fontFamily: "var(--font-papernotes)" }}>
          +2 500 vignettes déjà créées !
        </p>
      </div>
    </section>
  );
}
