"use client";

import { useEffect, useState } from "react";
import { vitalService, DigitalTwin } from "@/lib/vital-service";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { Loader2, FileCheck, Download, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PurchasedRecordsListProps {
  twin: DigitalTwin | null;
}

interface PurchasedRecord {
    poolId: string;
    recordName: string;
    price: number;
    timestamp: number;
}

export function PurchasedRecordsList({ twin }: PurchasedRecordsListProps) {
    const [records, setRecords] = useState<PurchasedRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const account = useCurrentAccount();

    useEffect(() => {
        if (account) {
            loadPurchases();
        }
    }, [account]);

    const loadPurchases = async () => {
        if (!account) return;
        setLoading(true);
        try {
            const data = await vitalService.getPurchasedRecords(account.address);
            setRecords(data);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load purchases");
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = (record: PurchasedRecord) => {
        // To download, we'd need the full flow:
        // 1. Find Twin owner (Provider) - query Pool events to find who staked this record
        // 2. Request Access (if not already granted) -> This needs the provider's twin ID.
        // 3. Decrypt
        
        // For now, we'll just show a toast as the full discovery flow is complex without an indexer
        toast.info(`Download flow for ${record.recordName} coming soon.`);
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-teal-400" /></div>;

    if (records.length === 0) {
        return (
            <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
                <p className="text-white/50">You haven't purchased any individual records yet.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {records.map((r, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                            <FileCheck className="h-5 w-5" />
                        </div>
                        <div>
                            <h4 className="font-medium text-white">{r.recordName}</h4>
                            <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                                <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(r.timestamp).toLocaleDateString()}
                                </span>
                                <span>•</span>
                                <span className="text-teal-400 font-mono">{(r.price / 1e9).toFixed(2)} SUI</span>
                            </div>
                        </div>
                    </div>
                    
                    <Button variant="ghost" size="sm" className="hover:bg-white/10" onClick={() => handleDownload(r)}>
                        <Download className="h-4 w-4" />
                    </Button>
                </div>
            ))}
        </div>
    );
}

