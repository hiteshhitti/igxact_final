"use client";
import { apiFetch } from "@/lib/apiFetch";
import { toast } from "@/lib/toast";
import Navbar from "@/components/Navbar";
import { useEffect, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type CRMEntry = {
  _row: number;
  timestamp: string;
  customer_name: string;
  contact: string;
  description: string;
  mode: string;
  status: string;
  channel: string;
  follow_up_date: string;
  deal_closed_date: string;
  attendant: string;
  vehicle: string;
};

type FollowupGroup = Record<string, CRMEntry[]>;

// ─── Constants ────────────────────────────────────────────────────────────────

const MODE_OPTIONS    = ["Call", "WhatsApp"];
const STATUS_OPTIONS  = ["Enquiry", "Booked", "Interested", "Super Interested", "Trip Decline", "Cancelled"];
const CHANNEL_OPTIONS = ["Meta Ads", "Google Ads"];

const STATUS_PILL: Record<string, string> = {
  "Enquiry":        "pill-blue",
  "Booked":         "pill-green",
  "Interested":     "pill-orange",
  "Super Interested":"pill-orange",
  "Trip Decline":   "pill-red",
  "Cancelled":      "pill-red",
};

const EMPTY_FORM = {
  customer_name: "", contact: "", description: "",
  mode: "Call", status: "Enquiry", channel: "Meta Ads",
  vehicle: "", follow_up_date: "", deal_closed_date: "", attendant: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().split("T")[0];

const Spinner = () => (
  <div style={{
    width: 32, height: 32, borderRadius: "50%",
    border: "3px solid rgba(37,99,235,0.15)",
    borderTopColor: "var(--accent-primary)",
    animation: "spin 0.8s linear infinite",
    margin: "0 auto",
  }} />
);

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CRMPage() {
  const [view, setView] = useState<"table" | "followups">("table");
  const [entries, setEntries] = useState<CRMEntry[]>([]);
  const [followupData, setFollowupData] = useState<{ grouped: FollowupGroup; today: string }>({ grouped: {}, today: "" });
  const [vehicles, setVehicles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus]   = useState("");
  const [filterChannel, setFilterChannel] = useState("");
  const [filterStart, setFilterStart]     = useState("");
  const [filterEnd, setFilterEnd]         = useState("");
  const [search, setSearch]               = useState("");

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "followup">("create");
  const [form, setForm]           = useState({ ...EMPTY_FORM });
  const [editRow, setEditRow]     = useState<number | null>(null);
  const [saving, setSaving]       = useState(false);

  // History
  const [historyModal, setHistoryModal]   = useState(false);
  const [historyEntries, setHistoryEntries] = useState<CRMEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Analytics
  const [analytics, setAnalytics] = useState<any>(null);

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus)  params.append("status", filterStatus);
      if (filterChannel) params.append("channel", filterChannel);
      if (filterStart)   params.append("start", filterStart);
      if (filterEnd)     params.append("end", filterEnd);
      if (search)        params.append("search", search);

      const res = await apiFetch(`/crm/entries?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to load CRM data");
      setEntries(data.entries || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterChannel, filterStart, filterEnd, search]);

  const fetchFollowups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/crm/followups");
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to load follow-ups");
      setFollowupData(data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchVehicles = useCallback(async () => {
    try {
      const res = await apiFetch("/vehicles");
      const data = await res.json();
      setVehicles(data.vehicles || []);
    } catch {/* non-critical */}
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await apiFetch("/crm/analytics");
      const data = await res.json();
      if (res.ok) setAnalytics(data);
    } catch {/* non-critical */}
  }, []);

  useEffect(() => {
    fetchVehicles();
    fetchAnalytics();
  }, []);

  useEffect(() => {
    if (view === "table") fetchEntries();
    else fetchFollowups();
  }, [view, fetchEntries, fetchFollowups]);

  // ── Modal helpers ─────────────────────────────────────────────────────────

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setEditRow(null);
    setModalMode("create");
    setShowModal(true);
  };

  const openEdit = (entry: CRMEntry) => {
    setForm({
      customer_name: entry.customer_name,
      contact: entry.contact,
      description: entry.description,
      mode: entry.mode || "Call",
      status: entry.status || "Enquiry",
      channel: entry.channel || "Meta Ads",
      vehicle: entry.vehicle || "",
      follow_up_date: entry.follow_up_date || "",
      deal_closed_date: entry.deal_closed_date || "",
      attendant: entry.attendant || "",
    });
    setEditRow(entry._row);
    setModalMode("edit");
    setShowModal(true);
  };

  const openFollowup = (entry: CRMEntry) => {
    setForm({
      ...EMPTY_FORM,
      customer_name: entry.customer_name,
      contact: entry.contact,
      mode: entry.mode || "Call",
      status: "Enquiry",
      channel: entry.channel || "Meta Ads",
    });
    setEditRow(null);
    setModalMode("followup");
    setShowModal(true);
  };

  const openHistory = async (entry: CRMEntry) => {
    setHistoryModal(true);
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ contact: entry.contact });
      const res = await apiFetch(`/crm/history?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to load history");
      setHistoryEntries(data.history || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      let res: Response;
      if (modalMode === "edit" && editRow) {
        res = await apiFetch(`/crm/entries/${editRow}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
      } else if (modalMode === "followup") {
        res = await apiFetch("/crm/followups", {
          method: "POST",
          body: JSON.stringify(form),
        });
      } else {
        res = await apiFetch("/crm/entries", {
          method: "POST",
          body: JSON.stringify(form),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to save");
      toast.success(modalMode === "edit" ? "Entry updated!" : "Entry saved!");
      setShowModal(false);
      fetchAnalytics();
      if (view === "table") fetchEntries();
      else fetchFollowups();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .crm-fade { animation: fadeIn 0.3s ease; }
        .modal-overlay {
          position:fixed; inset:0; background:rgba(0,0,0,0.45);
          backdrop-filter:blur(6px); z-index:1000;
          display:flex; align-items:center; justify-content:center; padding:16px;
        }
        .modal-box {
          background:var(--bg-elevated); border-radius:var(--radius-lg);
          border:1px solid var(--border-subtle); box-shadow:0 24px 80px rgba(0,0,0,0.18);
          width:100%; max-width:560px; max-height:90vh; overflow-y:auto;
          padding:28px;
        }
        .crm-tab-bar {
          display:flex; gap:4px; background:rgba(0,0,0,0.05);
          border-radius:var(--radius-sm); padding:4px; width:fit-content;
        }
        .crm-tab {
          padding:7px 18px; border-radius:6px; font-size:13px; font-weight:500;
          border:none; cursor:pointer; background:transparent;
          color:var(--text-secondary); transition:all 0.2s ease;
        }
        .crm-tab.active {
          background:var(--bg-elevated); color:var(--text-primary);
          box-shadow:0 1px 4px rgba(0,0,0,0.10);
        }
        .followup-group-header {
          display:flex; align-items:center; gap:10px; margin-bottom:12px;
        }
        .followup-card {
          background:var(--bg-card); border:1px solid var(--border-subtle);
          border-radius:var(--radius-md); padding:16px 18px;
          margin-bottom:10px; cursor:pointer;
          transition:all 0.22s ease; position:relative; overflow:hidden;
        }
        .followup-card::before {
          content:''; position:absolute; left:0; top:0; bottom:0; width:3px;
          background:var(--accent-primary); opacity:0; transition:opacity 0.2s;
        }
        .followup-card:hover { transform:translateY(-2px); border-color:var(--border-dim); box-shadow:var(--shadow-card); }
        .followup-card:hover::before { opacity:1; }
        .followup-card.today { border-color:rgba(37,99,235,0.30); }
        .followup-card.today::before { opacity:1; background:var(--accent-primary); }
        .followup-card.overdue { border-color:rgba(220,38,38,0.25); }
        .followup-card.overdue::before { opacity:1; background:var(--accent-red); }
        .analytics-bar {
          display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px;
          margin-bottom:24px;
        }
        .analytics-chip {
          background:var(--bg-card); border:1px solid var(--border-subtle);
          border-radius:var(--radius-md); padding:14px 16px;
        }
        .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        @media(max-width:560px) { .form-grid { grid-template-columns:1fr; } }
        .form-label { font-size:11px; font-weight:600; color:var(--text-muted);
          text-transform:uppercase; letter-spacing:0.07em; margin-bottom:5px; display:block; }
        .history-row {
          border-left:2px solid var(--border-dim); padding:10px 0 10px 14px;
          margin-bottom:8px; position:relative;
        }
        .history-row::before {
          content:''; position:absolute; left:-5px; top:16px;
          width:8px; height:8px; border-radius:50%;
          background:var(--accent-primary); border:2px solid var(--bg-elevated);
        }
      `}</style>

      <div className="page-root">
        <Navbar />
        <div className="page-content">

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24, flexWrap:"wrap", gap:12 }}>
            <div>
              <h1 style={{ fontSize:22, marginBottom:4 }}>📋 CRM</h1>
              <p style={{ fontSize:13, color:"var(--text-muted)" }}>
                All data synced with Google Sheets
              </p>
            </div>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <div className="crm-tab-bar">
                <button className={`crm-tab ${view === "table" ? "active" : ""}`} onClick={() => setView("table")}>All Entries</button>
                <button className={`crm-tab ${view === "followups" ? "active" : ""}`} onClick={() => setView("followups")}>Follow-Ups</button>
              </div>
              <button className="btn-primary" onClick={openCreate} style={{ fontSize:13 }}>
                + New Entry
              </button>
            </div>
          </div>

          {/* ── Analytics strip ────────────────────────────────────────── */}
          {analytics && (
            <div className="analytics-bar crm-fade">
              <div className="analytics-chip">
                <p style={{ fontSize:11, color:"var(--text-muted)", marginBottom:4, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" }}>Total</p>
                <p style={{ fontSize:22, fontWeight:800, fontFamily:"var(--font-display)" }}>{analytics.total}</p>
              </div>
              <div className="analytics-chip">
                <p style={{ fontSize:11, color:"var(--text-muted)", marginBottom:4, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" }}>Conversion</p>
                <p style={{ fontSize:22, fontWeight:800, fontFamily:"var(--font-display)", color:"var(--accent-green)" }}>{analytics.conversion_rate_pct}%</p>
              </div>
              <div className="analytics-chip">
                <p style={{ fontSize:11, color:"var(--text-muted)", marginBottom:4, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" }}>Follow-Ups</p>
                <p style={{ fontSize:22, fontWeight:800, fontFamily:"var(--font-display)", color:"var(--accent-orange)" }}>{analytics.followup_scheduled}</p>
              </div>
              {analytics.channel_counts && Object.entries(analytics.channel_counts as Record<string,number>).map(([ch, cnt]) => (
                <div className="analytics-chip" key={ch}>
                  <p style={{ fontSize:11, color:"var(--text-muted)", marginBottom:4, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" }}>{ch}</p>
                  <p style={{ fontSize:22, fontWeight:800, fontFamily:"var(--font-display)", color:"var(--accent-purple)" }}>{cnt as number}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── TABLE VIEW ─────────────────────────────────────────────── */}
          {view === "table" && (
            <div className="crm-fade">
              {/* Filters */}
              <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:18 }}>
                <input
                  className="input-field" placeholder="🔍 Search name / contact"
                  value={search} onChange={e => setSearch(e.target.value)}
                  style={{ width:220, fontSize:13 }}
                />
                <select className="input-field" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ fontSize:13 }}>
                  <option value="">All Statuses</option>
                  {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
                <select className="input-field" value={filterChannel} onChange={e => setFilterChannel(e.target.value)} style={{ fontSize:13 }}>
                  <option value="">All Channels</option>
                  {CHANNEL_OPTIONS.map(c => <option key={c}>{c}</option>)}
                </select>
                <input type="date" className="input-field" value={filterStart} onChange={e => setFilterStart(e.target.value)} style={{ fontSize:13 }} />
                <input type="date" className="input-field" value={filterEnd}   onChange={e => setFilterEnd(e.target.value)}   style={{ fontSize:13 }} />
                <button className="btn-ghost" onClick={fetchEntries} style={{ fontSize:13 }}>Apply</button>
                <button className="btn-ghost" onClick={() => {
                  setFilterStatus(""); setFilterChannel(""); setFilterStart(""); setFilterEnd(""); setSearch("");
                }} style={{ fontSize:13 }}>Clear</button>
              </div>

              {/* Table */}
              <div style={{ background:"var(--bg-card)", border:"1px solid var(--border-subtle)", borderRadius:"var(--radius-lg)", overflow:"hidden" }}>
                {loading ? (
                  <div style={{ padding:48, textAlign:"center" }}><Spinner /></div>
                ) : entries.length === 0 ? (
                  <div style={{ padding:48, textAlign:"center", color:"var(--text-muted)" }}>
                    No entries found. Create your first CRM entry.
                  </div>
                ) : (
                  <div style={{ overflowX:"auto" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Contact</th>
                          <th>Mode</th>
                          <th>Status</th>
                          <th>Channel</th>
                          <th>Vehicle</th>
                          <th>Follow-Up</th>
                          <th>Attendant</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((e) => (
                          <tr key={`${e._row}-${e.timestamp}`}>
                            <td>
                              <div style={{ fontWeight:600, color:"var(--text-primary)", fontSize:13 }}>{e.customer_name || "—"}</div>
                              <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>{e.timestamp?.slice(0,10)}</div>
                            </td>
                            <td style={{ fontFamily:"monospace", fontSize:13 }}>{e.contact || "—"}</td>
                            <td>
                              <span className={`pill ${e.mode === "WhatsApp" ? "pill-green" : "pill-blue"}`} style={{ fontSize:11 }}>
                                {e.mode === "WhatsApp" ? "💬" : "📞"} {e.mode || "—"}
                              </span>
                            </td>
                            <td>
                              <span className={`pill ${STATUS_PILL[e.status] || "pill-blue"}`} style={{ fontSize:11 }}>
                                {e.status || "—"}
                              </span>
                            </td>
                            <td style={{ fontSize:13 }}>{e.channel || "—"}</td>
                            <td style={{ fontSize:13, color:"var(--text-muted)" }}>{e.vehicle || "—"}</td>
                            <td style={{ fontSize:12 }}>
                              {e.follow_up_date ? (
                                <span style={{ color: e.follow_up_date === today() ? "var(--accent-primary)" : e.follow_up_date < today() ? "var(--accent-red)" : "var(--text-secondary)" }}>
                                  {e.follow_up_date === today() ? "🔔 " : e.follow_up_date < today() ? "⚠️ " : ""}{e.follow_up_date}
                                </span>
                              ) : "—"}
                            </td>
                            <td style={{ fontSize:13 }}>{e.attendant || "—"}</td>
                            <td>
                              <div style={{ display:"flex", gap:6 }}>
                                <button className="btn-ghost" style={{ padding:"4px 10px", fontSize:12 }} onClick={() => openEdit(e)}>Edit</button>
                                <button className="btn-ghost" style={{ padding:"4px 10px", fontSize:12 }} onClick={() => openFollowup(e)}>Follow Up</button>
                                <button className="btn-ghost" style={{ padding:"4px 10px", fontSize:12 }} onClick={() => openHistory(e)}>History</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <p style={{ fontSize:12, color:"var(--text-muted)", marginTop:10, textAlign:"right" }}>
                {entries.length} entries · Powered by Google Sheets
              </p>
            </div>
          )}

          {/* ── FOLLOW-UPS VIEW ─────────────────────────────────────────── */}
          {view === "followups" && (
            <div className="crm-fade">
              {loading ? (
                <div style={{ padding:48, textAlign:"center" }}><Spinner /></div>
              ) : Object.keys(followupData.grouped).length === 0 ? (
                <div style={{ padding:48, textAlign:"center", color:"var(--text-muted)" }}>
                  No follow-ups scheduled. Add follow_up_date to CRM entries.
                </div>
              ) : (
                Object.entries(followupData.grouped).map(([dateKey, cards]) => {
                  const isToday = dateKey === followupData.today;
                  const isOverdue = dateKey < followupData.today;
                  return (
                    <div key={dateKey} style={{ marginBottom:28 }}>
                      <div className="followup-group-header">
                        <div style={{
                          padding:"4px 14px", borderRadius:99,
                          background: isToday ? "rgba(37,99,235,0.12)" : isOverdue ? "rgba(220,38,38,0.10)" : "rgba(0,0,0,0.06)",
                          color: isToday ? "var(--accent-primary)" : isOverdue ? "var(--accent-red)" : "var(--text-secondary)",
                          fontSize:13, fontWeight:600,
                        }}>
                          {isToday ? "🔔 Today" : isOverdue ? "⚠️ Overdue" : "📅"} {dateKey}
                        </div>
                        <span style={{ fontSize:12, color:"var(--text-muted)" }}>{cards.length} follow-up{cards.length !== 1 ? "s" : ""}</span>
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:12 }}>
                        {(cards as CRMEntry[]).map((c) => (
                          <div
                            key={`${c._row}-${c.timestamp}`}
                            className={`followup-card ${c._is_today ? "today" : ""} ${c._is_overdue ? "overdue" : ""}`}
                            onClick={() => openFollowup(c)}
                          >
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                              <div>
                                <p style={{ fontWeight:700, fontSize:14, color:"var(--text-primary)" }}>{c.customer_name}</p>
                                <p style={{ fontSize:12, color:"var(--text-muted)", fontFamily:"monospace" }}>{c.contact}</p>
                              </div>
                              <span className={`pill ${STATUS_PILL[c.status] || "pill-blue"}`} style={{ fontSize:10 }}>{c.status}</span>
                            </div>
                            {c.description && (
                              <p style={{ fontSize:12, color:"var(--text-secondary)", marginBottom:8, lineHeight:1.5 }}>
                                {c.description.length > 80 ? c.description.slice(0, 80) + "…" : c.description}
                              </p>
                            )}
                            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                              <span className={`pill ${c.mode === "WhatsApp" ? "pill-green" : "pill-blue"}`} style={{ fontSize:10 }}>{c.mode}</span>
                              <span className="pill pill-orange" style={{ fontSize:10 }}>{c.channel}</span>
                              {c.vehicle && <span className="pill pill-blue" style={{ fontSize:10 }}>{c.vehicle}</span>}
                            </div>
                            <p style={{ fontSize:11, color:"var(--text-muted)", marginTop:8 }}>
                              Click to log a follow-up interaction →
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Entry Modal ─────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal-box crm-fade">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <h2 style={{ fontSize:17 }}>
                {modalMode === "edit" ? "✏️ Edit Entry" : modalMode === "followup" ? "🔁 Log Follow-Up" : "➕ New CRM Entry"}
              </h2>
              <button className="btn-ghost" style={{ padding:"4px 10px", fontSize:13 }} onClick={() => setShowModal(false)}>✕</button>
            </div>

            {modalMode === "followup" && (
              <div style={{ background:"rgba(37,99,235,0.06)", border:"1px solid rgba(37,99,235,0.15)", borderRadius:"var(--radius-sm)", padding:"10px 14px", marginBottom:16, fontSize:13, color:"var(--text-secondary)" }}>
                Creating a <strong>new row</strong> for this customer — their full history is preserved.
              </div>
            )}

            <div className="form-grid">
              <div style={{ gridColumn: modalMode === "followup" ? "1/-1" : undefined }}>
                <label className="form-label">Customer Name *</label>
                <input className="input-field" style={{ width:"100%", fontSize:13 }}
                  value={form.customer_name}
                  onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                  readOnly={modalMode === "followup"}
                />
              </div>
              <div>
                <label className="form-label">Contact *</label>
                <input className="input-field" style={{ width:"100%", fontSize:13 }}
                  value={form.contact}
                  onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
                  readOnly={modalMode === "followup"}
                />
              </div>
              <div>
                <label className="form-label">Mode *</label>
                <select className="input-field" style={{ width:"100%", fontSize:13 }}
                  value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}>
                  {MODE_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Status *</label>
                <select className="input-field" style={{ width:"100%", fontSize:13 }}
                  value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Channel *</label>
                <select className="input-field" style={{ width:"100%", fontSize:13 }}
                  value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
                  {CHANNEL_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Vehicle</label>
                <select className="input-field" style={{ width:"100%", fontSize:13 }}
                  value={form.vehicle} onChange={e => setForm(f => ({ ...f, vehicle: e.target.value }))}>
                  <option value="">— None —</option>
                  {vehicles.map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Follow-Up Date</label>
                <input type="date" className="input-field" style={{ width:"100%", fontSize:13 }}
                  value={form.follow_up_date}
                  onChange={e => setForm(f => ({ ...f, follow_up_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">Deal Closed Date</label>
                <input type="date" className="input-field" style={{ width:"100%", fontSize:13 }}
                  value={form.deal_closed_date}
                  onChange={e => setForm(f => ({ ...f, deal_closed_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label">Attendant</label>
                <input className="input-field" style={{ width:"100%", fontSize:13 }}
                  value={form.attendant}
                  onChange={e => setForm(f => ({ ...f, attendant: e.target.value }))}
                  placeholder="Staff name"
                />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label className="form-label">Description / Notes</label>
                <textarea className="input-field" style={{ width:"100%", fontSize:13, minHeight:80, resize:"vertical" }}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Customer notes, requirements, objections…"
                />
              </div>
            </div>

            <div style={{ display:"flex", gap:10, marginTop:20, justifyContent:"flex-end" }}>
              <button className="btn-ghost" onClick={() => setShowModal(false)} disabled={saving} style={{ fontSize:13 }}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ fontSize:13 }}>
                {saving ? "Saving…" : modalMode === "edit" ? "Update Entry" : "Save Entry"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── History Modal ──────────────────────────────────────────────────── */}
      {historyModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setHistoryModal(false); }}>
          <div className="modal-box crm-fade" style={{ maxWidth:640 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <h2 style={{ fontSize:17 }}>🕐 Customer Interaction History</h2>
              <button className="btn-ghost" style={{ padding:"4px 10px", fontSize:13 }} onClick={() => setHistoryModal(false)}>✕</button>
            </div>
            {historyLoading ? (
              <div style={{ textAlign:"center", padding:32 }}><Spinner /></div>
            ) : historyEntries.length === 0 ? (
              <p style={{ color:"var(--text-muted)", textAlign:"center", padding:32 }}>No history found.</p>
            ) : (
              <div>
                {historyEntries.map((h, i) => (
                  <div key={i} className="history-row">
                    <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:6, marginBottom:4 }}>
                      <span style={{ fontSize:12, color:"var(--text-muted)" }}>{h.timestamp}</span>
                      <div style={{ display:"flex", gap:6 }}>
                        <span className={`pill ${STATUS_PILL[h.status] || "pill-blue"}`} style={{ fontSize:10 }}>{h.status}</span>
                        <span className={`pill ${h.mode === "WhatsApp" ? "pill-green" : "pill-blue"}`} style={{ fontSize:10 }}>{h.mode}</span>
                        <span className="pill pill-orange" style={{ fontSize:10 }}>{h.channel}</span>
                      </div>
                    </div>
                    {h.description && (
                      <p style={{ fontSize:13, color:"var(--text-secondary)", lineHeight:1.5 }}>{h.description}</p>
                    )}
                    {h.follow_up_date && (
                      <p style={{ fontSize:11, color:"var(--text-muted)", marginTop:4 }}>📅 Follow-up: {h.follow_up_date}</p>
                    )}
                    {h.attendant && (
                      <p style={{ fontSize:11, color:"var(--text-muted)" }}>👤 {h.attendant}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
