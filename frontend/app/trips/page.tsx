"use client";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const datePickerStyles = `
  @keyframes spin { to { transform: rotate(360deg); } }
  .react-datepicker-wrapper { display: block; }
  .react-datepicker__input-container input {
    background: rgba(0,0,0,0.03);
    border: 1px solid rgba(0,0,0,0.10);
    border-radius: 8px;
    padding: 9px 13px;
    color: #0f172a;
    font-family: var(--font-body);
    font-size: 14px;
    outline: none;
    min-width: 140px;
  }
  .react-datepicker { background: #ffffff; border: 1px solid rgba(0,0,0,0.10); border-radius: 12px; font-family: var(--font-body); color: #0f172a; }
  .react-datepicker__header { background: #f0f4fb; border-bottom: 1px solid rgba(0,0,0,0.08); border-radius: 12px 12px 0 0; }
  .react-datepicker__current-month, .react-datepicker__day-name { color: #475569; }
  .react-datepicker__day { color: #0f172a; }
  .react-datepicker__day:hover { background: rgba(37,99,235,0.20); border-radius: 6px; }
  .react-datepicker__day--selected { background: #2563eb; border-radius: 6px; }
  .react-datepicker__navigation-icon::before { border-color: #475569; }
`;

const SKIP_COLS = new Set(["trip id","Profit Percentage","Net Profit (without Driver Salary)","Profit without commission"]);
const NUM_COLS  = new Set(["Deal Price","Fuel","Tolls & Taxes","Parking","Driver Allowance","Sales Commissio","Number of Days"]);

export default function TripsPage() {
  const [trips, setTrips]         = useState<any[]>([]);
  const [columns, setColumns]     = useState<string[]>([]);
  const [form, setForm]           = useState<any>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [token, setToken]         = useState<string | null>(null);
  const [hasFiltered, setHasFiltered] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate]     = useState<Date | null>(null);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [vehicles, setVehicles] = useState<string[]>([]);
  const [vehicle, setVehicle] = useState("");
  const [tripId, setTripId] = useState("");
  const [mobile, setMobile] = useState("");


useEffect(() => {
  if (!token) return;

  fetch(process.env.NEXT_PUBLIC_API_URL + "/vehicles", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);  // ✅ catch 401/500
      return res.json();
    })
    .then(data => setVehicles(data.vehicles || []))
    .catch(err => console.error("Vehicle fetch error:", err));

}, [token]);


  useEffect(() => {
    const t = sessionStorage.getItem("token");
    if (!t || t === "undefined" || t === "null") { window.location.href = "/login"; return; }
    setToken(t);
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch(process.env.NEXT_PUBLIC_API_URL + "/columns", { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setColumns(Array.isArray(data) ? data : (data.columns || [])))
      .catch(() => setColumns([]));
  }, [token]);

const fetchTrips = async () => {
    if (!token) return;

    // ❗ ab sirf tab empty return kare jab koi bhi filter na ho
    if (!startDate && !endDate && !tripId && !mobile) {
      setTrips([]);
      setHasFiltered(false);
      return;
    }

    setLoading(true);

    let url = process.env.NEXT_PUBLIC_API_URL + "/trips";

    const params = new URLSearchParams();

    // date filters
    if (startDate) {
      params.append("start", startDate.toISOString().split("T")[0]);
    }

    if (endDate) {
      params.append("end", endDate.toISOString().split("T")[0]);
    }

    // 🔥 new filters
    if (tripId) {
      params.append("trip_id", tripId);
    }

    if (mobile) {
      params.append("mobile", mobile);
    }

    url += "?" + params.toString();

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const data = await res.json();
      setTrips(data?.trips || []);
      setHasFiltered(true);
    }

    setLoading(false);
  };

  useEffect(() => { if (token) fetchTrips(); }, [token, startDate, endDate]);

  const num = (val: any) => Number(val) || 0;

  const formatToSheetDate = (dateStr: string) => {
    if (!dateStr) return "";
    let date = dateStr.includes("-") ? new Date(dateStr + "T00:00:00") : new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return `${String(date.getMonth()+1).padStart(2,"0")}/${String(date.getDate()).padStart(2,"0")}/${date.getFullYear()}`;
  };

  const convertToInputDate = (sheetDate: string) => {
    if (!sheetDate) return "";
    const parts = sheetDate.split("/");
    if (parts.length === 3) {
      const [month, day, year] = parts.map(Number);
      if (month && day && year) return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    }
    const date = new Date(sheetDate);
    return isNaN(date.getTime()) ? "" : date.toISOString().split("T")[0];
  };

  const deal       = num(form["Deal Price"]);
  const fuel       = num(form["Fuel"]);
  const tolls      = num(form["Tolls & Taxes"]);
  const parking    = num(form["Parking"]);
  const driver     = num(form["Driver Allowance"]);
  const commission = num(form["Sales Commissio"]);
  const netProfit  = Math.round(deal - (fuel + tolls + parking + driver + commission));
  const profitWithoutCommission = Math.round(netProfit + commission);
  const profitPercent = deal > 0 ? ((netProfit / deal) * 100).toFixed(1) : "0";

  useEffect(() => {
    if (form["Start Date"] && form["End date"]) {
      const start = new Date(form["Start Date"]);
      const end   = new Date(form["End date"]);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        const diff = (end.getTime() - start.getTime()) / (1000*60*60*24);
        setForm((prev: any) => ({ ...prev, "Number of Days": Math.round(diff + 1) }));
      }
    }
  }, [form["Start Date"], form["End date"]]);

  const handleSubmit = async () => {
    if (!token) return;
    setSaving(true);
    const payload = {
      ...form,
      "Start Date": formatToSheetDate(form["Start Date"] || ""),
      "End date":   formatToSheetDate(form["End date"]   || ""),
      "trip id": editingId ?? undefined,
      "Net Profit (without Driver Salary)": netProfit,
      "Profit without commission": profitWithoutCommission,
      "Profit Percentage": Number(profitPercent),
    };
    try {
      if (editingId) {
        await fetch(process.env.NEXT_PUBLIC_API_URL + `/update-trip/${editingId}`, {
          method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch(process.env.NEXT_PUBLIC_API_URL + "/add-trip", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      }
      setForm({}); setEditingId(null); fetchTrips();
    } catch { alert("Error saving trip."); }
    setSaving(false);
  };

  const handleEdit = (trip: any) => {
    if (!trip) return;
    const editableForm: any = { ...trip, status: trip.status || "booked" };
    editableForm["Start Date"] = convertToInputDate(trip["Start Date"] || "");
    editableForm["End date"]   = convertToInputDate(trip["End date"]   || "");
    setForm(editableForm);
    setEditingId(trip["trip id"]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const statusInfo: Record<string, { label: string; cls: string }> = {
    completed: { label: "Completed", cls: "pill-green" },
    progress:  { label: "In Progress", cls: "pill-orange" },
    booked:    { label: "Booked", cls: "pill-blue" },
  };

  return (
    <div className="page-root">
      <style>{datePickerStyles}</style>
      <Navbar />
      <div className="page-content">

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 4 }}>
            Trip Manager
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Add, edit and manage all your trips</p>
        </div>

        {/* Form */}
        <section className="section">
          <div style={{ background: "var(--bg-card)", border: `1px solid ${editingId ? "rgba(37,99,235,0.25)" : "var(--border-subtle)"}`, borderRadius: 20, padding: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <div>
                <h2 className="section-title">{editingId ? `Editing Trip #${editingId}` : "New Trip"}</h2>
                <p className="section-subtitle">{editingId ? "Make changes and save below" : "Fill in the trip details"}</p>
              </div>
              {editingId && (
                <button className="btn-ghost" onClick={() => { setForm({}); setEditingId(null); }}>
                  Cancel edit
                </button>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
              {Array.isArray(columns) && columns.map((col) => {
                if (SKIP_COLS.has(col)) return null;

                if (col.toLowerCase() === "status") {
                  return (
                    <div key={col}>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Status</label>
                      <select
                        className="input-field"
                        value={form[col] || "booked"}
                        onChange={(e) => setForm({ ...form, [col]: e.target.value })}
                      >
                        <option value="booked">Booked</option>
                        <option value="progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  );
                }

                const isDate   = col.toLowerCase().includes("date");
                const isNumber = NUM_COLS.has(col) || col.toLowerCase().includes("price") || col.toLowerCase().includes("fuel") || col.toLowerCase().includes("toll") || col.toLowerCase().includes("parking") || col.toLowerCase().includes("allowance") || col.toLowerCase().includes("commiss");

                return (
                  <div key={col}>
                    <label
                      style={{
                        display: "block",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--text-muted)",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        marginBottom: 6,
                      }}
                    >
                      {col}
                    </label>

                    {col === "Vehicle Details" ? (
                      <select
                        className="input-field"
                        value={form[col] || ""}
                        onChange={(e) =>
                          setForm({ ...form, [col]: e.target.value })
                        }
                      >
                        <option value="">Select Vehicle</option>

                        {vehicles.map((v, i) => (
                          <option key={i} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="input-field"
                        type={isDate ? "date" : isNumber ? "number" : "text"}
                        placeholder={col}
                        value={form[col] || ""}
                        onChange={(e) =>
                          setForm({ ...form, [col]: e.target.value })
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Live calculations */}
            {deal > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 22, padding: 18, background: "rgba(0,0,0,0.03)", borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
                <div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Net Profit</p>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, color: netProfit >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>₹{netProfit.toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>w/o Commission</p>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, color: "var(--accent-primary)" }}>₹{profitWithoutCommission.toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Margin</p>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, color: "var(--accent-purple)" }}>{profitPercent}%</p>
                </div>
              </div>
            )}

            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={saving}
              style={{ marginTop: 20, padding: "11px 28px", opacity: saving ? 0.7 : 1 }}
            >
              {saving
                ? <span style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.15)", borderTopColor: "var(--text-primary)", animation: "spin 0.7s linear infinite" }} /> Saving…</span>
                : editingId ? "Update Trip" : "Add Trip"
              }
            </button>
          </div>
        </section>

        {/* Filter */}
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">Trip List</h2>
            <p className="section-subtitle">Filter by date to browse and edit trips</p>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "14px 18px", marginBottom: 20 }}>
            <DatePicker selected={startDate} onChange={(d: Date | null) => setStartDate(d)} placeholderText="Start date" dateFormat="dd/MM/yyyy" />
            <span style={{ color: "var(--text-muted)" }}>→</span>
            <DatePicker selected={endDate}   onChange={(d: Date | null) => setEndDate(d)}   placeholderText="End date"   dateFormat="dd/MM/yyyy" />
            <button className="btn-primary"  style={{ padding: "8px 16px", fontSize: 13 }} onClick={fetchTrips}>Filter</button>
            <button className="btn-ghost"    style={{ padding: "8px 14px", fontSize: 13 }} onClick={() => { setStartDate(null); setEndDate(null); setTrips([]); setHasFiltered(false); }}>Reset</button>
            {loading && <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(37,99,235,0.20)", borderTopColor: "var(--accent-primary)", animation: "spin 0.7s linear infinite" }} />}
          </div>

                  <div style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                      flexWrap: "wrap"
                    }}>

                      <input
                        type="text"
                        placeholder="Trip ID"
                        value={tripId}
                        onChange={(e) => {
                          setTripId(e.target.value);
                          if (e.target.value) setMobile("");
                        }}
                        className="input-field"
                      />

                      <input
                        type="text"
                        placeholder="Mobile Number"
                        value={mobile}
                        onChange={(e) => {
                          setMobile(e.target.value);
                          if (e.target.value) setTripId("");
                        }}
                        className="input-field"
                      />

                      {/* 🔥 YAHAN BUTTON ADD KAR */}
                      <button
                        onClick={fetchTrips}
                        className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white"
                      >
                        Search
                      </button>

                    </div>

          {!hasFiltered && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: "48px 32px", textAlign: "center" }}>
              <p style={{ fontSize: 32, marginBottom: 12 }}>🗓️</p>
              <p style={{ color: "var(--text-secondary)", fontSize: 15, marginBottom: 6 }}>Select a date range to view trips</p>
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Use the filter above to find specific trips</p>
            </div>
          )}

          {hasFiltered && trips.length === 0 && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: "48px 32px", textAlign: "center" }}>
              <p style={{ fontSize: 32, marginBottom: 12 }}>😔</p>
              <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>No trips found for this date range</p>
            </div>
          )}

          {hasFiltered && trips.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {trips.map((t: any) => {
                const st = statusInfo[t.status] || { label: t.status, cls: "pill-blue" };
                return (
                  <div key={t["trip id"]} style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "border-color 0.2s ease" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.10)")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.06)")}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, minWidth: 50 }}>#{t["trip id"]}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{t["Customer Name"] || "—"}</span>
                      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{t["Trip From"]} → {t["Trip TO"]}</span>
                      <span className={`pill ${st.cls}`}>{st.label}</span>
                      {t["Deal Price"] && (
                        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>₹{Number(t["Deal Price"]).toLocaleString("en-IN")}</span>
                      )}
                    </div>
                    <button
                      className="btn-ghost"
                      style={{ padding: "6px 14px", fontSize: 13, flexShrink: 0, marginLeft: 12 }}
                      onClick={() => handleEdit(t)}
                    >
                      Edit
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
