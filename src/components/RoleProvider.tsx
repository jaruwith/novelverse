"use client";

import { createContext, useContext, useState } from "react";

export type Role = "guest" | "member" | "admin";
const RoleContext = createContext<{ role: Role; setRole: (role: Role) => void }>({ role: "member", setRole: () => undefined });

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>("member");
  const setRole = (next: Role) => { setRoleState(next); };
  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>;
}
export const useRole = () => useContext(RoleContext);
