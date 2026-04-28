"use client";
import { useEffect, useState } from "react";

/**
 * Returns the current role from sessionStorage.
 * If the role is not in `allowed`, redirects to "/" immediately.
 * Pass `allowed: null` to skip the check (any authenticated role OK).
 */
export function useRoleGuard(allowed: string[] | null): string | null {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const r = sessionStorage.getItem("role") ?? "";
    const token = sessionStorage.getItem("token");
    if (!token) { window.location.href = "/login"; return; }
    if (allowed && !allowed.includes(r)) { window.location.href = "/"; return; }
    setRole(r);
  }, []);

  return role;
}
