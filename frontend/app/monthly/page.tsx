"use client";

import Navbar from "@/components/Navbar";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";

export default function MonthlyPage() {
  const [data, setData] = useState<any[]>([]);

  // const [fromDate, setFromDate] = useState("");
  // const [toDate, setToDate] = useState("");

  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("token");

    let url = process.env.NEXT_PUBLIC_API_URL + "/trips";

    if (fromDate) url += `?start=${fromDate.toISOString().split("T")[0]}`;
    if (toDate) url += `${fromDate ? "&" : "?"}end=${toDate.toISOString().split("T")[0]}`;

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

  const formattedData = finalData.map((item: any) => ({
    ...item,
    formattedDate: new Date(item["Start Date"]).toLocaleDateString("en-GB") // 11/01/2026
  }));

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
            setFromDate(null);
            setToDate(null);
          }}
        >
          All Data
        </button>

        <DatePicker
        selected={fromDate}
        onChange={(date : Date | null) => setFromDate(date)}
        placeholderText="FromDate"
        className="bg-black border px-3 py-2 text-white"
        dateFormat="dd/MM/yyy"
        />

        <DatePicker
        selected={toDate}
        onChange={(date : Date | null) => setToDate(date)}
        placeholderText="To Date"
        className="bg-black border px-3 py-2 text-white"
        dateFormat="dd/MM/yyyy"
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
          <BarChart 
          data={formattedData}
          margin={{top:20, right:20, left:0, bottom:80}}
          >
            <XAxis 
            dataKey="formattedDate"
            angle={-90}
            textAnchor="end"
            interval={0}
            height={120}
            />
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