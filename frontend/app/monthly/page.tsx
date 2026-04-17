"use client";

import Navbar from "@/components/Navbar";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";

export default function MonthlyPage() {
  const [data, setData] = useState<any[]>([]);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    const token = sessionStorage.getItem("token");

    let url = process.env.NEXT_PUBLIC_API_URL + "/trips";

    if (fromDate) url += `?start=${fromDate}`;
    if (toDate) url += `${fromDate ? "&" : "?"}end=${toDate}`;

    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(res => res.json())
      .then(res => {
        setData(res);
      });

  }, [fromDate, toDate]);

  if (!data) return <div className="text-white p-10">Loading...</div>;

  const finalData = data;

  // ✅ TOTALS
  const totalRevenue = finalData.reduce(
    (a: any, b: any) => a + Number(b["Deal Price"] || 0), 0
  );

  const totalTrips = finalData.length;

  const totalProfit = finalData.reduce(
    (a: any, b: any) => a + Number(b["Net Profit (without Driver Salary)"] || 0), 0
  );

  const totalExpense = totalRevenue - totalProfit;

  return (
    <div className="min-h-screen bg-black text-white p-10 space-y-6">
      <Navbar />

      <h1 className="text-3xl font-bold">📅 Date Range Analysis</h1>

      {/* FILTERS */}
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
          className="bg-black border px-3 py-2 text-white"
        />

        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="bg-black border px-3 py-2 text-white"
        />

      </div>

      {finalData.length === 0 && (
        <div className="text-center text-gray-400 mt-10">
          No data available for selected dates 😔
        </div>
      )}

      {/* KPI */}
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
        <h2 className="mb-4">Revenue vs Profit (Daily)</h2>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={finalData}>
            <XAxis dataKey="Start Date" />
            <YAxis />
            <Tooltip />

            <Bar dataKey="Deal Price" fill="#3b82f6" />
            <Bar dataKey="Net Profit (without Driver Salary)" fill="#22c55e" />
          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}