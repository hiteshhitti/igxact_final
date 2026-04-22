"use client";

import { useEffect, useState } from "react";

export default function TripDetail({ params }: any) {
  const { id } = params;
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrip = async () => {
      try {
        const token = localStorage.getItem("token");

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/trips?trip_id=${id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await res.json();
        setTrip(data.trips?.[0]);
      } catch (err) {
        console.error("Error fetching trip:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTrip();
  }, [id]);

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!trip) {
    return <div className="p-6">No data found</div>;
  }

  return (
    <div className="p-6">
      {/* HEADER */}
      <h1 className="text-2xl font-bold mb-4">
        Trip #{trip["trip id"]}
      </h1>

      {/* CUSTOMER */}
      <div className="bg-white/5 p-4 rounded mb-4">
        <h2 className="text-lg font-semibold mb-2">Customer</h2>
        <p><strong>Name:</strong> {trip["Customer Name"]}</p>
        <p><strong>Mobile:</strong> {trip["Cust. Contact Number"]}</p>
      </div>

      {/* TRIP DETAILS */}
      <div className="bg-white/5 p-4 rounded mb-4">
        <h2 className="text-lg font-semibold mb-2">Trip Details</h2>
        <p><strong>Route:</strong> {trip["Trip From"]} → {trip["Trip TO"]}</p>
        <p><strong>Start:</strong> {trip["Start Date"]}</p>
        <p><strong>End:</strong> {trip["End date"]}</p>
        <p><strong>Vehicle:</strong> {trip["Vehicle Details"]}</p>
      </div>

      {/* PAYMENT */}
      <div className="bg-white/5 p-4 rounded mb-4">
        <h2 className="text-lg font-semibold mb-2">Payment</h2>
        <p><strong>Deal:</strong> ₹{(trip["Deal Price"] || 0).toLocaleString("en-IN")}</p>
        <p><strong>Received:</strong> ₹{(trip["Received"] || 0).toLocaleString("en-IN")}</p>
        <p><strong>Pending:</strong> ₹{(trip["Pending"] || 0).toLocaleString("en-IN")}</p>
      </div>

      {/* FULL RAW DATA (DEBUG / OPTIONAL) */}
      <div className="bg-black/40 p-4 rounded mt-6">
        <h2 className="text-sm text-gray-400 mb-2">Raw Data</h2>
        <pre className="text-xs">
          {JSON.stringify(trip, null, 2)}
        </pre>
      </div>
    </div>
  );
}