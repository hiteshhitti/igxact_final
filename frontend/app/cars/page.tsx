"use client";
import { apiFetch } from "@/lib/apiFetch";
import { toast } from "@/lib/toast";
import Navbar from "@/components/Navbar";
import { useEffect, useState, useCallback } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";

type Car = {
  _row: number;
  "Registration Number": string; "Chassis Number": string;
  "Insurance Expiry": string; "Local Permit Date": string; "National Permit Date": string;
};

const EMPTY: Omit<Car, "_row"> = {
  "Registration Number": "", "Chassis Number": "",
  "Insurance Expiry": "", "Local Permit Date": "", "National Permit Date": "",
};

const toPayload = (f: typeof EMPTY) => ({
  registration_number: f["Registration Number"],
  chassis_number: f["Chassis Number"],
  insurance_expiry: f["Insurance Expiry"],
  local_permit_date: f["Local Permit Date"],
  national_permit_date: f["National Permit Date"],
});

// Highlight dates expiring within 30 days
function expiryColor(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const diff = (d.getTime() - Date.now()) / 86400000;
    if (diff < 0) return "var(--accent-red)";
    if (diff < 30) return "var(--accent-orange)";
  } catch {}
  return "";
}

export default function CarsPage() {
  const role = useRoleGuard(["admin"]);
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [editRow, setEditRow] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/cars");
      const data = await res.json();
      setCars(data.cars || []);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (role) load(); }, [role, load]);

  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setForm({ ...EMPTY }); setEditRow(null); setShowModal(true); };
  const openEdit = (c: Car) => {
    const { _row, ...rest } = c;
    setForm(rest as typeof EMPTY);
    setEditRow(_row);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form["Registration Number"].trim()) return toast.error("Registration number is required");
    setSaving(true);
    try {
      const url = editRow ? `/cars/${editRow}` : "/cars";
      const method = editRow ? "PUT" : "POST";
      const res = await apiFetch(url, { method, body: JSON.stringify(toPayload(form)) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      toast.success(editRow ? "Car updated!" : "Car added!");
      setShowModal(false); load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (row: number, reg: string) => {
    if (!confirm(`Delete car "${reg}"?`)) return;
    try {
      const res = await apiFetch(`/cars/${row}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      toast.success("Car deleted"); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const F = ({ label, k, type = "text" }: any) => (
    <div>
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
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800 }}>Car Details</h1>
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{cars.length} vehicles — dates in 🟠 expire within 30 days, 🔴 already expired</p>
            </div>
            <button className="btn-primary" onClick={openCreate}>+ Add Car</button>
          </div>

          {loading ? <p style={{ color: "var(--text-muted)" }}>Loading…</p> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border-primary)" }}>
                    {["Registration No","Chassis No","Insurance Expiry","Local Permit","National Permit",""].map(h => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cars.map(c => (
                    <tr key={c._row} style={{ borderBottom: "1px solid var(--border-primary)" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{c["Registration Number"]}</td>
                      <td style={{ padding: "10px 12px" }}>{c["Chassis Number"]}</td>
                      <td style={{ padding: "10px 12px", color: expiryColor(c["Insurance Expiry"]) || undefined, fontWeight: expiryColor(c["Insurance Expiry"]) ? 700 : undefined }}>{c["Insurance Expiry"] || "—"}</td>
                      <td style={{ padding: "10px 12px", color: expiryColor(c["Local Permit Date"]) || undefined, fontWeight: expiryColor(c["Local Permit Date"]) ? 700 : undefined }}>{c["Local Permit Date"] || "—"}</td>
                      <td style={{ padding: "10px 12px", color: expiryColor(c["National Permit Date"]) || undefined, fontWeight: expiryColor(c["National Permit Date"]) ? 700 : undefined }}>{c["National Permit Date"] || "—"}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => openEdit(c)}>Edit</button>
                          <button style={{ fontSize: 12, padding: "4px 10px", background: "rgba(220,38,38,0.1)", color: "var(--accent-red)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 8, cursor: "pointer" }} onClick={() => handleDelete(c._row, c["Registration Number"])}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {cars.length === 0 && <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>No cars yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal-box" style={{ maxWidth: 560 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>{editRow ? "Edit Car" : "Add Car"}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <F label="Registration Number *" k="Registration Number" />
              <F label="Chassis Number" k="Chassis Number" />
              <F label="Insurance Expiry Date" k="Insurance Expiry" type="date" />
              <F label="Local Permit Date" k="Local Permit Date" type="date" />
              <F label="National Permit Date" k="National Permit Date" type="date" />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
              <button className="btn-ghost" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editRow ? "Update" : "Add Car"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
