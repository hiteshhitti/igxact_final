"use client";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";

export default function TripsPage() {
  const [trips, setTrips] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [form, setForm] = useState<any>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // =========================
  // 🔥 AUTO ID GENERATOR
  // =========================
  const generateId = () => `TRIP-${Date.now()}`;

  // 🔐 TOKEN
  useEffect(() => {
    const t = sessionStorage.getItem("token");

    if (!t || t === "undefined" || t === "null") {
      window.location.href = "/login";
      return;
    }

    setToken(t);
  }, []);

  // 🔥 FETCH COLUMNS
  useEffect(() => {
    if (!token) return;

    fetch(process.env.NEXT_PUBLIC_API_URL + "/columns", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setColumns(data);
        } else {
          setColumns(data.columns || []);
        }
      })
      .catch(() => setColumns([]));
  }, [token]);

  // 🔥 FETCH TRIPS
  const fetchTrips = async () => {
    if (!token) return;

    let url = process.env.NEXT_PUBLIC_API_URL + "/trips";

    if (startDate) url += `?start=${startDate}`;
    if (endDate)
      url += startDate ? `&end=${endDate}` : `?end=${endDate}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      console.error("API ERROR");
      return;
    }

    const data = await res.json();
    setTrips(data || []);
  };

  useEffect(() => {
    if (token) fetchTrips();
  }, [token, startDate, endDate]);

  // =========================
  // 🔥 SAFE NUMBER PARSE
  // =========================
  const num = (val: any) => Number(val) || 0;

  const formatToSheetDate = (dateStr: string) => {
      if (!dateStr) return "";

      const d = new Date(dateStr);

      const month = d.getMonth() + 1;
      const day = d.getDate();
      const year = d.getFullYear();

      return `${month}/${day}/${year}`; // 👉 MM/DD/YYYY
    };

  // =========================
  // 🔥 AUTO CALCULATIONS
  // =========================
  const deal = num(form["Deal Price"]);
  const fuel = num(form["Fuel"]);
  const tolls = num(form["Tolls & Taxes"]);
  const parking = num(form["Parking"]);
  const driver = num(form["Driver Allowance"]);
  const commission = num(form["Sales Commissio"]);

  const netProfit = Math.round(
    deal - (fuel + tolls + parking + driver + commission)
  );

  const profitWithoutCommission = Math.round(netProfit + commission);

  const profitPercent =
    deal > 0 ? ((netProfit / deal) * 100).toFixed(2) : 0;

  // =========================
  // 🔥 AUTO DAYS
  // =========================
  useEffect(() => {
    if (form["Start Date"] && form["End date"]) {
      const start = new Date(form["Start Date"]);
      const end = new Date(form["End date"]);

      const diff =
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

      setForm((prev: any) => ({
        ...prev,
        "Number of Days": diff + 1,
      }));
    }
  }, [form["Start Date"], form["End date"]]);

  // =========================
  // 🔥 SUBMIT
  // =========================
  const handleSubmit = async () => {
    if (!token) return;

    const payload = {
      ...form,
      "Start Date": formatToSheetDate(form["Start Date"]),
      "End date": formatToSheetDate(form["End date"]),
      trip_id: editingId || generateId(), // ✅ AUTO ID
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

      {/* FILTER */}
      <div className="flex gap-4 mb-6">
        <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} />
        <input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} />

        <button onClick={fetchTrips} className="bg-green-600 px-4 py-2 rounded">
          Filter
        </button>

        <button
          onClick={()=>{
            setStartDate("");
            setEndDate("");
          }}
          className="bg-gray-600 px-4 py-2 rounded"
        >
          Reset
        </button>
      </div>

      {/* FORM */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {Array.isArray(columns) && columns.map((col) => {

          if (
            col === "trip_id" ||
            col === "Profit Percentage" ||
            col === "Net Profit (without Driver Salary)" ||
            col === "Profit without commission"
          ) return null;

          return (
            <input
              key={col}
              type={
                col.toLowerCase().includes("date")
                  ? "date"
                  : col.toLowerCase().includes("price") ||
                    col.toLowerCase().includes("fuel") ||
                    col.toLowerCase().includes("toll") ||
                    col.toLowerCase().includes("parking") ||
                    col.toLowerCase().includes("allowance") ||
                    col.toLowerCase().includes("commiss")
                  ? "number"
                  : "text"
              }
              placeholder={col}
              value={form[col] || ""}
              onChange={(e) =>
                setForm({ ...form, [col]: e.target.value })
              }
              className="bg-black border p-2"
            />
          );
        })}
      </div>

      <button onClick={handleSubmit} className="bg-blue-600 px-6 py-2 rounded mb-10">
        {editingId ? "Update Trip" : "Add Trip"}
      </button>

      {/* CALCULATIONS */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <div className="bg-green-500/20 p-4 rounded">₹ {netProfit}</div>
        <div className="bg-blue-500/20 p-4 rounded">₹ {profitWithoutCommission}</div>
        <div className="bg-purple-500/20 p-4 rounded">{profitPercent}%</div>
      </div>

      {/* LIST */}
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
                window.scrollTo({ top: 0, behavior: "smooth" });
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