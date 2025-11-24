"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

type UserRole = "patient" | "researcher";

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  isPatient: boolean;
  isResearcher: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>("patient");

  const value = {
    role,
    setRole,
    isPatient: role === "patient",
    isResearcher: role === "researcher",
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
}

