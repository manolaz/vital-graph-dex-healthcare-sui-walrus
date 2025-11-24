"use client";

import { DashboardHeader } from "@/components/vitalgraph/dashboard-header";
import { DigitalTwinCard } from "@/components/vitalgraph/digital-twin-card";
import { UploadHealthData } from "@/components/vitalgraph/upload-health-data";
import { DataCatalogue } from "@/components/vitalgraph/data-catalogue";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useEffect, useState, useCallback } from "react";
import { vitalService, type DigitalTwin } from "@/lib/vital-service";
import { Activity } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const account = useCurrentAccount();
  const [twin, setTwin] = useState<DigitalTwin | null>(null);
  const [loading, setLoading] = useState(false);

  const loadTwin = useCallback(async () => {
    if (!account) {
      setTwin(null);
      return;
    }

    setLoading(true);
    try {
      const data = await vitalService.getDigitalTwin(account.address);
      setTwin(data);
    } catch (e) {
      console.error(e);
      // Optionally handle specific errors or leave twin as null
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    loadTwin();
  }, [loadTwin]);

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
          <DigitalTwinCard
            twin={twin}
            loading={loading}
            onMintSuccess={loadTwin}
          />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {twin ? (
              <UploadHealthData twinId={twin.id} onUploadSuccess={loadTwin} />
            ) : (
              <div className="p-8 border border-dashed border-white/10 rounded-2xl text-center text-white/40 bg-white/[0.02]">
                <Activity className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">
                  Mint your Digital Twin identity to unlock secure health data
                  storage.
                </p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Right Column: Data Catalogue */}
        <div className="lg:col-span-8 h-full">
          <DataCatalogue twin={twin} onUpdate={loadTwin} />
        </div>
      </main>
    </div>
  );
}
