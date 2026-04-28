"use client";

import { useSmoothRouter } from "@/components/UseSmoothRouter";
import { useEffect, useState } from "react";

export default function Navbar() {
  const { push } = useSmoothRouter();
  const [role, setRole] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  const logout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("role");
    sessionStorage.removeItem("username");
    window.location.href = "/login";
  };

  useEffect(() => {
    setRole(sessionStorage.getItem("role"));
    setUsername(sessionStorage.getItem("username"));
  }, []);

  const isAdmin = role === "admin";
  const isStaff = role === "staff";
  const isUser  = role === "user";

  return (
    <div className="w-full flex justify-between items-center px-6 py-4
    bg-white/5 backdrop-blur-xl border-b border-white/10">

      <h1 className="text-xl font-bold">🚀 Travel Dashboard</h1>

      <div className="flex gap-6 text-sm items-center">

        {/* All roles see dashboard, insights, monthly */}
        <button onClick={() => push("/")}>Dashboard</button>
        <button onClick={() => push("/insights")}>Insights</button>
        <button onClick={() => push("/monthly")}>Monthly</button>

        {/* Staff and admin see trips + crm */}
        {(isAdmin || isStaff) && (
          <button onClick={() => push("/trips")}>Trips</button>
        )}
        {(isAdmin || isStaff) && (
          <button onClick={() => push("/crm")}>CRM</button>
        )}

        {/* Admin-only pages */}
        {isAdmin && <button onClick={() => push("/drivers")}>Drivers</button>}
        {isAdmin && <button onClick={() => push("/cars")}>Cars</button>}
        {isAdmin && <button onClick={() => push("/attendants")}>Attendants</button>}
        {isAdmin && <button onClick={() => push("/users")}>Users</button>}

        {username && (
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
            👤 {username}
          </span>
        )}

        <button
          onClick={logout}
          className="bg-red-600 px-3 py-1 rounded hover:bg-red-700"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
