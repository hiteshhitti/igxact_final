"use client";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";

export default function TripsPage() {
  const [trips, setTrips] = useState<any[]>([]);
  const [form, setForm] = useState<any>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // 🔐 TOKEN LOAD (Vercel safe)
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

    try {
      const res = await fetch(
        process.env.NEXT_PUBLIC_API_URL + "/trips",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();
      setTrips(data || []);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  useEffect(() => {
    if (token) fetchTrips();
  }, [token]);

  // 🔥 ADD / UPDATE
  const handleSubmit = async () => {
    if (!token) return;

    try {
      if (editingId) {
        await fetch(
          process.env.NEXT_PUBLIC_API_URL + `/update-trip/${editingId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(form),
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
            body: JSON.stringify(form),
          }
        );
      }

      setForm({});
      setEditingId(null);
      fetchTrips();

    } catch (err) {
      console.error("Submit error:", err);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-10">
      <Navbar />

      <h1 className="text-3xl font-bold mb-6">🚛 Trip Manager</h1>

      {/* FORM */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

        <input
          className="bg-black border p-2"
          placeholder="Customer"
          value={form["Customer Name"] || ""}
          onChange={(e) =>
            setForm({ ...form, "Customer Name": e.target.value })
          }
        />

        <input
          className="bg-black border p-2"
          placeholder="From"
          value={form["Trip From"] || ""}
          onChange={(e) =>
            setForm({ ...form, "Trip From": e.target.value })
          }
        />

        <input
          className="bg-black border p-2"
          placeholder="To"
          value={form["Trip TO"] || ""}
          onChange={(e) =>
            setForm({ ...form, "Trip TO": e.target.value })
          }
        />

        <input
          type="date"
          className="bg-black border p-2"
          value={form["Start Date"] || ""}
          onChange={(e) =>
            setForm({ ...form, "Start Date": e.target.value })
          }
        />

        <input
          className="bg-black border p-2"
          placeholder="Deal Price"
          value={form["Deal Price"] || ""}
          onChange={(e) =>
            setForm({ ...form, "Deal Price": Number(e.target.value) })
          }
        />

      </div>

      <button
        onClick={handleSubmit}
        className="bg-blue-600 px-6 py-2 rounded mb-10"
      >
        {editingId ? "Update Trip" : "Add Trip"}
      </button>

      {/* LIST */}
      <div className="space-y-3">

        {trips.length === 0 && (
          <p className="text-gray-400">No trips found</p>
        )}

        {trips.map((t: any) => (
          <div
            key={t.trip_id}
            className="border border-white/20 p-4 flex justify-between items-center rounded"
          >
            <span>
              #{t.trip_id} | {t["Customer Name"]} | {t["Trip From"]} → {t["Trip TO"]}
            </span>

            <button
              onClick={() => {
                setEditingId(t.trip_id);
                setForm(t);
              }}
              className="bg-yellow-500 px-3 py-1 rounded"
            >
              Edit
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}