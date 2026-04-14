"use client";

import Navbar from "@/components/Navbar";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";

export default function MonthlyPage() {
  const [data, setData] = useState<any>(null);
  const [year, setYear] = useState<number | null>(null);
  const [years, setYears] = useState<number[]>([]);

  useEffect(() => {
    const token = sessionStorage.getItem("token");

    let url = process.env.NEXT_PUBLIC_API_URL + "/data";
    if (year) url += `?year=${year}`;

    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(res => res.json())
      .then(res => {
        setData(res);
        setYears(res.years || []);
      });
  }, [year]);

  if (!data) return <div className="text-white p-10">Loading...</div>;

  return (
    <div className="min-h-screen bg-black text-white p-10 space-y-6">
      <Navbar />

      <h1 className="text-3xl font-bold">📅 Monthly Analysis</h1>

      {/* YEAR FILTER */}
      <div className="flex gap-4 items-center">
        <label>Year:</label>
        <select
          value={year || ""}
          onChange={(e) => setYear(e.target.value ? Number(e.target.value) : null)}
          className="bg-black border px-3 py-2"
        >
          <option value="">Latest</option>
          {years.map(y => <option key={y}>{y}</option>)}
        </select>
      </div>

      {/* KPI TABLE */}
      <div className="overflow-auto">
        <table className="w-full border border-white/20">
          <thead className="bg-white/10">
            <tr>
              <th>Month</th>
              <th>Trips</th>
              <th>Revenue</th>
              <th>Expense</th>
              <th>Profit</th>
            </tr>
          </thead>
          <tbody>
            {data.monthly.map((m:any,i:number)=>(
              <tr key={i} className="text-center border-t border-white/10">
                <td>{m.Month}</td>
                <td>{m.Trips}</td>
                <td>₹ {m.Revenue}</td>
                <td>₹ {m.TotalExpense}</td>
                <td>₹ {m.NetProfit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CHART */}
      <div className="bg-white/5 p-6 rounded-xl">
        <h2 className="mb-4">Revenue vs Profit</h2>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.monthly}>
            <XAxis dataKey="Month" />
            <YAxis />
            <Tooltip />

            <Bar dataKey="Revenue" fill="#3b82f6" />
            <Bar dataKey="NetProfit" fill="#22c55e" />
            <Bar dataKey="TotalExpense" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}