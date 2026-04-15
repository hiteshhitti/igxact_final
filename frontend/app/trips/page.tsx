"use client";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";

export default function TripsPage() {
  const [trips, setTrips] = useState<any[]>([]);
  const [form, setForm] = useState<any>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // 🔐 TOKEN LOAD
  useEffect(() => {
    const t = sessionStorage.getItem("token");

    if (!t || t === "undefined" || t === "null") {
      window.location.href = "/login";
      return;
    }

    setToken(t);
  }, []);

  // 🔥 FETCH TRIPS
  const fetchTrips = async () => {
    if (!token) return;

      let url = process.env.NEXT_PUBLIC_API_URL + "/trips";

      if (startDate) {
        url += `?start=${startDate}`;
      }

      if (endDate) {
        url += startDate
          ? `&end=${endDate}`
          : `?end=${endDate}`;
      }

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

    const data = await res.json();
    setTrips(data || []);
  };

  useEffect(() => {
    if (token) fetchTrips();
  }, [token]);

  // =========================
  // 🔥 CALCULATIONS
  // =========================

  const deal = Number(form["Deal Price"] || 0);
  const fuel = Number(form["Fuel"] || 0);
  const tolls = Number(form["Tolls & Taxes"] || 0);
  const parking = Number(form["Parking"] || 0);
  const driver = Number(form["Driver Allowance"] || 0);
  const commission = Number(form["Sales Commissio"] || 0);

  const netProfit = Math.round(
    deal - (fuel + tolls + parking + driver + commission)
  );

  const profitWithoutCommission = Math.round(netProfit + commission);

  const profitPercent =
    deal > 0 ? ((netProfit / deal) * 100).toFixed(2) : 0;

  // =========================
  // 🔥 SUBMIT
  // =========================

  const handleSubmit = async () => {
    if (!token) return;

    const payload = {
      ...form,
      "Net Profit (without Driver Salary)": netProfit,
      "Profit without commission": profitWithoutCommission,
      "Profit Percentage": Number(profitPercent),
    };

    if (editingId) {
      await fetch(
        process.env.NEXT_PUBLIC_API_URL + `/update-trip/${editingId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );
    } else {
      await fetch(
        process.env.NEXT_PUBLIC_API_URL + "/add-trip",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );
    }

    setForm({});
    setEditingId(null);
    fetchTrips();
  };

  return (
    <div className="min-h-screen bg-black text-white p-10">
      <Navbar />

      <h1 className="text-3xl font-bold mb-6">🚛 Trip Manager</h1>

      {/* ================= FORM ================= */}

      <div className="flex gap-4 mb-6">

        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="bg-black border p-2"
        />

        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="bg-black border p-2"
        />

        <button
          onClick={fetchTrips}
          className="bg-green-600 px-4 py-2 rounded"
        >
          Filter
        </button>

      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

        <input placeholder="Customer Name"
          value={form["Customer Name"] || ""}
          onChange={(e)=>setForm({...form,"Customer Name":e.target.value})} />

        <input placeholder="Contact Number"
          onChange={(e)=>setForm({...form,"Cust. Contact Number":e.target.value})} />

        <input placeholder="Vehicle"
          onChange={(e)=>setForm({...form,"Vehicle Details":e.target.value})} />

        <input placeholder="Trip From"
          onChange={(e)=>setForm({...form,"Trip From":e.target.value})} />

        <input placeholder="Trip To"
          onChange={(e)=>setForm({...form,"Trip TO":e.target.value})} />

        <input type="date"
          onChange={(e)=>setForm({...form,"Start Date":e.target.value})} />

        <input type="date"
          onChange={(e)=>setForm({...form,"End date":e.target.value})} />

        <input placeholder="Number of Days"
          onChange={(e)=>setForm({...form,"Number of Days":Number(e.target.value)})} />

        <input placeholder="Deal Price"
          onChange={(e)=>setForm({...form,"Deal Price":Number(e.target.value)})} />

        <input placeholder="Per Day Cost"
          onChange={(e)=>setForm({...form,"Per Day Cost":Number(e.target.value)})} />

        <input placeholder="Advance Cash"
          onChange={(e)=>setForm({...form,"Booking Amt/Advance Cash":Number(e.target.value)})} />

        <input placeholder="Advance Bank"
          onChange={(e)=>setForm({...form,"Booking Amt/Advance Bank":Number(e.target.value)})} />

        <input placeholder="Fuel"
          onChange={(e)=>setForm({...form,"Fuel":Number(e.target.value)})} />

        <input placeholder="Tolls & Taxes"
          onChange={(e)=>setForm({...form,"Tolls & Taxes":Number(e.target.value)})} />

        <input placeholder="Parking"
          onChange={(e)=>setForm({...form,"Parking":Number(e.target.value)})} />

        <input placeholder="Driver Allowance"
          onChange={(e)=>setForm({...form,"Driver Allowance":Number(e.target.value)})} />

        <input placeholder="Sales Commission"
          onChange={(e)=>setForm({...form,"Sales Commissio":Number(e.target.value)})} />

      </div>

      <button
        onClick={handleSubmit}
        className="bg-blue-600 px-6 py-2 rounded mb-10"
      >
        {editingId ? "Update Trip" : "Add Trip"}
      </button>

      {/* ================= CALCULATIONS ================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">

        <div className="bg-green-500/20 p-4 rounded">
          <p>Net Profit</p>
          <h2>₹ {netProfit}</h2>
        </div>

        <div className="bg-blue-500/20 p-4 rounded">
          <p>Profit without commission</p>
          <h2>₹ {profitWithoutCommission}</h2>
        </div>

        <div className="bg-purple-500/20 p-4 rounded">
          <p>Profit %</p>
          <h2>{profitPercent}%</h2>
        </div>

      </div>

      {/* ================= LIST ================= */}
      <div className="space-y-3">
        {trips.map((t:any)=>(
          <div key={t.trip_id} className="border p-3 flex justify-between">
            <span>
              #{t.trip_id} | {t["Customer Name"]} | {t["Trip From"]}
            </span>

            <button
              onClick={()=>{
                setEditingId(t.trip_id);
                setForm(t);
              }}
              className="bg-yellow-500 px-2"
            >
              Edit
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}