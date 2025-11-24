"use client";

import { useEffect, useState } from "react";
import { vitalService, PoolEvent, DigitalTwin } from "@/lib/vital-service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Coins, Users, Lock, Unlock, Database } from "lucide-react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";

interface DataPoolsListProps {
  twin: DigitalTwin | null;
  onUpdate: () => void;
}

interface EnrichedPool extends PoolEvent {
    subscriptionPrice: number;
    recordPrice: number;
    isSubscribed: boolean;
    dataCount: number;
}

export function DataPoolsList({ twin, onUpdate }: DataPoolsListProps) {
  const [pools, setPools] = useState<EnrichedPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null); // Pool ID being processed
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  useEffect(() => {
    loadPools();
  }, [account]);

  const loadPools = async () => {
    setLoading(true);
    try {
        const poolEvents = await vitalService.getPools();
        
        // Enrich with details
        const enriched = await Promise.all(poolEvents.map(async (p) => {
            try {
                const details = await vitalService.getPool(p.poolId);
                const isSubscribed = account ? await vitalService.checkSubscription(p.poolId, account.address) : false;
                return {
                    ...p,
                    subscriptionPrice: details?.subscriptionPrice || 0,
                    recordPrice: details?.recordPrice || 0,
                    dataCount: details?.dataCount || 0,
                    isSubscribed
                };
            } catch (e) {
                console.error(`Failed to load details for pool ${p.poolId}`, e);
                return null;
            }
        }));
        
        setPools(enriched.filter(p => p !== null) as EnrichedPool[]);
    } catch (e) {
        console.error(e);
        toast.error("Failed to load data pools");
    } finally {
        setLoading(false);
    }
  };

  const handleSubscribe = async (pool: EnrichedPool) => {
      if (!account) return;
      setProcessing(pool.poolId);
      try {
          // Find a coin to pay (simplified, ideally use CoinSelector or Split)
          // For demo, we assume user has a coin with sufficient balance or we use the first SUI coin.
          // Proper implementation requires coin management.
          
          // NOTE: In a real app, we'd select coins. Here we just pass a placeholder or need a coin ID.
          // Since we don't have coin selection UI, we'll error out or need to fetch coins.
          
          const coins = await vitalService.getClient().getCoins({ owner: account.address, coinType: "0x2::sui::SUI" });
          const paymentCoin = coins.data.find(c => parseInt(c.balance) >= pool.subscriptionPrice);

          if (!paymentCoin) {
              toast.error("Insufficient SUI balance for subscription.");
              return;
          }

          const tx = vitalService.subscribe(pool.poolId, paymentCoin.coinObjectId);
          await signAndExecute({ transaction: tx });
          toast.success(`Subscribed to ${pool.name}!`);
          onUpdate();
          loadPools();
      } catch (e) {
          console.error(e);
          toast.error("Subscription failed.");
      } finally {
          setProcessing(null);
      }
  };

  const handlePurchaseRecord = async (pool: EnrichedPool, recordName: string) => {
    // Implementation for individual record purchase would go here
    // Requires selecting a record from the pool first.
    // For now, we can show a "View Records" button that opens a dialog with records to buy.
    toast.info("Select a record to purchase from the pool view (coming soon).");
  };

  if (loading) {
      return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-teal-400" /></div>;
  }

  if (pools.length === 0) {
      return <div className="text-center py-12 text-white/40">No data pools found.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {pools.map(pool => (
          <Card key={pool.poolId} className="bg-white/5 border-white/10 text-white">
              <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-lg font-medium text-teal-400">{pool.name}</CardTitle>
                        <CardDescription className="text-white/50 mt-1">{pool.description}</CardDescription>
                    </div>
                    {pool.isSubscribed ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                            <Unlock className="h-3 w-3 mr-1" /> Active
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="text-white/40 border-white/10">
                            <Lock className="h-3 w-3 mr-1" /> Locked
                        </Badge>
                    )}
                  </div>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="p-2 bg-black/20 rounded-lg">
                          <span className="text-white/40 block text-xs">Subscription</span>
                          <span className="font-mono text-teal-300">{(pool.subscriptionPrice / 1e9).toFixed(2)} SUI</span>
                      </div>
                      <div className="p-2 bg-black/20 rounded-lg">
                          <span className="text-white/40 block text-xs">Per Record</span>
                          <span className="font-mono text-blue-300">{(pool.recordPrice / 1e9).toFixed(2)} SUI</span>
                      </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/40">
                      <Database className="h-3 w-3" /> {pool.dataCount} Records available
                  </div>
              </CardContent>
              <CardFooter className="flex gap-2">
                  {!pool.isSubscribed && (
                      <Button 
                        className="flex-1 bg-teal-600 hover:bg-teal-500" 
                        onClick={() => handleSubscribe(pool)}
                        disabled={!!processing}
                    >
                          {processing === pool.poolId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Subscribe"}
                      </Button>
                  )}
                  <Button variant="outline" className="flex-1 border-white/10 hover:bg-white/5" onClick={() => toast.info("Browse records to purchase individual items.")}>
                      Browse Records
                  </Button>
              </CardFooter>
          </Card>
      ))}
    </div>
  );
}

