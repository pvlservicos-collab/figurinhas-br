"use client";

import { useState, useEffect, useRef } from "react";

interface LoadingScreenProps {
  title: string;
  gifUrl: string;
  longWait?: boolean;
  startTime?: number;
}

const curiosidades = [
  "La Coupe du Monde 2026 sera la première à réunir 48 équipes ! Du jamais vu dans l'histoire du foot !",
  "La France a remporté 2 Coupes du Monde : en 1998 à domicile et en 2018 en Russie. Les Bleus visent le triplé !",
  "Kylian Mbappé est devenu champion du monde à seulement 19 ans. Un talent hors norme !",
  "La première Coupe du Monde a eu lieu en 1930, en Uruguay. La France y participait déjà !",
  "Le record de buts en une Coupe du Monde ? Just Fontaine avec 13 buts en 1958 — et il jouait pour la France !",
  "Zinédine Zidane a été élu meilleur joueur du monde 3 fois de suite. Une légende absolue.",
  "Le Stade de France peut accueillir plus de 80 000 spectateurs. Une cathédrale du football.",
  "La Coupe du Monde 2026 se déroulera aux États-Unis, au Mexique et au Canada.",
  "Le but le plus rapide de l'histoire de la Coupe du Monde a été inscrit en seulement 10,8 secondes !",
  "Didier Deschamps est l'un des rares à avoir été champion du monde en tant que joueur ET en tant qu'entraîneur.",
  "Miroslav Klose est le meilleur buteur de l'histoire de la Coupe du Monde avec 16 buts.",
  "Le Brésil est la seule équipe à avoir participé à toutes les éditions de la Coupe du Monde.",
  "En 1998, la France a battu le Brésil 3-0 en finale. Zidane a marqué deux fois de la tête !",
  "Antoine Griezmann est l'un des joueurs les plus décisifs de l'histoire des Bleus.",
  "Le ballon officiel de la Coupe du Monde 2026 s'appelle « Adidas Finale 26 ».",
  "Hugo Lloris est le gardien le plus capé de l'histoire de l'équipe de France.",
  "Le Paris Saint-Germain est le club le plus titré de France avec plus de 10 championnats.",
  "L'Azteca, au Mexique, est le seul stade à avoir accueilli deux finales de Coupe du Monde.",
];

export default function LoadingScreen({ title, gifUrl, longWait, startTime }: LoadingScreenProps) {
  const [percent, setPercent] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [curiosidadeIndex, setCuriosidadeIndex] = useState(0);
  const start = useRef(startTime || Date.now());

  useEffect(() => {
    start.current = startTime || Date.now();
    setPercent(0);
    setElapsed(0);
    setCuriosidadeIndex(Math.floor(Math.random() * curiosidades.length));
  }, [startTime]);

  // Rotacionar curiosidades a cada 6 segundos
  useEffect(() => {
    if (!longWait) return;
    const interval = setInterval(() => {
      setCuriosidadeIndex((prev) => (prev + 1) % curiosidades.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [longWait]);

  useEffect(() => {
    if (!longWait) {
      const duration = 3000;
      const interval = setInterval(() => {
        const now = Date.now();
        const progress = Math.min(100, Math.round(((now - start.current) / duration) * 100));
        setPercent(progress);
        if (progress >= 100) clearInterval(interval);
      }, 50);
      return () => clearInterval(interval);
    }

    // Barra que nunca para: sobe rápido até 80%, depois lentamente até 99%
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedMs = now - start.current;
      setElapsed(Math.floor(elapsedMs / 1000));

      let newPercent: number;
      if (elapsedMs < 60000) {
        // 0-60s: sobe de 0 a 80%
        newPercent = Math.round((elapsedMs / 60000) * 80);
      } else if (elapsedMs < 180000) {
        // 60-180s: sobe lentamente de 80 a 98%
        const extra = ((elapsedMs - 60000) / 120000) * 18;
        newPercent = Math.round(80 + extra);
      } else {
        // 180s+: fica em 99%, nunca para
        newPercent = 99;
      }

      setPercent((prev) => Math.max(prev, newPercent));
    }, 200);

    return () => clearInterval(interval);
  }, [longWait]);

  return (
    <section className="flex flex-col items-center justify-center min-h-[100dvh] w-full px-4">
      <div className="w-full max-w-md bg-copa-white rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-6 animate-slide-up">
        <h2
          className="text-3xl md:text-4xl font-bold text-copa-blue tracking-[0.1em] text-center"
          style={{ fontFamily: "var(--font-titulo)" }}
        >
          {title}
        </h2>

        {longWait && (
          <p className="text-sm font-bold text-copa-blue text-center -mt-4" style={{ fontFamily: "var(--font-papernotes)" }}>
            Ne quittez pas cet écran, cela peut prendre jusqu&apos;à 2 minutes.
          </p>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={gifUrl}
          alt="Carregando..."
          className="w-48 h-48 rounded-2xl object-cover"
        />

        <p
          className="text-base text-center min-h-[3rem] transition-opacity duration-500"
          style={{ fontFamily: "var(--font-papernotes)" }}
        >
          {longWait ? (
            <>
              <span className="text-copa-blue font-bold">futur champion en célébration détecté</span>
            </>
          ) : (
            "Hihi… il aime bien"
          )}
        </p>

        <div className="w-full">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-bold text-copa-blue" style={{ fontFamily: "var(--font-papernotes)" }}>
              {longWait && elapsed > 0 ? `${elapsed}s` : "Chargement..."}
            </span>
            <span className="text-sm font-bold text-copa-blue" style={{ fontFamily: "var(--font-papernotes)" }}>
              {percent}%
            </span>
          </div>
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-copa-blue rounded-full transition-all duration-300 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
