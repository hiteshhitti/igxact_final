"use client";
import { apiFetch } from "@/lib/apiFetch";
import { toast } from "@/lib/toast";
import Navbar from "@/components/Navbar";
import { useEffect, useState, useCallback } from "react";
import { useRoleGuard } from "@/lib/useRoleGuard";

type User = { id: number; username: string; role: string };
type NewUser = { username: string; password: string; role: string };

const ROLE_LABELS: Record<string, string> = {
  admin: "🔑 Admin",
  staff: "🖊️ Staff",
  user:  "👁️ User",
};

const ROLE_PILL: Record<string, string> = {
  admin: "pill-red",
  staff: "pill-orange",
  user:  "pill-blue",
};

const ROLE_DESC: Record<string, string> = {
  admin: "Full access — all pages, all operations",
  staff: "Can make entries in Trips & CRM pages",
  user:  "View only — Dashboard, Insights, Monthly",
};

export default function UsersPage() {
  const role = useRoleGuard(["admin"]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewUser>({ username: "", password: "", role: "user" });
  const [saving, setSaving] = useState(false);
  const currentUsername = typeof window !== "undefined" ? sessionStorage.getItem("username") : null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/users");
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (role) load(); }, [role, load]);

  const handleCreate = async () => {
    if (!form.username.trim()) return toast.error("Username is required");
    if (!form.password.trim() || form.password.length < 4) return toast.error("Password must be at least 4 characters");
    setSaving(true);
    try {
      const res = await apiFetch("/users", { method: "POST", body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      toast.success(`User "${form.username}" created!`);
      setShowModal(false);
      setForm({ username: "", password: "", role: "user" });
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (u: User) => {
    if (u.username === currentUsername) return toast.error("Cannot delete your own account");
    if (!confirm(`Delete user "${u.username}"?`)) return;
    try {
      const res = await apiFetch(`/users/${u.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      toast.success(`User "${u.username}" deleted`);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleRoleChange = async (u: User, newRole: string) => {
    if (u.username === currentUsername && newRole !== "admin") {
      return toast.error("Cannot remove admin from your own account");
    }
    try {
      const res = await apiFetch(`/users/${u.id}/role`, { method: "PUT", body: JSON.stringify({ role: newRole }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      toast.success(`${u.username} is now ${newRole}`);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  if (!role) return null;
  return (
    <>
      <Navbar />
      <div className="page-root">
        <div className="page-content">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800 }}>User Management</h1>
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{users.length} users • Admin-only page</p>
            </div>
            <button className="btn-primary" onClick={() => setShowModal(true)}>+ Add User</button>
          </div>

          {/* Role legend */}
          <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
            {Object.entries(ROLE_DESC).map(([r, desc]) => (
              <div key={r} style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.8)", borderRadius: 12, padding: "10px 16px", fontSize: 13 }}>
                <span style={{ fontWeight: 700 }}>{ROLE_LABELS[r]}</span>
                <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>{desc}</span>
              </div>
            ))}
          </div>

          {loading ? <p style={{ color: "var(--text-muted)" }}>Loading…</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {users.map(u => (
                <div key={u.id} style={{ background: "rgba(255,255,255,0.65)", border: "1px solid rgba(255,255,255,0.82)", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 15, fontWeight: 700 }}>{u.username}</span>
                      {u.username === currentUsername && <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>(you)</span>}
                      <span className={`pill ${ROLE_PILL[u.role] || "pill-blue"}`} style={{ fontSize: 11 }}>{ROLE_LABELS[u.role] || u.role}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{ROLE_DESC[u.role]}</p>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>ROLE</label>
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u, e.target.value)}
                      className="input-field"
                      style={{ fontSize: 13, padding: "6px 10px", width: "auto" }}
                    >
                      <option value="admin">Admin</option>
                      <option value="staff">Staff</option>
                      <option value="user">User</option>
                    </select>
                    {u.username !== currentUsername && (
                      <button style={{ fontSize: 12, padding: "6px 12px", background: "rgba(220,38,38,0.1)", color: "var(--accent-red)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 8, cursor: "pointer" }} onClick={() => handleDelete(u)}>Delete</button>
                    )}
                  </div>
                </div>
              ))}
              {users.length === 0 && <p style={{ color: "var(--text-muted)", textAlign: "center", padding: 32 }}>No users found</p>}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal-box" style={{ maxWidth: 460 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Add New User</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Username *</label>
                <input className="input-field" style={{ fontSize: 13 }} value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="e.g. ravi_sharma" />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Password *</label>
                <input type="password" className="input-field" style={{ fontSize: 13 }} value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min. 4 characters" />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Role *</label>
                <select className="input-field" style={{ fontSize: 13 }} value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="user">User — view only (Dashboard, Insights, Monthly)</option>
                  <option value="staff">Staff — can add entries in Trips &amp; CRM</option>
                  <option value="admin">Admin — full access</option>
                </select>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>{ROLE_DESC[form.role]}</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
              <button className="btn-ghost" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
              <button className="btn-primary" onClick={handleCreate} disabled={saving}>{saving ? "Creating…" : "Create User"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
