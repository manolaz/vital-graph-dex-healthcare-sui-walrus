"use client";

import { ConnectButton } from "@mysten/dapp-kit";
import Image from "next/image";
import { useRole } from "@/components/role-context";

export function DashboardHeader() {
  const { role, setRole, isPatient, isResearcher } = useRole();

  return (
    <header className="h-16 border-b border-white/10 bg-black/20 backdrop-blur-md flex items-center justify-between px-6 z-50 relative">
      <div className="flex items-center gap-3">
        <div className="relative w-8 h-8">
             {/* Placeholder logo */}
            <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold">V</div>
        </div>
        <h1 className="text-xl font-bold bg-gradient-to-r from-teal-200 to-blue-200 bg-clip-text text-transparent">
          VitalGraph
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Role Switcher */}
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 backdrop-blur-md">
          <button
            onClick={() => setRole("patient")}
            className={`text-sm font-medium px-4 py-2 rounded-lg transition-all duration-300 ${
              isPatient
                ? "bg-teal-500/20 text-teal-300 shadow-[0_0_15px_rgba(45,212,191,0.3)] border border-teal-500/30"
                : "text-white/40 hover:text-white hover:bg-white/5"
            }`}
          >
            Patient
          </button>
          <button
            onClick={() => setRole("researcher")}
            className={`text-sm font-medium px-4 py-2 rounded-lg transition-all duration-300 ${
              isResearcher
                ? "bg-blue-500/20 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.3)] border border-blue-500/30"
                : "text-white/40 hover:text-white hover:bg-white/5"
            }`}
          >
            Researcher
          </button>
        </div>

        <ConnectButton />
      </div>
    </header>
  );
}
