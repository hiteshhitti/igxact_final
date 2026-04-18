"use client";

import { useState } from "react";

export default function ChangePassword() {
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const handleChange = async () => {
    setMsg("");

    if (!oldPass || !newPass || !confirmPass) {
      setMsg("❌ All fields are required");
      return;
    }

    if (newPass !== confirmPass) {
      setMsg("❌ Passwords do not match");
      return;
    }

    try {
      setLoading(true);

      const token = sessionStorage.getItem("token");

      const res = await fetch(
        process.env.NEXT_PUBLIC_API_URL + "/change-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            old_password: oldPass,
            new_password: newPass,
          }),
        }
      );

      const data = await res.json();

      if (res.ok) {
        setMsg("✅ Password updated successfully");

        // 🔥 auto logout after success
        sessionStorage.removeItem("token");

        setTimeout(() => {
          window.location.href = "/login";
        }, 1500);
      } else {
        setMsg("❌ " + (data.detail || "Something went wrong"));
      }
    } catch (err) {
      setMsg("❌ Server error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="w-full max-w-md bg-[#111] p-6 rounded-xl border border-white/10 space-y-4">

        <h2 className="text-xl font-bold text-center">Change Password 🔐</h2>

        <input
          type="password"
          placeholder="Old Password"
          value={oldPass}
          onChange={(e) => setOldPass(e.target.value)}
          className="w-full p-3 rounded bg-black border border-white/20"
        />

        <input
          type="password"
          placeholder="New Password"
          value={newPass}
          onChange={(e) => setNewPass(e.target.value)}
          className="w-full p-3 rounded bg-black border border-white/20"
        />

        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPass}
          onChange={(e) => setConfirmPass(e.target.value)}
          className="w-full p-3 rounded bg-black border border-white/20"
        />

        <button
          onClick={handleChange}
          disabled={loading}
          className="w-full bg-blue-500 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? "Updating..." : "Update Password"}
        </button>

        {msg && (
          <p className="text-sm text-center">{msg}</p>
        )}

      </div>
    </div>
  );
}