"use client";

import Navbar from "@/components/Navbar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSmoothRouter } from "@/components/UseSmoothRouter";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Line,
  ResponsiveContainer, LabelList, PieChart, Pie, Cell
} from "recharts";




export default function InsightsPage() {
  const [data, setData] = useState<any>(null);
  const { push, isExiting } = useSmoothRouter();
  const [year, setYear] = useState<number | null>(null);
  const [years, setYears] = useState<number[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);


  const handleLogin = async () => {
  if (!username || !password) {
    alert("Enter username & password");
    return;
  }

  try {
    setLoading(true);

    const res = await fetch(
      process.env.NEXT_PUBLIC_API_URL + "/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.detail || "Login failed");
    }

    sessionStorage.setItem("token", data.access_token);

    window.location.href = "/";
  } catch (err: any) {
    alert(err.message);
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  const token = sessionStorage.getItem("token");

  if (!token) {
    window.location.href = "/login";
  }
}, []);





useEffect(() => {
  const token = sessionStorage.getItem("token");

  fetch(process.env.NEXT_PUBLIC_API_URL + "/data", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
    .then((res) => res.json())
    .then((res) => setData(res));
}, []);


const logout = () => {
  sessionStorage.removeItem("token");
  window.location.href = "/login";
};


  useEffect(() => {
  let url = process.env.NEXT_PUBLIC_API_URL + "/data";

  if (year) {
    url += `?year=${year}`;
  }

  const token = sessionStorage.getItem("token");

  fetch(url,{
    headers:{
      Authorization: `Bearer ${token}`,
    }
  })
    .then(res => {
      if (!res.ok) {
        throw new Error("Failed to fetch data");
      }
      return res.json();
    })
    .then(res => {
      setData(res);
      setYears(res.years || []);
    })
    .catch(err => {
      console.error(err);
    });

}, [year]);



const isLoading = !data;
const insights = data?.insights || {};
const extra = data?.extra_insights || {};



  const card =
    "bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-xl hover:scale-[1.03] transition";

  return (
    
    <div className="min-h-screen bg-gradient-to-br from-black via-[#020617] to-[#0f172a] text-white p-10">
        {isLoading && (
  <div className="absolute inset-0 flex items-center justify-center bg-black z-50">
    <Navbar />
    <p className="animate-pulse text-white text-lg">Loading Insights...</p>
  </div>
)}

<button onClick={logout}>
  Logout
</button>

<div className="mb-6 flex gap-4 items-center">
  <label className="text-sm text-gray-300">Year:</label>

  <select
    value={year || ""}
    onChange={(e) => setYear(Number(e.target.value))}
    className="bg-black border border-white/20 px-3 py-2 rounded-lg"
  >
    <option value="">Latest</option>

    {years.map((y) => (
      <option key={y} value={y}>
        {y}
      </option>
    ))}
  </select>
</div>
      <button onClick={() => push("/")}>
        🏠 Dashboard
      </button>
      <h1 className="text-4xl font-bold mb-8">🔥 AI Insights</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">


    <div className={card}>
            <h2 className="mb-4">💰 Vehicle Revenue</h2>

            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={extra.vehicle_deal}>
                <XAxis dataKey="vehicle" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
            </ResponsiveContainer>
    </div>


        <div className={card}>
            <h2 className="mb-4">🚛 Profit Per Day</h2>

            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={extra.vehicle_profit_per_day}>
                <XAxis dataKey="vehicle" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#22c55e" />
                </BarChart>
            </ResponsiveContainer>
        </div>



        <div className={card}>
            <h2 className="mb-4">🅿️ Parking / Day</h2>

            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={extra.parking_per_day}>
                <XAxis dataKey="vehicle" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#f97316" />
                </BarChart>
            </ResponsiveContainer>
        </div>

      </div>

      <div className={card}>
  <h2 className="mb-4">📅 Profit by Trip Duration</h2>

  <ResponsiveContainer width="100%" height={300}>
    <BarChart data={extra.profit_by_duration}>
      <XAxis dataKey="days" />
      <YAxis />
      <Tooltip />
      <Bar dataKey="profit" fill="#a855f7" />
    </BarChart>
  </ResponsiveContainer>
</div>
    </div>
    
  );
}