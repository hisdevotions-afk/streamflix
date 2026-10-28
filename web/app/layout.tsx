import type { Metadata } from "next";
import { Urbanist } from "next/font/google";
import Rail from "@/components/Rail";
import "./globals.css";

const urbanist = Urbanist({ variable: "--font-urbanist", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = { title: "Streamflix" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${urbanist.variable} font-sans antialiased`}>
        <Rail />
        <div className="pb-20 md:pb-0 md:pl-[76px]">{children}</div>
      </body>
    </html>
  );
}
