"use client";

import { createContext, useContext, useState } from "react";

export type Role = "guest" | "member" | "admin";
type RoleState = {
  role: Role;
  setRole: (role: Role) => void;
  isAdFreeMember: boolean;
  setIsAdFreeMember: (isAdFree: boolean) => void;
};
const RoleContext = createContext<RoleState>({ role: "member", setRole: () => undefined, isAdFreeMember: false, setIsAdFreeMember: () => undefined });

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>("member");
  const [isAdFreeMember, setIsAdFreeMember] = useState(false);
  const setRole = (next: Role) => { setRoleState(next); };
  return <RoleContext.Provider value={{ role, setRole, isAdFreeMember, setIsAdFreeMember }}>{children}</RoleContext.Provider>;
}
export const useRole = () => useContext(RoleContext);
