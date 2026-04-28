"use client";
import { apiFetch } from "@/lib/apiFetch";
import { toast } from "@/lib/toast";
import Navbar from "@/components/Navbar";
import { useEffect, useState, useCallback } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";

type Driver = {
  _row: number;
  "Name": string; "Father Name": string; "Age": string; "DOB": string;
  "Mobile 1": string; "Mobile 2": string;
  "Present Address": string; "Permanent Address": string;
  "Aadhaar Number": string; "DL Number": string; "DL Expiry": string;
};

const EMPTY: Omit<Driver, "_row"> = {
  "Name": "", "Father Name": "", "Age": "", "DOB": "",
  "Mobile 1": "", "Mobile 2": "",
  "Present Address": "", "Permanent Address": "",
  "Aadhaar Number": "", "DL Number": "", "DL Expiry": "",
};

const toPayload = (f: typeof EMPTY) => ({
  name: f["Name"], father_name: f["Father Name"], age: f["Age"], dob: f["DOB"],
  mobile1: f["Mobile 1"], mobile2: f["Mobile 2"],
  present_address: f["Present Address"], permanent_address: f["Permanent Address"],
  aadhaar_number: f["Aadhaar Number"], dl_number: f["DL Number"], dl_expiry: f["DL Expiry"],
});

export default function DriversPage() {
  const role = useRoleGuard(["admin"]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [editRow, setEditRow] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/drivers");
      const data = await res.json();
      setDrivers(data.drivers || []);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (role) load(); }, [role, load]);

  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setForm({ ...EMPTY }); setEditRow(null); setShowModal(true); };
  const openEdit = (d: Driver) => {
    const { _row, ...rest } = d;
    setForm(rest as typeof EMPTY);
    setEditRow(_row);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form["Name"].trim()) return toast.error("Name is required");
    setSaving(true);
    try {
      const url = editRow ? `/drivers/${editRow}` : "/drivers";
      const method = editRow ? "PUT" : "POST";
      const res = await apiFetch(url, { method, body: JSON.stringify(toPayload(form)) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      toast.success(editRow ? "Driver updated!" : "Driver added!");
      setShowModal(false); load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (row: number, name: string) => {
    if (!confirm(`Delete driver "${name}"?`)) return;
    try {
      const res = await apiFetch(`/drivers/${row}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      toast.success("Driver deleted");
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const F = ({ label, k, type = "text", full = false }: any) => (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 5 }}>{label}</label>
      <input type={type} className="input-field" style={{ fontSize: 13 }}
        value={(form as any)[k]} onChange={e => setF(k, e.target.value)} />
    </div>
  );

  if (!role) return null;
  return (
    <>
      <Navbar />
      <div className="page-root">
        <div className="page-content">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800 }}>Driver Details</h1>
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{drivers.length} drivers on record</p>
            </div>
            <button className="btn-primary" onClick={openCreate}>+ Add Driver</button>
          </div>

          {loading ? <p style={{ color: "var(--text-muted)" }}>Loading…</p> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border-primary)" }}>
                    {["Name","Father Name","Age","DOB","Mobile 1","Mobile 2","Aadhaar","DL Number","DL Expiry",""].map(h => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {drivers.map(d => (
                    <tr key={d._row} style={{ borderBottom: "1px solid var(--border-primary)" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{d["Name"]}</td>
                      <td style={{ padding: "10px 12px" }}>{d["Father Name"]}</td>
                      <td style={{ padding: "10px 12px" }}>{d["Age"]}</td>
                      <td style={{ padding: "10px 12px" }}>{d["DOB"]}</td>
                      <td style={{ padding: "10px 12px" }}>{d["Mobile 1"]}</td>
                      <td style={{ padding: "10px 12px" }}>{d["Mobile 2"]}</td>
                      <td style={{ padding: "10px 12px" }}>{d["Aadhaar Number"]}</td>
                      <td style={{ padding: "10px 12px" }}>{d["DL Number"]}</td>
                      <td style={{ padding: "10px 12px" }}>{d["DL Expiry"]}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => openEdit(d)}>Edit</button>
                          <button style={{ fontSize: 12, padding: "4px 10px", background: "rgba(220,38,38,0.1)", color: "var(--accent-red)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 8, cursor: "pointer" }} onClick={() => handleDelete(d._row, d["Name"])}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {drivers.length === 0 && <tr><td colSpan={10} style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>No drivers yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal-box" style={{ maxWidth: 680 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>{editRow ? "Edit Driver" : "Add Driver"}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <F label="Full Name *" k="Name" />
              <F label="Father's Name" k="Father Name" />
              <F label="Age" k="Age" />
              <F label="Date of Birth" k="DOB" type="date" />
              <F label="Mobile Number 1" k="Mobile 1" />
              <F label="Mobile Number 2" k="Mobile 2" />
              <F label="Present Address" k="Present Address" full />
              <F label="Permanent Address" k="Permanent Address" full />
              <F label="Aadhaar Number" k="Aadhaar Number" />
              <F label="DL Number" k="DL Number" />
              <F label="DL Expiry Date" k="DL Expiry" type="date" />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
              <button className="btn-ghost" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editRow ? "Update" : "Add Driver"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
