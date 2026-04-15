"use client";

import { useSmoothRouter } from "@/components/UseSmoothRouter";

export default function Navbar() {
  const { push } = useSmoothRouter();

  const logout = () => {
    sessionStorage.removeItem("token");
    window.location.href = "/login";
  };

  return (
    <div className="w-full flex justify-between items-center px-6 py-4 
    bg-white/5 backdrop-blur-xl border-b border-white/10">

      <h1 className="text-xl font-bold">🚀 Travel Dashboard</h1>

      <div className="flex gap-6 text-sm items-center">

        <button onClick={() => push("/")}>
          Dashboard
        </button>

        <button onClick={() => push("/insights")}>
          Insights
        </button>

        <button onClick={() => push("/monthly")}>
          Monthly
        </button>

        <button onClick={() => push("/trips")}>
          Trips
        </button>

        {/* 🔥 LOGOUT BUTTON */}
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