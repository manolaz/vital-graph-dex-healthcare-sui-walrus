"use client";

import { useState } from "react";
import { HealthRecord } from "@/lib/vital-service";
import { readBlob } from "@/lib/walrus";
import { sealService } from "@/lib/seal";
import { FileCheck, Download, Loader2, Key, AlertCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { useSignPersonalMessage, useCurrentAccount } from "@mysten/dapp-kit";

interface HealthRecordsListProps {
  records: HealthRecord[];
  ownerAddress: string;
}

export function HealthRecordsList({ records, ownerAddress }: HealthRecordsListProps) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<HealthRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const account = useCurrentAccount();

  const handleDownloadClick = (record: HealthRecord) => {
    setSelectedRecord(record);
    setDialogOpen(true);
  };

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setDownloading(null); // Also clear downloading state just in case
      setSelectedRecord(null);
    }
  };

  const handleDownloadConfirm = async () => {
    if (!selectedRecord || !account) return;

    const record = selectedRecord;
    setDownloading(record.blobId);
    
    try {
      // 1. Fetch from Walrus
      toast.info("Fetching encrypted data from Walrus...");
      const blob = await readBlob(record.blobId);
      const encryptedBytes = new Uint8Array(await blob.arrayBuffer());

      // 2. Decrypt with Seal
      toast.info("Decrypting file via Seal Network...");
      
      const decryptedBytes = await sealService.decryptHealthRecord(
        encryptedBytes,
        ownerAddress,
        record.name,
        account.address,
        async (msg) => {
            const { signature } = await signPersonalMessage({ message: msg });
            return { signature };
        }
      );

      const decryptedBuffer = decryptedBytes.buffer;

      // 3. Parse Metadata for file type
      let fileType = "application/octet-stream";
      try {
          const metadata = JSON.parse(record.metadata);
          if (metadata.type) fileType = metadata.type;
      } catch (e) {
          console.warn("Could not parse metadata", e);
      }

      // 4. Create Download Link
      const decryptedBlob = new Blob([decryptedBuffer], { type: fileType });
      const url = window.URL.createObjectURL(decryptedBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = record.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("File decrypted and downloaded!");
      setDialogOpen(false);
      
    } catch (e) {
      console.error(e);
      toast.error("Failed to decrypt. Ensure you have permission.");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: 0.3 }}
        className="p-5 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md"
    >
      <h3 className="text-sm font-medium text-white/60 mb-4 flex items-center gap-2">
        <FileCheck className="h-4 w-4" /> My Verified Records
      </h3>
      
      {records.length === 0 ? (
          <div className="text-center py-8 text-white/30 text-sm border border-dashed border-white/10 rounded-lg">
              No health records found.
          </div>
      ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {records.map((r, i) => (
              <div key={i} className="group text-sm p-3 bg-black/20 hover:bg-white/5 border border-transparent hover:border-white/10 rounded-lg flex justify-between items-center transition-all">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 bg-teal-500/10 rounded-lg text-teal-400 group-hover:text-teal-300 group-hover:bg-teal-500/20 transition-colors">
                        <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <span className="truncate max-w-[180px] text-white/80 font-medium">{r.name}</span>
                        <span className="text-[10px] text-white/40">
                            {new Date(r.timestamp).toLocaleDateString()}
                        </span>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    {r.verified && (
                        <Badge variant="outline" className="bg-teal-500/10 text-teal-400 border-teal-500/20 px-2 py-0.5 text-[10px] uppercase">
                            Verified
                        </Badge>
                    )}
                    
                    <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 w-8 p-0 text-white/40 hover:text-white hover:bg-white/10"
                        onClick={() => handleDownloadClick(r)}
                    >
                        <Download className="h-4 w-4" />
                    </Button>
                </div>
              </div>
            ))}
          </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="bg-slate-950/95 border-white/10 text-white">
            <DialogHeader>
                <DialogTitle>Decrypt & Download Record</DialogTitle>
                <DialogDescription className="text-white/60">
                    You will be asked to sign a message to prove your identity to Seal Network.
                </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <div className="flex justify-between">
                        <span className="text-sm text-white/80">Record:</span>
                        <span className="text-sm font-medium text-teal-400">{selectedRecord?.name}</span>
                    </div>
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-2 text-xs text-blue-200/80">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        This file is encrypted. Seal Network will check your on-chain permissions before releasing the key.
                    </div>
                </div>

                <Button 
                    onClick={handleDownloadConfirm} 
                    className="w-full bg-teal-600 hover:bg-teal-500"
                    disabled={downloading === selectedRecord?.blobId}
                >
                    {downloading === selectedRecord?.blobId ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Decrypting...
                        </>
                    ) : (
                        <>
                            <Key className="mr-2 h-4 w-4" />
                            Sign & Decrypt
                        </>
                    )}
                </Button>
            </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
