"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { GraduationCap, LogIn, LogOut, User as UserIcon, Sparkles, Activity } from "lucide-react";

export default function Navbar() {
  const { data: session, status } = useSession();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-2xl bg-slate-950/70 border-b border-slate-800/80 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Header */}
        <div className="flex items-center gap-3">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-xl blur opacity-60 group-hover:opacity-100 transition duration-300"></div>
            <div className="relative p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-indigo-400 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
                StudySync
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1 shadow-[0_0_10px_rgba(99,102,241,0.2)]">
                <Sparkles className="w-2.5 h-2.5 text-indigo-400" /> Pro
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Google Calendar Time Blocking
            </p>
          </div>
        </div>

        {/* User Session Capsule */}
        <div className="flex items-center gap-4">
          {status === "loading" ? (
            <div className="w-28 h-9 bg-slate-900/80 animate-pulse rounded-full border border-slate-800" />
          ) : session ? (
            <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-md p-1.5 pl-3.5 rounded-full border border-slate-800 hover:border-indigo-500/40 transition-all duration-300 shadow-[0_0_20px_rgba(99,102,241,0.1)]">
              <div className="flex items-center gap-2.5">
                {session.user?.image ? (
                  <div className="relative">
                    <img
                      src={session.user.image}
                      alt={session.user.name || "Usuario"}
                      className="w-7 h-7 rounded-full ring-2 ring-indigo-500/60 object-cover"
                    />
                    <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-slate-950"></span>
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-300 text-xs font-semibold">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
                <span className="text-xs font-semibold text-slate-200 hidden md:inline tracking-wide">
                  {session.user?.name || session.user?.email}
                </span>
              </div>

              <button
                onClick={() => signOut()}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-full transition-all duration-200 border border-transparent hover:border-rose-500/20"
                title="Cerrar Sesión"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="relative group overflow-hidden rounded-xl p-[1px] font-semibold text-xs transition-all duration-300 shadow-[0_0_20px_rgba(99,102,241,0.2)] active:scale-95"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 group-hover:opacity-100 opacity-80 transition-opacity"></span>
              <span className="relative flex items-center gap-2 px-4 py-2 rounded-[11px] bg-slate-950 text-white group-hover:bg-slate-950/80 transition-colors">
                <LogIn className="w-3.5 h-3.5 text-indigo-400" />
                <span>Conectar con Google</span>
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

