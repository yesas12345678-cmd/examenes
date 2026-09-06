"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { Gamepad2, LogIn, LogOut, User as UserIcon, Trophy } from "lucide-react";

export default function Navbar() {
  const { data: session, status } = useSession();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-2xl bg-black/85 border-b border-yellow-500/30 shadow-[0_4px_30px_rgba(250,204,21,0.15)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Header */}
        <div className="flex items-center gap-3">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-yellow-400 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-300"></div>
            <div className="relative p-2.5 rounded-xl bg-black border border-yellow-400 text-yellow-400 flex items-center justify-center shadow-[0_0_15px_rgba(250,204,21,0.4)]">
              <Gamepad2 className="w-5 h-5" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-xl tracking-wider text-yellow-400 uppercase drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]">
                StudySync <span className="text-white">ARCADE</span>
              </h1>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black tracking-widest uppercase bg-yellow-400/20 text-yellow-300 border border-yellow-400/50 flex items-center gap-1 shadow-[0_0_10px_rgba(250,204,21,0.3)]">
                <Trophy className="w-2.5 h-2.5 text-yellow-400" /> PRO
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-bold flex items-center gap-1.5 mt-0.5 tracking-wide">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-400"></span>
              </span>
              GOOGLE CALENDAR TIME BLOCKING
            </p>
          </div>
        </div>

        {/* User Session Capsule */}
        <div className="flex items-center gap-4">
          {status === "loading" ? (
            <div className="w-28 h-9 bg-zinc-900 animate-pulse rounded-full border border-yellow-500/30" />
          ) : session ? (
            <div className="flex items-center gap-3 bg-black/90 p-1.5 pl-3.5 rounded-full border border-yellow-500/50 hover:border-yellow-400 transition-all duration-300 shadow-[0_0_20px_rgba(250,204,21,0.2)]">
              <div className="flex items-center gap-2.5">
                {session.user?.image ? (
                  <div className="relative">
                    <img
                      src={session.user.image}
                      alt={session.user.name || "Usuario"}
                      className="w-7 h-7 rounded-full ring-2 ring-yellow-400 object-cover"
                    />
                    <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-yellow-400 ring-2 ring-black"></span>
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-yellow-400/20 border border-yellow-400 flex items-center justify-center text-yellow-400 text-xs font-black">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
                <span className="text-xs font-extrabold text-yellow-300 hidden md:inline tracking-wider uppercase">
                  {session.user?.name || session.user?.email}
                </span>
              </div>

              <button
                onClick={() => signOut()}
                className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/20 rounded-full transition-all duration-200 border border-transparent hover:border-rose-500/40"
                title="Cerrar Sesión"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="relative group overflow-hidden rounded-xl p-[1px] font-black text-xs transition-all duration-300 shadow-[0_0_20px_rgba(250,204,21,0.4)] active:scale-95 uppercase tracking-wider"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 opacity-90 group-hover:opacity-100 transition-opacity"></span>
              <span className="relative flex items-center gap-2 px-4 py-2 rounded-[11px] bg-black text-yellow-400 group-hover:bg-zinc-950 transition-colors">
                <LogIn className="w-3.5 h-3.5 text-yellow-400" />
                <span>Conectar Google</span>
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}


