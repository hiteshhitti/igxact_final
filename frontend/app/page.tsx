"use client";

import { useEffect, useState } from "react";
import { useSmoothRouter } from "@/components/UseSmoothRouter";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Line,
  ResponsiveContainer, LabelList, PieChart, Pie, Cell
} from "recharts";




const COST_COLORS = ['#D85A30', '#BA7517', '#888780', '#1D9E75', '#7F77DD'];
const PAYMENT_COLORS = ['#EF9F27', '#378ADD'];

export default function Home() {
  const [year, setYear] = useState<number | null>(null);
  const [years, setYears] = useState<number[]>([]);
  const [data, setData] = useState<any>(null);
  const insights = data?.insights || {};
  const { push } = useSmoothRouter();


 

  useEffect(() => {

  console.log("API URL:", process.env.NEXT_PUBLIC_API_URL);
  const token = sessionStorage.getItem("token");
  

if (!token || token === "undefined" || token === "null") {
  sessionStorage.removeItem("token");
  window.location.href = "/login";
  return;
}

  let url = process.env.NEXT_PUBLIC_API_URL + "/data";

  if (year) {
    url += `?year=${year}`;
  }

  fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    }
  })
    .then(async (res) => {
      if (!res.ok) {
        console.error("FETCH ERROR STATUS:", res.status);

        const text = await res.text();
        console.error("FETCH ERROR BODY:", text);

        return;
      }

      return res.json();
    })
    .then(res => {
      if (!res) return;

      console.log("DATA RECEIVED:", res);

      setData(res);
      setYears(res.years || []);
    })
    .catch(err => {
      console.error("FETCH CRASH:", err);
    });

}, [year]);



  if (!data || !data.kpi) {
    return <div className="p-10 text-white">Loading...</div>;
  }

  const kpi = data?.kpi || {};

  const glass =
    "backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]";

  const tooltipStyle = {
    background: "rgba(0,0,0,0.7)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px",
    backdropFilter: "blur(10px)"
  };

  const logout = () => {
  sessionStorage.removeItem("token");
  window.location.href = "/login";
};

const formatTrips = (v: any) => `${v ?? 0} trips`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#020617] to-black text-white p-10 space-y-8">

      <h1 className="text-3xl font-bold">Dashboard 🔥</h1>

      <div className="mb-4 flex gap-4 items-center">
  <label className="text-sm text-gray-300">Year:</label>

  <select
    value={year || ""}
    // onChange={(e) => setYear(Number(e.target.value))}
    onChange={(e) => {
  const val = e.target.value;
  setYear(val ? Number(val) : null);
}}
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

      <button onClick={logout} className="bg-red-600 px-4 py-2 rounded">
        Logout
      </button>

      <button onClick={() => push("/insights")}>
        View Insights →
      </button>


      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        <div className={`${glass} p-6`}>
          <p className="text-gray-400">Total Revenue</p>
          <h2 className="text-2xl font-bold mt-2 hover:text-blue-400">
            ₹ {kpi.total_revenue}
          </h2>
        </div>

        <div className={`${glass} p-6`}>
          <p className="text-gray-400">Total Profit</p>
          <h2 className="text-2xl font-bold">₹ {kpi.total_profit}</h2>
        </div>

        <div className={`${glass} p-6`}>
          <p className="text-gray-400">Avg Margin</p>
          <h2 className="text-2xl font-bold">{kpi.avg_margin}%</h2>
        </div>

        <div className={`${glass} p-6`}>
          <p className="text-gray-400">Avg Deal</p>
          <h2 className="text-2xl font-bold">₹ {kpi.avg_deal}</h2>
        </div>

        <div className={`${glass} p-6`}>
          <p className="text-gray-400">Avg Days</p>
          <h2 className="text-2xl font-bold">{kpi.avg_days}</h2>
        </div>

        <div className={`${glass} p-6`}>
          <p className="text-gray-400">Cash</p>
          <h2 className="text-2xl font-bold">₹ {kpi.cash_total}</h2>
        </div>

        <div className={`${glass} p-6`}>
          <p className="text-gray-400">Bank</p>
          <h2 className="text-2xl font-bold">₹ {kpi.bank_total}</h2>
        </div>

      </div>

      {/* Monthly */}
      <div className={`${glass} p-6`}>
        <h2 className="text-lg font-semibold mb-4">Monthly Revenue & Profit</h2>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.monthly}>
            <defs>
              <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.9}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.2}/>
              </linearGradient>
            </defs>

            <XAxis dataKey="Month" stroke="#aaa" />
            <YAxis stroke="#aaa" />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />

            <Bar dataKey="Revenue" fill="url(#rev)" radius={[10,10,0,0]} />
            <Bar dataKey="NetProfit" fill="#1D9E75" radius={[10,10,0,0]} />

            <Line type="monotone" dataKey="Trips" stroke="#D85A30" strokeWidth={2} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* VEHICLE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div className={`${glass} p-6`}>
          <h2 className="mb-4">Total Revenue by Vehicle</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.vehicle}>
              <XAxis dataKey="Vehicle Details" stroke="#aaa" />
              <YAxis stroke="#aaa" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="TotalRevenue" fill="#1D9E75" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={`${glass} p-6`}>
          <h2 className="mb-4">Avg Margin by Vehicle</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.vehicle}>
              <XAxis dataKey="Vehicle Details" stroke="#aaa" />
              <YAxis stroke="#aaa" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="AvgMargin" fill="#7F77DD" />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* CUSTOMERS */}
      <div className={`${glass} p-6`}>
        <h2 className="mb-4">Top 10 Customers 🔥</h2>

        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data.top_customers} layout="vertical">
            <XAxis type="number" stroke="#aaa" />
            <YAxis dataKey="Customer" type="category" width={150} stroke="#aaa" />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="Revenue" fill="#378ADD" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ROUTES */}
      <div className={`${glass} p-6`}>
        <h2 className="mb-4">Top 10 Routes 🔥</h2>

        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={[...data.routes].reverse()} layout="vertical">
            <XAxis type="number" stroke="#aaa" />
            <YAxis dataKey="ShortRoute" type="category" width={200} stroke="#aaa" />
            <Tooltip contentStyle={tooltipStyle} />

            <Bar dataKey="TotalRevenue" fill="#D85A30">
              <LabelList dataKey="TripCount" position="right" formatter={formatTrips} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* COST */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div className={`${glass} p-6`}>
          <h2 className="mb-4">Cost Mix 💸</h2>

          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={data.cost_breakdown} dataKey="value" nameKey="name" outerRadius={100}
                label={(e:any)=>`${e.percent}%`}>
                {data.cost_breakdown.map((_:any,i:number)=>(
                  <Cell key={i} fill={COST_COLORS[i % COST_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className={`${glass} p-6`}>
          <h2 className="mb-4">Monthly Cost Breakdown 📊</h2>

          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.monthly_cost}>
              <XAxis dataKey="MonthNum" stroke="#aaa"/>
              <YAxis stroke="#aaa"/>
              <Tooltip contentStyle={tooltipStyle}/>
              <Legend />

              <Bar dataKey="Fuel" stackId="a" fill="#D85A30" />
              <Bar dataKey="Tolls & Taxes" stackId="a" fill="#BA7517" />
              <Bar dataKey="Parking" stackId="a" fill="#888780" />
              <Bar dataKey="Driver Allowance" stackId="a" fill="#1D9E75" />
              <Bar dataKey="Sales Commission" stackId="a" fill="#7F77DD" />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* DURATION + DAY */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div className={`${glass} p-6`}>
          <h2 className="mb-4">Trip Duration Distribution ⏱️</h2>

          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.duration_dist}>
              <XAxis dataKey="days" stroke="#aaa"/>
              <YAxis stroke="#aaa"/>
              <Tooltip contentStyle={tooltipStyle}/>
              <Bar dataKey="trips" fill="#378ADD">
                <LabelList dataKey="trips" position="top" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={`${glass} p-6`}>
          <h2 className="mb-4">Trip Departures by Day 📅</h2>

          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.day_of_week}>
              <XAxis dataKey="day" stroke="#aaa"/>
              <YAxis stroke="#aaa"/>
              <Tooltip contentStyle={tooltipStyle}/>

              <Bar dataKey="trips">
                {(data.day_of_week||[]).map((e:any,i:number)=>(
                  <Cell key={i} fill={e.day==="Saturday"?"#D85A30":"#888780"} />
                ))}
                <LabelList dataKey="trips" position="top" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* PAYMENT */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div className={`${glass} p-6`}>
          <h2 className="mb-4">Payment Mode Split 💰</h2>

          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={data.payment_split||[]} dataKey="value" nameKey="name" outerRadius={100}
                label={({payload})=>`${payload.percent}%`}>
                {(data.payment_split||[]).map((_:any,i:number)=>(
                  <Cell key={i} fill={PAYMENT_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle}
                formatter={(v:any,n:string,p:any)=>[`₹${(v ?? 0).toLocaleString("en-IN")} (${p.payload.percent}%)`,n]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className={`${glass} p-6`}>
          <h2 className="mb-4">Monthly Cash vs Bank 📊</h2>

          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.monthly_payment||[]}>
              <XAxis dataKey="MonthNum" stroke="#aaa"
                tickFormatter={(v:any)=>
                    ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][v-1]
                    } />
              <YAxis stroke="#aaa"/>
              <Tooltip contentStyle={tooltipStyle}
                formatter={(v:any)=>`₹${(v ?? 0).toLocaleString("en-IN")}`} />
              <Legend />

              <Bar dataKey="Cash" stackId="a" fill="#EF9F27" />
              <Bar dataKey="Bank" stackId="a" fill="#378ADD" />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* INSIGHTS */}
      <div className="bg-gradient-to-br from-purple-500/20 to-indigo-500/10 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-xl">

        <h2 className="text-xl font-bold mb-4">🔥 Key Insights</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

          <div className="bg-white/5 p-4 rounded-xl">
            <p className="text-sm text-gray-400">Best Month</p>
            <h3>{insights.best_month}</h3>
          </div>

          <div className="bg-white/5 p-4 rounded-xl">
            <p className="text-sm text-gray-400">Top Customer</p>
            <h3>{insights.best_customer}</h3>
          </div>

          <div className="bg-white/5 p-4 rounded-xl">
            <p className="text-sm text-gray-400">Best Vehicle</p>
            <h3>{insights.best_vehicle}</h3>
          </div>

        </div>
      </div>

      <div className="bg-white/5 p-4 rounded-xl">
  <p className="text-sm text-gray-400">Best Route</p>
  <h3>{insights.best_route}</h3>
</div>

<div className="bg-white/5 p-4 rounded-xl">
  <p className="text-sm text-gray-400">Saturday Trips</p>
  <h3>{insights.sat_trips}</h3>
</div>

<div className="bg-white/5 p-4 rounded-xl">
  <p className="text-sm text-gray-400">Fuel Cost %</p>
  <h3>{insights.fuel_pct}%</h3>
</div>

<div className="bg-white/5 p-4 rounded-xl">
  <p className="text-sm text-gray-400">Digital Payments %</p>
  <h3>{insights.digital_pct}%</h3>
</div>

    </div>
  );
}