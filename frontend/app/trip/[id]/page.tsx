"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function TripDetail() {
  const params = useParams();
  const id = params?.id;

  const [trip, setTrip] = useState<any>(null);

  useEffect(() => {
    if (!id) return; // 🔥 MOST IMPORTANT LINE

    const fetchTrip = async () => {
      try {
        const token = localStorage.getItem("token");

        console.log("ID:", id); // 🔥 debug

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/trips?trip_id=${id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await res.json();
        console.log("DATA:", data);

        setTrip(data.trips?.[0]);
      } catch (err) {
        console.error("Error:", err);
      }
    };

    fetchTrip();
  }, [id]);

  if (!id) return <div className="p-6">Invalid Trip ID</div>;
  if (!trip) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">
        Trip #{trip["trip id"]}
      </h1>

      <p>{trip["Customer Name"]}</p>
      <p>{trip["Cust. Contact Number"]}</p>
    </div>
  );
}