"use client";

import Navbar from "@/components/Navbar";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";

export default function MonthlyPage() {
  const [data, setData] = useState<any>(null);

  // 🔥 NEW DATE FILTER STATES
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    let url = process.env.NEXT_PUBLIC_API_URL + "/data";

    const token = sessionStorage.getItem("token");

    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(res => res.json())
      .then(res => {
        setData(res);
      });

  }, []);

  if (!data) return <div className="text-white p-10">Loading...</div>;

  const monthlyData = data.monthly || [];

  // 🔥 DATE FILTER LOGIC
  const finalData = monthlyData.filter((item: any) => {
    if (!fromDate || !toDate) return true;

    const itemDate = new Date(item.Date);
    const from = new Date(fromDate);
    const to = new Date(toDate);

    return itemDate >= from && itemDate <= to;
  });

  // 🔥 TOTALS FROM FILTERED DATA
  const totalRevenue = finalData.reduce((a:any,b:any)=>a+b.Revenue,0);
  const totalTrips = finalData.reduce((a:any,b:any)=>a+b.Trips,0);
  const totalProfit = finalData.reduce((a:any,b:any)=>a+b.NetProfit,0);
  const totalExpense = totalRevenue - totalProfit;

  return (
    <div className="min-h-screen bg-black text-white p-10 space-y-6">
      <Navbar />

      <h1 className="text-3xl font-bold">📅 Monthly Analysis</h1>

      {/* 🔥 NEW FILTER UI */}
      <div className="flex gap-4 items-center">

        <button
          className="px-4 py-2 bg-blue-500 text-white rounded"
          onClick={() => {
            setFromDate("");
            setToDate("");
          }}
        >
          All Data
        </button>

        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="bg-black border px-3 py-2"
        />

        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="bg-black border px-3 py-2"
        />

      </div>

      {finalData.length === 0 && (
        <div className="text-center text-gray-400 mt-10">
          No data available for selected dates 😔
        </div>
      )}

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
          <BarChart data={finalData}>
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