"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HealthRecordsList } from "./health-records-list";
import { LiquidityPools } from "./liquidity-pools";
import { PurchasedRecordsList } from "./purchased-records-list";
import { DigitalTwin } from "@/lib/vital-service";
import { FileBox, Database, ShoppingBag } from "lucide-react";
import { useRole } from "@/components/role-context";

interface DataCatalogueProps {
  twin: DigitalTwin | null;
  onUpdate: () => void; // Callback to refresh data
}

export function DataCatalogue({ twin, onUpdate }: DataCatalogueProps) {
  const { isPatient, isResearcher } = useRole();

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col space-y-2">
        <h2 className="text-2xl font-bold text-white">Data Catalogue</h2>
        <p className="text-white/60">
          {isPatient
            ? "Manage your health data and earn yield."
            : "Fund research pools and access medical datasets."}
        </p>
      </div>

      <Tabs defaultValue="market" className="w-full">
        <TabsList className="bg-white/5 border border-white/10">
          {isPatient && (
            <TabsTrigger
              value="uploads"
              className="data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-300"
            >
              <FileBox className="h-4 w-4 mr-2" />
              My Uploads
            </TabsTrigger>
          )}
          <TabsTrigger
            value="market"
            className="data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-300"
          >
            <Database className="h-4 w-4 mr-2" />
            {isPatient ? "Earn Yield" : "Marketplace"}
          </TabsTrigger>
          {isResearcher && (
            <TabsTrigger
              value="purchases"
              className="data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-300"
            >
              <ShoppingBag className="h-4 w-4 mr-2" />
              My Data Access
            </TabsTrigger>
          )}
        </TabsList>

        {isPatient && (
          <TabsContent value="uploads" className="mt-6">
            {twin ? (
              <HealthRecordsList
                records={twin.records}
                ownerAddress={twin.owner}
              />
            ) : (
              <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
                <p className="text-white/50">
                  Please mint your Digital Twin to view uploads.
                </p>
              </div>
            )}
          </TabsContent>
        )}

        <TabsContent value="market" className="mt-6">
          {/* Replaced DataPoolsList with LiquidityPools to support Researcher features */}
          <LiquidityPools twin={twin} />
        </TabsContent>

        {isResearcher && (
          <TabsContent value="purchases" className="mt-6">
            <PurchasedRecordsList twin={twin} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
