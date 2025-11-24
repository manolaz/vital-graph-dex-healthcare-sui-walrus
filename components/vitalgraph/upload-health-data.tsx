"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Lock, FileText, Loader2, Shield, FileUp, Copy, Check } from "lucide-react";
import { storePreEncryptedBlob } from "@/lib/walrus";
import { sealService } from "@/lib/seal";
import { vitalService } from "@/lib/vital-service";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { toHex } from "@mysten/sui/utils"; // Helper for backup key display if needed

interface UploadHealthDataProps {
  twinId: string;
  onUploadSuccess: () => void;
}

export function UploadHealthData({
  twinId,
  onUploadSuccess,
}: UploadHealthDataProps) {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [backupKey, setBackupKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const account = useCurrentAccount();

  const handleUpload = async () => {
    if (!file || !twinId || !account) return;

    setLoading(true);
    try {
      const recordName = description || file.name;

      // 1. Encrypt with Seal (Identity: [ProviderAddress][RecordName])
      toast.info("Encrypting with Seal...");
      const fileBytes = new Uint8Array(await file.arrayBuffer());
      const { encryptedBytes, backupKey: keyBytes } = await sealService.encryptHealthRecord(
        fileBytes,
        account.address,
        recordName
      );

      // 2. Upload to Walrus
      toast.info("Uploading to Walrus...");
      const result = await storePreEncryptedBlob(encryptedBytes);

      // 3. Mint to Sui
      toast.info("Minting Record to Sui...");
      const tx = vitalService.addHealthRecord(
        twinId,
        recordName,
        result.blobId,
        JSON.stringify({
          type: file.type,
          size: file.size,
          walrus_obj: result.suiBlobObjectId,
          encryption: "SEAL-IBE"
        }),
        "SEAL" // IV not used for Seal (embedded), using as marker
      );

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: () => {
            toast.success("Health Record Added Securely!");
            setFile(null);
            setDescription("");
            
            // Show backup key
            if (keyBytes) {
                setBackupKey(toHex(keyBytes));
            }
            
            onUploadSuccess();
          },
          onError: (err) => {
            console.error(err);
            toast.error("Failed to mint record");
          },
        }
      );
    } catch (e) {
      console.error(e);
      toast.error("Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1 }}
    >
      <Card className="bg-white/5 border-white/10 backdrop-blur-sm hover:border-white/20 transition-colors">
        <CardHeader>
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <div className="p-2 bg-blue-500/20 rounded-lg border border-blue-500/30">
              <Upload className="h-4 w-4 text-blue-400" />
            </div>
            Upload Health Record
          </CardTitle>
          <CardDescription className="text-white/60">
            Encrypts data client-side, stores on Walrus, and links to your
            Digital Twin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {backupKey ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="p-4 bg-teal-500/10 border border-teal-500/20 rounded-xl">
                <h4 className="text-teal-400 font-medium flex items-center gap-2 mb-2">
                  <Check className="h-4 w-4" /> Upload Successful
                </h4>
                <p className="text-xs text-white/60 mb-4 leading-relaxed">
                  Your health record is encrypted and stored. 
                  <strong className="text-white block mt-1">Save this backup key securely.</strong>
                  You will need it to recover your file if you lose access.
                </p>
                
                <div className="relative group">
                  <div className="p-3 bg-black/40 rounded-lg text-[10px] font-mono text-white/70 break-all pr-10 border border-white/5 group-hover:border-white/10 transition-colors">
                    {backupKey}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-1.5 right-1.5 h-6 w-6 text-white/40 hover:text-white hover:bg-white/10"
                    onClick={() => {
                      navigator.clipboard.writeText(backupKey);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                      toast.success("Copied to clipboard");
                    }}
                  >
                    {copied ? <Check className="h-3 w-3 text-teal-400" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
              
              <Button 
                className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10" 
                variant="outline"
                onClick={() => {
                    setBackupKey(null);
                    onUploadSuccess();
                }}
              >
                Upload Another File
              </Button>
            </div>
          ) : (
            <>
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="picture" className="text-white/80">
                  Medical Record
                </Label>
                <div className="relative group cursor-pointer">
                  <Input
                    id="picture"
                    type="file"
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  <div className="border-2 border-dashed border-white/20 rounded-xl p-6 flex flex-col items-center justify-center bg-black/20 group-hover:border-teal-500/50 group-hover:bg-black/30 transition-all">
                    {file ? (
                      <div className="flex flex-col items-center text-teal-400">
                        <FileText className="h-8 w-8 mb-2" />
                        <span className="text-sm font-medium truncate max-w-[200px]">
                          {file.name}
                        </span>
                        <span className="text-xs text-teal-400/60">
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-white/40 group-hover:text-teal-400/80 transition-colors">
                        <FileUp className="h-8 w-8 mb-2" />
                        <span className="text-sm">
                          Drop file or click to upload
                        </span>
                        <span className="text-xs text-white/30 mt-1">
                          PDF, JSON, DICOM (Max 50MB)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="desc" className="text-white/80">
                  Description
                </Label>
                <Input
                  id="desc"
                  placeholder="e.g. Annual MRI Scan 2024"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-black/20 border-white/10 text-white focus:border-teal-500/50"
                />
              </div>

              <Button
                className="w-full bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 text-white shadow-lg shadow-blue-900/20"
                disabled={!file || !twinId || loading}
                onClick={handleUpload}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Lock className="h-4 w-4 mr-2" />
                )}
                {loading ? "Encrypting & Minting..." : "Encrypt & Upload"}
              </Button>

              <div className="flex items-center justify-center gap-2 text-xs text-white/30">
                <Shield className="h-3 w-3" />
                <span>End-to-end encrypted client-side</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
