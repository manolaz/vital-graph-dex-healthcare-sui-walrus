"use client";

import { DashboardHeader } from "@/components/vitalgraph/dashboard-header";
import { DigitalTwinCard } from "@/components/vitalgraph/digital-twin-card";
import { UploadHealthData } from "@/components/vitalgraph/upload-health-data";
import { LiquidityPools } from "@/components/vitalgraph/liquidity-pools";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useEffect, useState } from "react";
import { vitalService, type DigitalTwin } from "@/lib/vital-service";
import { FileCheck, Activity } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const account = useCurrentAccount();
  const [twin, setTwin] = useState<DigitalTwin | null>(null);

  useEffect(() => {
    if (account) {
      vitalService.getDigitalTwin(account.address).then(setTwin).catch(console.error);
    } else {
      setTwin(null);
    }
  }, [account]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-teal-500/30 overflow-hidden relative">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,_rgba(45,212,191,0.1),_transparent_50%)] pointer-events-none" />
      <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-blue-600/5 rounded-full blur-3xl pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-teal-500/5 rounded-full blur-3xl pointer-events-none mix-blend-screen" />
      
      <DashboardHeader />
      
      <main className="container mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10 pt-10">
        {/* Left Column: Identity & Upload */}
        <div className="lg:col-span-4 space-y-8">
          <DigitalTwinCard />
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.2 }}
          >
            {twin ? (
                <UploadHealthData twinId={twin.id} />
            ) : (
                <div className="p-8 border border-dashed border-white/10 rounded-2xl text-center text-white/40 bg-white/[0.02]">
                <Activity className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Mint your Digital Twin identity to unlock secure health data storage.</p>
                </div>
            )}
          </motion.div>
          
          {/* My Records List (Polished) */}
          {twin && twin.records.length > 0 && (
            <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: 0.3 }}
                className="p-5 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md"
            >
              <h3 className="text-sm font-medium text-white/60 mb-4 flex items-center gap-2">
                <FileCheck className="h-4 w-4" /> My Verified Records
              </h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {twin.records.map((r, i) => (
                  <div key={i} className="group text-sm p-3 bg-black/20 hover:bg-white/5 border border-transparent hover:border-white/10 rounded-lg flex justify-between items-center transition-all">
                    <span className="truncate max-w-[180px] text-white/80">{r.name}</span>
                    <span className="text-[10px] uppercase font-bold text-teal-400 bg-teal-500/10 px-2 py-1 rounded border border-teal-500/20">Verified</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Right Column: Marketplace */}
        <div className="lg:col-span-8 h-full">
          <LiquidityPools twin={twin} />
        </div>
      </main>
    </div>
  );
}
