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
  const [month, setMonth] = useState<number | null>(null);



useEffect(() => {
  const token = sessionStorage.getItem("token");

  let url = process.env.NEXT_PUBLIC_API_URL + "/data";

  if (year) url += `?year=${year}`;
  if (month) url += `${year ? "&" : "?"}month=${month}`;

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
}, [year, month]);

  if (!data) return <div className="text-white p-10">Loading...</div>;

  const totalRevenue = data.monthly.reduce((a:any,b:any)=>a+b.Revenue,0);
  const totalTrips = data.monthly.reduce((a:any,b:any)=>a+b.Trips,0);
  const totalProfit = data.monthly.reduce((a:any,b:any)=>a+b.NetProfit,0);
  const totalExpense = totalRevenue - totalProfit;

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
        <select
          value={month || ""}
          onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : null)}
          className="bg-black border px-3 py-2"
        >
          <option value="">All Months</option>
          {[
            "Jan","Feb","Mar","Apr","May","Jun",
            "Jul","Aug","Sep","Oct","Nov","Dec"
          ].map((m, i) => (
            <option key={i} value={i+1}>{m}</option>
          ))}
        </select>
      </div>

      {/* KPI TABLE */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

      <div className="bg-blue-500/20 p-6 rounded-xl">
        <p className="text-gray-300">Revenue</p>
        <h2 className="text-2xl font-bold">₹ {totalRevenue}</h2>
      </div>

      <div className="bg-purple-500/20 p-6 rounded-xl">
        <p className="text-gray-300">Trips</p>
        <h2 className="text-2xl font-bold">{totalTrips}</h2>
      </div>

      <div className="bg-red-500/20 p-6 rounded-xl">
        <p className="text-gray-300">Expense</p>
        <h2 className="text-2xl font-bold">₹ {totalExpense}</h2>
      </div>

      <div className="bg-green-500/20 p-6 rounded-xl">
        <p className="text-gray-300">Profit</p>
        <h2 className="text-2xl font-bold">₹ {totalProfit}</h2>
      </div>

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