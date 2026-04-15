"use client";
import { useState, useEffect } from "react";

export default function TripsPage() {
  const [trips, setTrips] = useState<any[]>([]);
  const [form, setForm] = useState<any>({});
  const [editingId, setEditingId] = useState<number | null>(null);

  const token = sessionStorage.getItem("token");

  // 🔥 FETCH TRIPS
  const fetchTrips = async () => {
    const res = await fetch("/api/trips", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setTrips(data);
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  // 🔥 ADD / UPDATE
  const handleSubmit = async () => {
    if (editingId) {
      await fetch(`/api/update-trip/${editingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/add-trip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
    }

    setForm({});
    setEditingId(null);
    fetchTrips();
  };

  return (
    <div className="p-10 text-white">

      <h1 className="text-2xl mb-4">Trip Manager 🚛</h1>

      {/* FORM */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <input placeholder="Customer"
          onChange={(e)=>setForm({...form,"Customer Name":e.target.value})} />

        <input placeholder="From"
          onChange={(e)=>setForm({...form,"Trip From":e.target.value})} />

        <input placeholder="To"
          onChange={(e)=>setForm({...form,"Trip TO":e.target.value})} />

        <input type="date"
          onChange={(e)=>setForm({...form,"Start Date":e.target.value})} />

        <input placeholder="Deal Price"
          onChange={(e)=>setForm({...form,"Deal Price":e.target.value})} />
      </div>

      <button onClick={handleSubmit} className="bg-blue-500 px-4 py-2">
        {editingId ? "Update Trip" : "Add Trip"}
      </button>

      {/* LIST */}
      <div className="mt-10">
        {trips.map((t:any)=>(
          <div key={t.trip_id} className="border p-3 mb-2 flex justify-between">

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