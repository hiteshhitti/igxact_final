"use client";
import Navbar from "@/components/Navbar";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSmoothRouter } from "@/components/UseSmoothRouter";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Line,
  ResponsiveContainer, LabelList, PieChart, Pie, Cell
} from "recharts";

const COST_COLORS    = ['#4f8ef7', '#22d3a0', '#a78bfa', '#f97316', '#f87171'];
const PAYMENT_COLORS = ['#f97316', '#4f8ef7'];



const tooltipStyle = {
  background: "rgba(255,255,255,0.97)",
  border: "1px solid rgba(0,0,0,0.10)",
  borderRadius: 14,
  boxShadow: "0 8px 32px rgba(0,0,0,0.10)",
  backdropFilter: "blur(12px)",
  fontFamily: "var(--font-body)",
  fontSize: 13,
};

const axisProps = { stroke: "#475569", fontSize: 12, fontFamily: "var(--font-body)" };

const TripCard = ({ trip }: any) => {
  const pending = trip["Pending"];
  const pct = trip["Deal Price"] ? Math.round((trip["Received"] / trip["Deal Price"]) * 100) : 0;
  return (
    <div 
      className="trip-card"
      onClick={() => window.open(`/trip/${trip["trip id"]}`, "_blank")}
      style={{ cursor: "pointer" }}
    >
      <div style={{ marginBottom: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 600 }}>
          #{trip["trip id"]} • {trip["Customer Name"]}
        </p>

        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
          📞 {trip["Cust. Contact Number"]}
        </p>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>
            {trip["Trip From"]} → {trip["Trip TO"]}
          </p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {trip["Start Date"]} – {trip["End date"]}
          </p>
        </div>
        <span className="pill pill-blue" style={{ fontSize: 11 }}>
          {trip["Vehicle Details"]}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div style={{ background: "rgba(0,0,0,0.03)", borderRadius: 8, padding: "8px 10px" }}>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Deal</p>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>₹{(trip["Deal Price"] || 0).toLocaleString("en-IN")}</p>
        </div>
        <div style={{ background: "rgba(34,211,160,0.06)", borderRadius: 8, padding: "8px 10px" }}>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Received</p>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--accent-green)" }}>₹{(trip["Received"] || 0).toLocaleString("en-IN")}</p>
        </div>
      </div>
      {Number(pending) > 0 && (
        <p style={{ fontSize: 12, color: "var(--accent-red)" }}>Pending: ₹{Number(pending).toLocaleString("en-IN")}</p>
      )}
      <div className="progress-bar" style={{ marginTop: 8 }}>
        <div className="progress-fill" style={{ width: `${pct}%`, background: pct === 100 ? "var(--accent-green)" : "var(--accent-primary)" }} />
      </div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{pct}% received</p>
    </div>
  );
};

const KpiCard = ({ label, value, accent }: { label: string; value: string | number; accent?: string }) => (
  <div className="kpi-card">
    <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>{label}</p>
    <p style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800, color: accent || "var(--text-primary)", letterSpacing: "-0.03em" }}>{value}</p>
  </div>
);

export default function Home() {
  const [year, setYear] = useState<number | null>(null);
  const [years, setYears] = useState<number[]>([]);
  const [data, setData] = useState<any>(null);
  const { push } = useSmoothRouter();
  const router = useRouter();

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token || token === "undefined" || token === "null") {
      sessionStorage.removeItem("token");
      window.location.href = "/login";
      return;
    }
    let url = process.env.NEXT_PUBLIC_API_URL + "/data";
    if (year) url += `?year=${year}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (!res.ok) return;
        return res.json();
      })
      .then((res) => {
        if (!res) return;
        setData(res);
        setYears(res.years || []);
      })
      .catch(() => {});
  }, [year]);

  if (!data || !data.kpi) {
    return (
      <div className="page-root">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid rgba(79,142,247,0.2)", borderTopColor: "var(--accent-primary)", animation: "spin 0.8s linear infinite" }} />
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading your dashboard…</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  const kpi = data?.kpi || {};
  const insights = data?.insights || {};
  const monthTargets = data?.month_targets || [];
  const progressTrips = data?.pipeline?.progress || [];
  const bookedTrips   = data?.pipeline?.booked   || [];
  const progressTotal    = progressTrips.reduce((a: number, b: any) => a + (b["Deal Price"] || 0), 0);
  const progressReceived = progressTrips.reduce((a: number, b: any) => a + (b["Received"] || 0), 0);
  const bookedTotal      = bookedTrips.reduce((a: number, b: any) => a + (b["Deal Price"] || 0), 0);
  const bookedReceived   = bookedTrips.reduce((a: number, b: any) => a + (b["Received"] || 0), 0);
  const formatTrips = (v: any) => `${v ?? 0} trips`;

  return (
    <div className="page-root">
      <Navbar />

      <div className="page-content">

        {/* Page header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 4 }}>
              Dashboard
            </h1>

              <button
                onClick={() => router.push("/change-password")}
                className="text-gray-400 hover:text-white text-xl"
                title="Change Password"
              >
                ⚙️
              </button>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Your travel business at a glance</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <select
              className="input-field"
              style={{ width: "auto", padding: "8px 12px", fontSize: 13 }}
              value={year || ""}
              onChange={(e) => setYear(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Latest year</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button className="btn-ghost" style={{ fontSize: 13 }} onClick={() => push("/insights")}>
              View insights →
            </button>
          </div>
        </div>

        {/* KPI Grid */}
        <section className="section">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            <KpiCard label="Total Revenue"  value={`₹${(kpi.total_revenue || 0).toLocaleString("en-IN")}`} accent="var(--accent-primary)" />
            <KpiCard label="Total Profit"   value={`₹${(kpi.total_profit || 0).toLocaleString("en-IN")}`}  accent="var(--accent-green)" />
            <KpiCard label="Avg Margin"     value={`${kpi.avg_margin}%`} />
            <KpiCard label="Avg Deal Size"  value={`₹${(kpi.avg_deal || 0).toLocaleString("en-IN")}`} />
            <KpiCard label="Avg Duration"   value={`${kpi.avg_days} days`} />
            <KpiCard label="Cash Collected" value={`₹${(kpi.cash_total || 0).toLocaleString("en-IN")}`} accent="var(--accent-orange)" />
            <KpiCard label="Bank Collected" value={`₹${(kpi.bank_total || 0).toLocaleString("en-IN")}`} accent="var(--accent-purple)" />
          </div>
        </section>

        {/* Month Targets */}
        {monthTargets.length > 0 && (
          <section className="section">
            <div className="section-header">
              <h2 className="section-title">Monthly Targets</h2>
              <p className="section-subtitle">Track performance against your revenue goals</p>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {monthTargets.map((m: any, i: number) => {
                const remaining = Math.max(m.target - m.revenue, 0);
                const pct = m.target ? (m.revenue / m.target) * 100 : 0;
                const isGreen = m.status === "green";
                return (
                  <div key={i} className={`target-card ${isGreen ? "green" : "red"}`}>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{m.month}</p>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, color: isGreen ? "var(--accent-green)" : "var(--accent-red)" }}>
                      ₹{m.revenue.toLocaleString("en-IN")}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{m.trips} trips</p>
                    <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>Target: ₹{m.target.toLocaleString("en-IN")}</p>
                    {remaining === 0
                      ? <p style={{ fontSize: 11, color: "var(--accent-green)", marginTop: 4, fontWeight: 600 }}>✓ Achieved</p>
                      : <p style={{ fontSize: 11, color: "var(--accent-orange)", marginTop: 4 }}>₹{remaining.toLocaleString("en-IN")} left</p>
                    }
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${Math.min(pct, 100)}%`, background: isGreen ? "var(--accent-green)" : "var(--accent-red)" }} />
                    </div>
                    <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>{pct.toFixed(0)}%</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* In Progress Trips */}
        <section className="section">
          <div className="section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <h2 className="section-title">In Progress</h2>
              <p className="section-subtitle">{progressTrips.length} active trip{progressTrips.length !== 1 ? "s" : ""}</p>
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
              <span style={{ color: "var(--text-muted)" }}>Deal: <strong style={{ color: "var(--text-primary)" }}>₹{progressTotal.toLocaleString("en-IN")}</strong></span>
              <span style={{ color: "var(--text-muted)" }}>Received: <strong style={{ color: "var(--accent-green)" }}>₹{progressReceived.toLocaleString("en-IN")}</strong></span>
            </div>
          </div>
          {progressTrips.length === 0
            ? <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>No active trips</div>
            : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, maxHeight: 420, overflowY: "auto", paddingRight: 4 }}>
                {progressTrips.map((trip: any, i: number) => <TripCard key={i} trip={trip} />)}
              </div>
          }
        </section>

        {/* Booked Trips */}
        <section className="section">
          <div className="section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <h2 className="section-title">Booked Trips</h2>
              <p className="section-subtitle">{bookedTrips.length} upcoming trip{bookedTrips.length !== 1 ? "s" : ""}</p>
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
              <span style={{ color: "var(--text-muted)" }}>Deal: <strong style={{ color: "var(--text-primary)" }}>₹{bookedTotal.toLocaleString("en-IN")}</strong></span>
              <span style={{ color: "var(--text-muted)" }}>Received: <strong style={{ color: "var(--accent-green)" }}>₹{bookedReceived.toLocaleString("en-IN")}</strong></span>
            </div>
          </div>
          {bookedTrips.length === 0
            ? <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>No booked trips</div>
            : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, maxHeight: 420, overflowY: "auto", paddingRight: 4 }}>
                {bookedTrips.map((trip: any, i: number) => <TripCard key={i} trip={trip} />)}
              </div>
          }
        </section>

        {/* Charts */}
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">Revenue & Profit</h2>
          </div>
          <div className="chart-card">
            <h2>Monthly Revenue & Profit</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.monthly}>
                <defs>
                  <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#4f8ef7" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#4f8ef7" stopOpacity={0.3} />
                  </linearGradient>
                  <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#22d3a0" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#22d3a0" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="Month" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-secondary)" }} />
                <Bar dataKey="Revenue"   fill="url(#gradRev)"    radius={[6,6,0,0]} />
                <Bar dataKey="NetProfit" fill="url(#gradProfit)" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="section">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="chart-card">
              <h2>Revenue by Vehicle</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.vehicle}>
                  <XAxis dataKey="Vehicle Details" {...axisProps} />
                  <YAxis {...axisProps} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="TotalRevenue" fill="#4f8ef7" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-card">
              <h2>Avg Margin by Vehicle</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.vehicle}>
                  <XAxis dataKey="Vehicle Details" {...axisProps} />
                  <YAxis {...axisProps} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="AvgMargin" fill="#a78bfa" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="chart-card">
            <h2>Top 10 Customers</h2>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={data.top_customers} layout="vertical">
                <XAxis type="number" {...axisProps} />
                <YAxis dataKey="Customer" type="category" width={160} {...axisProps} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="Revenue" fill="#4f8ef7" radius={[0,6,6,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="section">
          <div className="chart-card">
            <h2>Top 10 Routes</h2>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={[...data.routes].reverse()} layout="vertical">
                <XAxis type="number" {...axisProps} />
                <YAxis dataKey="ShortRoute" type="category" width={200} {...axisProps} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="TotalRevenue" fill="#f97316" radius={[0,6,6,0]}>
                  <LabelList dataKey="TripCount" position="right" formatter={formatTrips} style={{ fontSize: 11, fill: "var(--text-muted)" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="section">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="chart-card">
              <h2>Cost Mix</h2>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={data.cost_breakdown} dataKey="value" nameKey="name" outerRadius={95} innerRadius={45} paddingAngle={3} label={(e: any) => `${e.percent}%`}>
                    {data.cost_breakdown.map((_: any, i: number) => <Cell key={i} fill={COST_COLORS[i % COST_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-secondary)" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-card">
              <h2>Revenue Breakdown</h2>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={data.revenue_breakdown || []} dataKey="value" nameKey="name" outerRadius={95} innerRadius={45} paddingAngle={3} label={(e: any) => `${(e.percent * 100).toFixed(0)}%`}>
                    {(data.revenue_breakdown || []).map((_: any, i: number) => <Cell key={i} fill={COST_COLORS[i % COST_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `₹${(v ?? 0).toLocaleString("en-IN")}`} />
                  <Legend wrapperStyle={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-secondary)" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="section">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="chart-card">
              <h2>Trip Duration Distribution</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.duration_dist}>
                  <XAxis dataKey="days" {...axisProps} />
                  <YAxis {...axisProps} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="trips" fill="#4f8ef7" radius={[6,6,0,0]}>
                    <LabelList dataKey="trips" position="top" style={{ fontSize: 11, fill: "var(--text-muted)" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-card">
              <h2>Departures by Day of Week</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.day_of_week}>
                  <XAxis dataKey="day" {...axisProps} />
                  <YAxis {...axisProps} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="trips" radius={[6,6,0,0]}>
                    {(data.day_of_week || []).map((e: any, i: number) => (
                      <Cell key={i} fill={e.day === "Saturday" ? "#f97316" : "#4f8ef7"} />
                    ))}
                    <LabelList dataKey="trips" position="top" style={{ fontSize: 11, fill: "var(--text-muted)" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="section">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="chart-card">
              <h2>Monthly Cost Breakdown</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.monthly_cost}>
                  <XAxis dataKey="MonthNum" {...axisProps} />
                  <YAxis {...axisProps} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-secondary)" }} />
                  <Bar dataKey="Fuel"              stackId="a" fill="#4f8ef7" />
                  <Bar dataKey="Tolls & Taxes"     stackId="a" fill="#22d3a0" />
                  <Bar dataKey="Parking"           stackId="a" fill="#a78bfa" />
                  <Bar dataKey="Driver Allowance"  stackId="a" fill="#f97316" />
                  <Bar dataKey="Sales Commission"  stackId="a" fill="#f87171" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-card">
              <h2>Monthly Cash vs Bank</h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.monthly_payment || []}>
                  <XAxis dataKey="MonthNum" {...axisProps} tickFormatter={(v: any) => ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][v-1]} />
                  <YAxis {...axisProps} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `₹${(v ?? 0).toLocaleString("en-IN")}`} />
                  <Legend wrapperStyle={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-secondary)" }} />
                  <Bar dataKey="Cash" stackId="a" fill="#f97316" />
                  <Bar dataKey="Bank" stackId="a" fill="#4f8ef7" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Key Insights */}
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">Key Insights</h2>
            <p className="section-subtitle">AI-powered summary of your business performance</p>
          </div>
          <div style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(124,58,237,0.06) 100%)", border: "1px solid rgba(37,99,235,0.12)", borderRadius: 20, padding: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              {[
                { label: "Best Month",        value: insights.best_month },
                { label: "Top Customer",      value: insights.best_customer },
                { label: "Best Vehicle",      value: insights.best_vehicle },
                { label: "Best Route",        value: insights.best_route },
                { label: "Saturday Trips",    value: insights.sat_trips },
                { label: "Fuel Cost %",       value: `${insights.fuel_pct}%` },
                { label: "Digital Payments %",value: `${insights.digital_pct}%` },
              ].map((item, i) => (
                <div key={i} style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12, padding: "14px 16px" }}>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>{item.label}</p>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{item.value || "—"}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
