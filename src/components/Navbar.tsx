"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { GraduationCap, LogIn, LogOut, User as UserIcon } from "lucide-react";

export default function Navbar() {
  const { data: session, status } = useSession();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-900/80 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg shadow-indigo-500/20">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-100 leading-none">StudySync</h1>
            <p className="text-xs text-slate-400 mt-1">Google Calendar Time Blocking</p>
          </div>
        </div>

        {/* User Session */}
        <div className="flex items-center gap-4">
          {status === "loading" ? (
            <div className="w-24 h-8 bg-slate-800 animate-pulse rounded-lg" />
          ) : session ? (
            <div className="flex items-center gap-3 bg-slate-800/60 p-1.5 pl-3 rounded-full border border-slate-700/60">
              <div className="flex items-center gap-2">
                {session.user?.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || "Usuario"}
                    className="w-7 h-7 rounded-full ring-2 ring-indigo-500/50"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
                <span className="text-sm font-medium text-slate-200 hidden md:inline">
                  {session.user?.name || session.user?.email}
                </span>
              </div>
              <button
                onClick={() => signOut()}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-full transition-colors"
                title="Cerrar Sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-indigo-500/25 transition-all duration-200 transform active:scale-95"
            >
              <LogIn className="w-4 h-4" />
              <span>Conectar con Google</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
