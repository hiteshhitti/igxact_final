"use client";

import { useSmoothRouter } from "@/components/UseSmoothRouter";

export default function Navbar() {
  const { push } = useSmoothRouter();

  return (
    <div className="w-full flex justify-between items-center px-6 py-4 
    bg-white/5 backdrop-blur-xl border-b border-white/10">

      <h1 className="text-xl font-bold">🚀 Travel Dashboard</h1>

      <div className="flex gap-6 text-sm">

        <button onClick={() => push("/")}>
          Dashboard
        </button>

        <button onClick={() => push("/insights")}>
          Insights
        </button>

        <button onClick={() => push("/monthly")}>
          Monthly
        </button>

      </div>
    </div>
  );
}