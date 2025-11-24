"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Coins,
  Microscope,
  ArrowRight,
  Plus,
  Loader2,
  Download,
  Wallet,
  CreditCard,
  Zap,
  Lock,
  CheckCircle,
  Key,
} from "lucide-react";
import { useState } from "react";
import { vitalService, type DigitalTwin } from "@/lib/vital-service";
import {
  useSignAndExecuteTransaction,
  useCurrentAccount,
} from "@mysten/dapp-kit";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { useRole } from "@/components/role-context";

interface Pool {
  id: string;
  name: string;
  criteria: string;
  description?: string;
  apy: string;
  liquidity: string;
  participants: number;
  isNew?: boolean;
  subscriptionPrice?: number; // SUI
}

interface StakedRecord {
  provider: string;
  recordName: string;
  timestamp: number;
}

const MOCK_POOLS: Pool[] = [
  {
    id: "pool-1",
    name: "Type 2 Diabetes (North America)",
    criteria: "HbA1c > 7.0%",
    description:
      "Study focused on the impact of dietary changes in North American T2D patients.",
    apy: "12%",
    liquidity: "$450,000",
    participants: 1240,
    subscriptionPrice: 50,
  },
  {
    id: "pool-2",
    name: "Cardiovascular Study (Global)",
    criteria: "Resting HR < 60bpm",
    description:
      "Global analysis of athletic heart rates and cardiovascular health events.",
    apy: "8.5%",
    liquidity: "$1.2M",
    participants: 5430,
    subscriptionPrice: 100,
  },
  {
    id: "pool-3",
    name: "Rare Disease: HPP",
    criteria: "Confirmed Diagnosis",
    description: "Hypophosphatasia registry data collection.",
    apy: "45%",
    liquidity: "$200,000",
    participants: 56,
    subscriptionPrice: 200,
  },
];

export function LiquidityPools({ twin }: { twin: DigitalTwin | null }) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [pools, setPools] = useState<Pool[]>(MOCK_POOLS);
  const { isResearcher } = useRole();

  // Pool Details & Data Explorer
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [poolEvents, setPoolEvents] = useState<StakedRecord[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false); // Mock subscription status per pool

  // Create Pool State
  const [isCreating, setIsCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newPoolName, setNewPoolName] = useState("");
  const [newPoolCriteria, setNewPoolCriteria] = useState("");
  const [newPoolDescription, setNewPoolDescription] = useState("");
  const [newPoolPrice, setNewPoolPrice] = useState("50");

  // Funding/Subscribing State
  const [fundingAmount, setFundingAmount] = useState("");
  const [fundingLoading, setFundingLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"SUI" | "USDC" | "x402">(
    "SUI"
  );
  const [x402Connected, setX402Connected] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  // Request Access State
  const [requestingAccess, setRequestingAccess] = useState<string | null>(null);

  const handleCreatePool = () => {
    if (!newPoolName || !newPoolCriteria) return;
    setIsCreating(true);
    // Note: Updated to pass description and price (mocked price handling if contract requires u64)
    const price = parseInt(newPoolPrice) || 0;
    const tx = vitalService.createPool(
      newPoolName,
      newPoolDescription || "No description",
      newPoolCriteria,
      price
    );

    signAndExecute(
      { transaction: tx, options: { showEffects: true } },
      {
        onSuccess: (result) => {
          const created = result.effects?.created?.[0]?.reference.objectId;
          if (created) {
            const newPool: Pool = {
              id: created,
              name: newPoolName,
              criteria: newPoolCriteria,
              description: newPoolDescription,
              apy: "0%",
              liquidity: "0 SUI",
              participants: 0,
              isNew: true,
              subscriptionPrice: price,
            };
            setPools([newPool, ...pools]);
            toast.success("Pool Created!");
            setNewPoolName("");
            setNewPoolCriteria("");
            setNewPoolDescription("");
            setNewPoolPrice("50");
            setCreateOpen(false);
          } else {
            toast.warning("Pool created but ID not found.");
          }
        },
        onError: (err) => {
          toast.error("Failed to create pool");
          console.error(err);
        },
        onSettled: () => setIsCreating(false),
      }
    );
  };

  const handleStake = (recordName: string) => {
    if (!selectedPool || !twin) return;

    const tx = vitalService.stakeRecord(selectedPool.id, twin.id, recordName);
    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => {
          toast.success(`Staked ${recordName} to ${selectedPool.name}`);
          setSelectedPool(null);
        },
        onError: () => toast.error("Staking failed"),
      }
    );
  };

  const openExplorer = async (pool: Pool) => {
    setSelectedPool(pool);
    setExplorerOpen(true);
    setLoadingEvents(true);

    // Check subscription status (Mocked check - in real app call vitalService.checkSubscription)
    // setIsSubscribed(await vitalService.checkSubscription(pool.id, account?.address!));
    // For demo, we'll assume false unless subscribed in this session

    try {
      const events = await vitalService.getPoolEvents(pool.id);
      setPoolEvents(events);
    } catch (e) {
      console.error("Failed to fetch events", e);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleSubscribe = () => {
    if (!selectedPool || !account) return;
    setSubscribing(true);

    // In real implementation, we'd need to pass a Coin object with value >= subscriptionPrice
    // For now, using a placeholder coin ID logic or split coin transaction would be needed
    // We'll mock the success flow for UI demonstration of "Subscribe" button

    // const tx = vitalService.subscribe(selectedPool.id, "0xCOIN");

    setTimeout(() => {
      setIsSubscribed(true);
      setSubscribing(false);
      toast.success(`Subscribed to ${selectedPool.name} for 30 days!`);
    }, 2000);
  };

  const handleFundPool = () => {
    if (!selectedPool || !account) return;

    if (paymentMethod === "x402") {
      if (!x402Connected) {
        setFundingLoading(true);
        setTimeout(() => {
          setX402Connected(true);
          setFundingLoading(false);
          toast.success("x402 Stream Connected: 0.0001 USDC/sec");
        }, 1500);
      } else {
        setX402Connected(false);
        toast.info("Stream Paused");
      }
      return;
    }

    if (!fundingAmount) return;

    setFundingLoading(true);

    if (paymentMethod === "SUI") {
      // SUI Funding Logic
      const tx = vitalService.fundPool(
        selectedPool.id,
        "0xGAS_COIN_TO_BE_SPLIT_AUTOMATICALLY_BY_WALLET"
      );

      // Mock success for UI
      setTimeout(() => {
        setFundingLoading(false);
        toast.success(`Funded ${selectedPool.name} with ${fundingAmount} SUI`);
        setFundingAmount("");
      }, 1000);
    } else if (paymentMethod === "USDC") {
      // USDC Funding Logic (Simulated)
      setTimeout(() => {
        setFundingLoading(false);
        toast.success(`Funded ${selectedPool.name} with ${fundingAmount} USDC`);
        setFundingAmount("");
      }, 1500);
    }
  };

  const handleRequestAccess = async (recordName: string) => {
    if (!selectedPool || !twin) return; // NOTE: In real app, we don't have the twin object here as a researcher
    // We usually have the record Name and Pool ID.
    // But contract requires &DigitalTwin reference for `request_access` currently.
    // This implies the current contract design requires the Data Owner to be involved or the object to be shared.
    // However, for the UI demo, we'll simulate the "Request" emission.

    setRequestingAccess(recordName);
    toast.info(`Requesting re-encryption key for ${recordName}...`);

    // Simulate Seal/Oracle delay
    setTimeout(() => {
      toast.success("Key Received via Seal Oracle! Downloading...");
      setRequestingAccess(null);
    }, 2500);
  };

  return (
    <Card className="h-full bg-transparent border-0 shadow-none relative z-10">
      <CardHeader className="px-0 pt-0 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl text-white flex items-center gap-3">
              <Coins className="h-6 w-6 text-teal-400" />
              Data Liquidity Pools
            </CardTitle>
            <CardDescription className="text-white/60 mt-1">
              {isResearcher
                ? "Fund research pools and access staked patient data."
                : "Stake your health data to earn yield from pharmaceutical research."}
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            {/* Role Switcher removed from here, moved to DashboardHeader */}

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="border-teal-500/20 text-teal-400 hover:bg-teal-500/10 hover:border-teal-500/40 transition-all"
                >
                  <Plus className="h-4 w-4 mr-2" /> Create Pool
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-950/95 backdrop-blur-xl border-white/10 text-white max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Data Pool</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Pool Name</Label>
                    <Input
                      placeholder="e.g. Diabetes Research Pool"
                      value={newPoolName}
                      onChange={(e) => setNewPoolName(e.target.value)}
                      className="bg-black/20 border-white/10 focus:border-teal-500/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      placeholder="Describe the research goals..."
                      value={newPoolDescription}
                      onChange={(e) => setNewPoolDescription(e.target.value)}
                      className="bg-black/20 border-white/10 focus:border-teal-500/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Criteria</Label>
                    <Input
                      placeholder="e.g. HbA1c > 6.5"
                      value={newPoolCriteria}
                      onChange={(e) => setNewPoolCriteria(e.target.value)}
                      className="bg-black/20 border-white/10 focus:border-teal-500/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Monthly Subscription Price (SUI)</Label>
                    <Input
                      type="number"
                      placeholder="50"
                      value={newPoolPrice}
                      onChange={(e) => setNewPoolPrice(e.target.value)}
                      className="bg-black/20 border-white/10 focus:border-teal-500/50 transition-colors"
                    />
                  </div>
                  <Button
                    className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white border-0"
                    onClick={handleCreatePool}
                    disabled={isCreating || !newPoolName || !newPoolCriteria}
                  >
                    {isCreating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Create Pool
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {pools.map((pool) => (
                <motion.div
                  key={pool.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card
                    className={`group bg-white/5 border-white/10 hover:bg-white/[0.07] hover:border-white/20 transition-all duration-300 backdrop-blur-sm ${
                      pool.isNew
                        ? "border-teal-500/50 bg-teal-500/5 shadow-[0_0_30px_-10px_rgba(45,212,191,0.3)]"
                        : ""
                    }`}
                  >
                    <CardContent className="p-5">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-white flex items-center gap-2 group-hover:text-teal-200 transition-colors">
                            {pool.name}
                            {pool.isNew && (
                              <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/50 text-[10px] px-1.5 py-0.5 h-auto">
                                NEW
                              </Badge>
                            )}
                          </h3>
                          <p className="text-xs text-white/50 mb-2 max-w-md truncate">
                            {pool.description}
                          </p>
                          <div className="flex gap-2">
                            <Badge
                              variant="outline"
                              className="border-white/10 text-white/60 bg-black/20 font-normal"
                            >
                              {pool.criteria}
                            </Badge>
                            {pool.subscriptionPrice && (
                              <Badge
                                variant="secondary"
                                className="bg-blue-500/10 text-blue-300 border-blue-500/20 font-normal"
                              >
                                {pool.subscriptionPrice} SUI / mo
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-white/40 uppercase tracking-wider mb-1">
                            APY
                          </div>
                          <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400 drop-shadow-sm">
                            {pool.apy}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between text-sm text-white/40 mb-5 px-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-teal-500/50" />
                          Liquidity:{" "}
                          <span className="text-white/70">
                            {pool.liquidity}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500/50" />
                          Participants:{" "}
                          <span className="text-white/70">
                            {pool.participants}
                          </span>
                        </div>
                      </div>

                      {isResearcher ? (
                        <Dialog
                          open={explorerOpen && selectedPool?.id === pool.id}
                          onOpenChange={(open) => {
                            if (!open) {
                              setExplorerOpen(false);
                              setIsSubscribed(false); // Reset on close
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              className="w-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20 transition-all"
                              onClick={() => openExplorer(pool)}
                            >
                              <Microscope className="h-4 w-4 mr-2" /> Explore &
                              Fund
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-slate-950/95 backdrop-blur-xl border-white/10 text-white max-w-2xl shadow-2xl">
                            <DialogHeader>
                              <DialogTitle className="flex justify-between items-center">
                                <div className="flex flex-col gap-1">
                                  <span className="text-xl">
                                    {selectedPool?.name}
                                  </span>
                                  <span className="text-xs text-white/50 font-normal">
                                    {selectedPool?.description}
                                  </span>
                                </div>
                                <Badge
                                  variant="secondary"
                                  className="bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                >
                                  Researcher View
                                </Badge>
                              </DialogTitle>
                            </DialogHeader>

                            <Tabs defaultValue="data" className="w-full mt-4">
                              <TabsList className="bg-black/40 w-full border border-white/5 p-1 h-auto">
                                <TabsTrigger
                                  value="data"
                                  className="flex-1 py-2 data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60"
                                >
                                  Staked Data
                                </TabsTrigger>
                                <TabsTrigger
                                  value="fund"
                                  className="flex-1 py-2 data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-300 text-white/60"
                                >
                                  Fund Pool
                                </TabsTrigger>
                              </TabsList>

                              <TabsContent
                                value="data"
                                className="mt-4 space-y-4 h-[350px] overflow-y-auto pr-2"
                              >
                                {!isSubscribed ? (
                                  <div className="h-full flex flex-col items-center justify-center gap-4 border border-dashed border-white/10 rounded-xl bg-white/5 p-8 text-center">
                                    <div className="p-4 bg-black/30 rounded-full mb-2">
                                      <Lock className="h-8 w-8 text-white/40" />
                                    </div>
                                    <div className="space-y-2">
                                      <h3 className="text-lg font-medium">
                                        Subscription Required
                                      </h3>
                                      <p className="text-sm text-white/60 max-w-xs mx-auto">
                                        Subscribe to this pool to access
                                        decrypted metadata and request data
                                        keys.
                                      </p>
                                    </div>
                                    <div className="flex items-baseline gap-1 mt-2">
                                      <span className="text-2xl font-bold text-white">
                                        {selectedPool?.subscriptionPrice || 50}{" "}
                                        SUI
                                      </span>
                                      <span className="text-white/40">
                                        / month
                                      </span>
                                    </div>
                                    <Button
                                      className="bg-teal-600 hover:bg-teal-500 text-white min-w-[200px]"
                                      onClick={handleSubscribe}
                                      disabled={subscribing}
                                    >
                                      {subscribing ? (
                                        <Loader2 className="animate-spin mr-2 h-4 w-4" />
                                      ) : (
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                      )}
                                      Subscribe Now
                                    </Button>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex justify-between items-center px-1">
                                      <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/30">
                                        <CheckCircle className="w-3 h-3 mr-1" />{" "}
                                        Subscription Active
                                      </Badge>
                                      <span className="text-xs text-white/40">
                                        Expires in 30 days
                                      </span>
                                    </div>

                                    {loadingEvents ? (
                                      <div className="flex flex-col items-center justify-center h-64 text-white/40 gap-2">
                                        <Loader2 className="animate-spin h-8 w-8" />
                                        <span className="text-xs">
                                          Fetching on-chain events...
                                        </span>
                                      </div>
                                    ) : poolEvents.length > 0 ? (
                                      poolEvents.map((evt, i) => (
                                        <motion.div
                                          initial={{ opacity: 0, x: -10 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          transition={{ delay: i * 0.1 }}
                                          key={i}
                                          className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                                        >
                                          <div>
                                            <div className="font-medium text-sm text-white/90 flex items-center gap-2">
                                              {evt.recordName}
                                              <Badge
                                                variant="outline"
                                                className="text-[10px] h-5 border-white/10 text-white/40"
                                              >
                                                Encrypted
                                              </Badge>
                                            </div>
                                            <div className="text-xs text-white/40 font-mono mt-1">
                                              Provider:{" "}
                                              {evt.provider.slice(0, 8)}...
                                            </div>
                                          </div>
                                          <Button
                                            size="sm"
                                            variant="secondary"
                                            className="text-xs bg-white/10 hover:bg-teal-500/20 hover:text-teal-300 border border-white/10 transition-all"
                                            onClick={() =>
                                              handleRequestAccess(
                                                evt.recordName
                                              )
                                            }
                                            disabled={!!requestingAccess}
                                          >
                                            {requestingAccess ===
                                            evt.recordName ? (
                                              <Loader2 className="h-3 w-3 animate-spin mr-2" />
                                            ) : (
                                              <Key className="h-3 w-3 mr-2" />
                                            )}
                                            Request Key
                                          </Button>
                                        </motion.div>
                                      ))
                                    ) : (
                                      <div className="flex flex-col items-center justify-center h-64 text-white/40 border border-dashed border-white/10 rounded-xl">
                                        <Microscope className="h-8 w-8 mb-2 opacity-50" />
                                        No data staked in this pool yet.
                                      </div>
                                    )}
                                  </>
                                )}
                              </TabsContent>

                              <TabsContent value="fund" className="mt-4">
                                <div className="p-6 bg-gradient-to-br from-blue-900/20 to-slate-900/50 rounded-xl border border-blue-500/20">
                                  <h4 className="font-medium text-blue-200 mb-4 flex items-center gap-2">
                                    <Wallet className="h-4 w-4" /> Add Liquidity
                                  </h4>

                                  {/* Payment Method Selector */}
                                  <div className="grid grid-cols-3 gap-3 mb-6">
                                    <button
                                      onClick={() => setPaymentMethod("SUI")}
                                      className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                                        paymentMethod === "SUI"
                                          ? "bg-blue-500/20 border-blue-500 text-white"
                                          : "bg-black/20 border-white/10 text-white/40 hover:bg-white/5"
                                      }`}
                                    >
                                      <Coins className="h-5 w-5 mb-2" />
                                      <span className="text-xs font-medium">
                                        SUI
                                      </span>
                                    </button>
                                    <button
                                      onClick={() => setPaymentMethod("USDC")}
                                      className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                                        paymentMethod === "USDC"
                                          ? "bg-blue-500/20 border-blue-500 text-white"
                                          : "bg-black/20 border-white/10 text-white/40 hover:bg-white/5"
                                      }`}
                                    >
                                      <CreditCard className="h-5 w-5 mb-2" />
                                      <span className="text-xs font-medium">
                                        USDC
                                      </span>
                                    </button>
                                    <button
                                      onClick={() => setPaymentMethod("x402")}
                                      className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                                        paymentMethod === "x402"
                                          ? "bg-purple-500/20 border-purple-500 text-white"
                                          : "bg-black/20 border-white/10 text-white/40 hover:bg-white/5"
                                      }`}
                                    >
                                      <Zap className="h-5 w-5 mb-2" />
                                      <span className="text-xs font-medium">
                                        x402 Protocol
                                      </span>
                                    </button>
                                  </div>

                                  <div className="space-y-4">
                                    {paymentMethod === "x402" ? (
                                      <div className="text-center py-4">
                                        <div className="mb-4 text-sm text-purple-200/70">
                                          Stream payments instantly via x402
                                          Protocol.
                                          <br />
                                          Pay-per-second for real-time data
                                          access.
                                        </div>
                                        <Button
                                          onClick={handleFundPool}
                                          className={`w-full h-12 ${
                                            x402Connected
                                              ? "bg-red-500/20 text-red-300 border-red-500/50"
                                              : "bg-purple-600 hover:bg-purple-500 text-white"
                                          }`}
                                          disabled={fundingLoading}
                                        >
                                          {fundingLoading ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                          ) : x402Connected ? (
                                            "Stop Stream"
                                          ) : (
                                            "Connect x402 Stream"
                                          )}
                                        </Button>
                                        {x402Connected && (
                                          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-purple-300 animate-pulse">
                                            <div className="w-2 h-2 rounded-full bg-purple-400" />
                                            Streaming 0.0001 USDC/sec...
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <>
                                        <div className="space-y-2">
                                          <Label className="text-blue-200/60 text-xs uppercase">
                                            Amount ({paymentMethod})
                                          </Label>
                                          <Input
                                            placeholder={`0.00 ${paymentMethod}`}
                                            className="bg-black/20 border-blue-500/20 text-white focus:border-blue-500/50 h-12 text-lg"
                                            value={fundingAmount}
                                            onChange={(e) =>
                                              setFundingAmount(e.target.value)
                                            }
                                          />
                                        </div>
                                        <Button
                                          className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-0 shadow-lg shadow-blue-900/20"
                                          onClick={handleFundPool}
                                          disabled={
                                            fundingLoading || !fundingAmount
                                          }
                                        >
                                          {fundingLoading ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                          ) : (
                                            <Wallet className="h-4 w-4 mr-2" />
                                          )}
                                          Fund with {paymentMethod}
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </TabsContent>
                            </Tabs>
                          </DialogContent>
                        </Dialog>
                      ) : (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all hover:border-teal-500/30 hover:text-teal-200 group-hover:bg-teal-500/5"
                              onClick={() => setSelectedPool(pool)}
                            >
                              <Plus className="h-4 w-4 mr-2" /> Stake Data
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-slate-950/95 backdrop-blur-xl border-white/10 text-white">
                            <DialogHeader>
                              <DialogTitle>Select Data to Stake</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-2 mt-4">
                              {twin?.records.map((rec) => (
                                <div
                                  key={rec.name}
                                  className="flex justify-between items-center p-3 bg-white/5 rounded-lg hover:bg-white/10 cursor-pointer border border-transparent hover:border-teal-500/30 transition-all"
                                  onClick={() => handleStake(rec.name)}
                                >
                                  <div>
                                    <div className="font-medium">
                                      {rec.name}
                                    </div>
                                    <div className="text-xs text-white/40">
                                      {new Date(
                                        rec.timestamp
                                      ).toLocaleDateString()}
                                    </div>
                                  </div>
                                  <ArrowRight className="h-4 w-4 text-white/40" />
                                </div>
                              ))}
                              {(!twin || twin.records.length === 0) && (
                                <div className="text-center text-white/40 py-8 border border-dashed border-white/10 rounded-lg">
                                  No records available to stake.
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
