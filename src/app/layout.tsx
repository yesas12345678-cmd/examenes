import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SessionWrapper from "@/components/SessionWrapper";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "StudySync - Gestión de Exámenes, Time Blocking y Notion",
  description: "Planifica tus sesiones de estudio sincronizadas con Google Calendar e integradas con Notion",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-100 min-h-screen flex flex-col antialiased selection:bg-indigo-500 selection:text-white`}>
        <SessionWrapper>
          <Navbar />
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </SessionWrapper>
      </body>
    </html>
  );
}
