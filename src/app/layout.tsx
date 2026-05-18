import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sua Figurinha Panini da Copa do Mundo 2026 | Crie agora",
  description:
    "Crie sua figurinha Panini personalizada da Copa do Mundo 2026! Sua foto com o estilo dos campeões. Arquivo digital por apenas €2,99.",
  robots: "index, follow",
  openGraph: {
    title: "Sua Figurinha Panini da Copa do Mundo 2026",
    description: "Crie sua figurinha Panini personalizada da Copa do Mundo 2026!",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link href="https://fonts.googleapis.com/css2?family=Anton&display=swap" rel="stylesheet" />
        <script type="text/javascript" src="https://assets.mycartpanda.com/cartx-ecomm-ui-assets/js/cpsales.js"></script>
      </head>
      <body className="min-h-full flex flex-col">
        <Script
          id="utmify-utms"
          src="https://cdn.utmify.com.br/scripts/utms/latest.js"
          data-utmify-prevent-xcod-sck=""
          data-utmify-prevent-subids=""
          strategy="afterInteractive"
        />
        <Script id="utmify-pixel" strategy="afterInteractive">{`
          window.pixelId = "6a0a1b0553556915bb7cb5be";
          var a = document.createElement("script");
          a.setAttribute("async", "");
          a.setAttribute("defer", "");
          a.setAttribute("src", "https://cdn.utmify.com.br/scripts/pixel/pixel.js");
          document.head.appendChild(a);
        `}</Script>
        {children}
      </body>
    </html>
  );
}
