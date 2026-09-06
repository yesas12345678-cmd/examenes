import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SessionWrapper from "@/components/SessionWrapper";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "StudySync ARCADE - Time Blocking & Google Calendar",
  description: "Planifica y sincroniza tus sesiones de estudio en Google Calendar con temática Cyber Arcade",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className={`${inter.className} bg-black text-yellow-100 min-h-screen flex flex-col antialiased selection:bg-yellow-400 selection:text-black`}>
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

