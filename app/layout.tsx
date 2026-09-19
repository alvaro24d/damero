import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Damero",
  description:
    "Un damero mágico nuevo cada día: descifra la frase célebre resolviendo las definiciones.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className="flex min-h-full flex-col font-sans"
        // Las extensiones del navegador añaden atributos al body antes de que
        // React hidrate; sin esto, React da el árbol por no coincidente.
        suppressHydrationWarning
      >{children}</body>
    </html>
  );
}
