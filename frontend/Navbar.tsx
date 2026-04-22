"use client";

import { useSmoothRouter } from "@/components/UseSmoothRouter";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/" },
  { label: "Insights",  href: "/insights" },
  { label: "Monthly",   href: "/monthly" },
  { label: "Trips",     href: "/trips" },
];

export default function Navbar() {
  const { push } = useSmoothRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);

  const logout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("role");
    window.location.href = "/login";
  };

  useEffect(() => {
    const storedRole = sessionStorage.getItem("role");
    setRole(storedRole);
  }, []);

  const filteredNavItems = NAV_ITEMS.filter(item => {
    if (item.href === "/trips" && role !== "admin") {
      return false;
    }
    return true;
  });

  if (role === null) return null;

  return (
    <nav className="nav-root">
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center", height: 60 }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: "linear-gradient(135deg, #4f8ef7 0%, #a78bfa 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 800,
            fontFamily: "var(--font-display)",
            boxShadow: "0 0 20px rgba(79,142,247,0.3)"
          }}>
            IG
          </div>
          <span style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 16,
            color: "var(--text-primary)",
            letterSpacing: "-0.02em"
          }}>
            IGXact
          </span>
        </div>

        {/* Nav Links */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          
          {filteredNavItems.map(item => (
            <button
              key={item.href}
              className={`nav-link ${pathname === item.href ? "active" : ""}`}
              onClick={() => push(item.href)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Right Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "linear-gradient(135deg, #4f8ef7, #a78bfa)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: "#fff",
            flexShrink: 0,
          }}>
            H
          </div>
          <button className="btn-danger" onClick={logout}>
            Sign out
          </button>
        </div>

      </div>
    </nav>
  );
}
