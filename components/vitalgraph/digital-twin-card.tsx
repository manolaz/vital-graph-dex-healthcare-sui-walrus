"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, User, Shield, Database, HeartPulse, Sparkles } from "lucide-react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { useEffect, useState } from "react";
import { vitalService, type DigitalTwin } from "@/lib/vital-service";
import { toast } from "sonner";
import { motion } from "framer-motion";

export function DigitalTwinCard() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [twin, setTwin] = useState<DigitalTwin | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (account) {
      loadTwin();
    }
  }, [account]);

  const loadTwin = async () => {
    setLoading(true);
    try {
      const data = await vitalService.getDigitalTwin(account!.address);
      setTwin(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleMint = () => {
    if (!account) return;
    const tx = vitalService.mintDigitalTwin();
    signAndExecute({ transaction: tx }, {
      onSuccess: () => {
        toast.success("Digital Twin ID Minted!");
        setTimeout(loadTwin, 2000);
      },
      onError: () => toast.error("Failed to mint ID")
    });
  };

  if (!account) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="bg-slate-900/50 border-white/10 backdrop-blur-sm">
            <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
                <User className="h-5 w-5 text-white/60" /> Connect Wallet
            </CardTitle>
            <CardDescription>Please connect your wallet to access your Digital Twin.</CardDescription>
            </CardHeader>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="relative overflow-hidden bg-gradient-to-br from-teal-950/90 via-slate-950/90 to-slate-950/90 border-teal-500/30 shadow-[0_0_40px_-10px_rgba(45,212,191,0.15)] backdrop-blur-xl">
        
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <CardHeader className="pb-4 relative z-10">
            <div className="flex justify-between items-start">
            <div>
                <CardTitle className="text-2xl font-bold text-white flex items-center gap-3">
                <div className="p-2 bg-teal-500/20 rounded-lg border border-teal-500/30">
                    <User className="h-5 w-5 text-teal-400" />
                </div>
                My Digital Twin
                </CardTitle>
                <CardDescription className="text-teal-200/60 mt-2 font-mono text-xs">
                ID: {account.address.slice(0, 8)}...{account.address.slice(-6)}
                </CardDescription>
            </div>
            {twin && (
                <Badge variant="outline" className="bg-teal-500/10 text-teal-400 border-teal-500/30 flex gap-1.5 px-3 py-1">
                <Shield className="h-3 w-3" /> Verified Identity
                </Badge>
            )}
            </div>
        </CardHeader>
        <CardContent className="relative z-10">
            {loading ? (
            <div className="text-teal-200/60 text-sm animate-pulse py-8 text-center">Syncing identity data...</div>
            ) : twin ? (
            <div className="grid grid-cols-3 gap-4 mt-2">
                <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-teal-500/30 transition-colors group text-center">
                <div className="text-xs text-teal-200/60 mb-2 flex items-center justify-center gap-1 group-hover:text-teal-300">
                    <Activity className="h-3 w-3" /> Reputation
                </div>
                <div className="text-2xl font-bold text-white group-hover:scale-110 transition-transform">{twin.reputation}</div>
                </div>
                
                <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-blue-500/30 transition-colors group text-center">
                <div className="text-xs text-teal-200/60 mb-2 flex items-center justify-center gap-1 group-hover:text-blue-300">
                    <Database className="h-3 w-3" /> Records
                </div>
                <div className="text-2xl font-bold text-white group-hover:scale-110 transition-transform">{twin.records.length}</div>
                </div>
                
                <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-purple-500/30 transition-colors group text-center">
                <div className="text-xs text-teal-200/60 mb-2 flex items-center justify-center gap-1 group-hover:text-purple-300">
                    <HeartPulse className="h-3 w-3" /> Health Score
                </div>
                <div className="text-2xl font-bold text-white group-hover:scale-110 transition-transform">--</div>
                </div>
            </div>
            ) : (
            <div className="text-center py-8 bg-white/5 rounded-xl border border-dashed border-white/10">
                <div className="w-12 h-12 bg-teal-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="h-6 w-6 text-teal-400" />
                </div>
                <h3 className="text-white font-medium mb-1">No Digital Twin Found</h3>
                <p className="text-teal-200/60 mb-6 text-sm max-w-[250px] mx-auto">Mint your decentralized health identity to start securely storing data.</p>
                <Button onClick={handleMint} className="bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 text-white shadow-lg shadow-teal-900/20">
                Mint Identity
                </Button>
            </div>
            )}
        </CardContent>
        </Card>
    </motion.div>
  );
}
