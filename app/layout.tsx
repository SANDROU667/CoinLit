import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import { AuthDialog } from "@/components/auth/AuthDialog";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
  display: "swap"
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap"
});

export const metadata: Metadata = {
  title: "CoinLit | Образовательная платформа по криптофинансам",
  description:
    "CoinLit — бесплатная образовательная платформа: треки Base/Medium/High, база знаний, тесты, риск-менеджмент и развитие дисциплины инвестора.",
  keywords: ["криптовалюта", "Bitcoin", "Ethereum", "финансовая грамотность", "инвестиции", "риск-менеджмент", "обучение"]
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" data-scroll-behavior="smooth">
      <body className={`${manrope.variable} ${spaceGrotesk.variable}`}>
        {children}
        <AuthDialog />
      </body>
    </html>
  );
}
