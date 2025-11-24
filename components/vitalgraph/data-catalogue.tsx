"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HealthRecordsList } from "./health-records-list";
import { DataPoolsList } from "./data-pools-list";
import { PurchasedRecordsList } from "./purchased-records-list";
import { DigitalTwin } from "@/lib/vital-service";
import { FileBox, Database, ShoppingBag } from "lucide-react";

interface DataCatalogueProps {
  twin: DigitalTwin | null;
  onUpdate: () => void; // Callback to refresh data
}

export function DataCatalogue({ twin, onUpdate }: DataCatalogueProps) {
  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col space-y-2">
        <h2 className="text-2xl font-bold text-white">Data Catalogue</h2>
        <p className="text-white/60">Manage your data, subscriptions, and purchases.</p>
      </div>

      <Tabs defaultValue="uploads" className="w-full">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="uploads" className="data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-300">
            <FileBox className="h-4 w-4 mr-2" />
            My Uploads
          </TabsTrigger>
          <TabsTrigger value="market" className="data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-300">
            <Database className="h-4 w-4 mr-2" />
            Data Market
          </TabsTrigger>
          <TabsTrigger value="purchases" className="data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-300">
            <ShoppingBag className="h-4 w-4 mr-2" />
            My Purchases
          </TabsTrigger>
        </TabsList>

        <TabsContent value="uploads" className="mt-6">
            {twin ? (
                <HealthRecordsList records={twin.records} ownerAddress={twin.owner} />
            ) : (
                <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
                    <p className="text-white/50">Please mint your Digital Twin to view uploads.</p>
                </div>
            )}
        </TabsContent>

        <TabsContent value="market" className="mt-6">
          <DataPoolsList twin={twin} onUpdate={onUpdate} />
        </TabsContent>

        <TabsContent value="purchases" className="mt-6">
          <PurchasedRecordsList twin={twin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

