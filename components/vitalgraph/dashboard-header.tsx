"use client";

import { ConnectButton } from "@mysten/dapp-kit";
import Image from "next/image";

export function DashboardHeader() {
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
        <ConnectButton />
      </div>
    </header>
  );
}

