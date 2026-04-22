"use client";

import { useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!username || !password) {
      setError("Please enter your credentials.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        process.env.NEXT_PUBLIC_API_URL + "/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        }
      );

      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = null; }

      if (res.ok && data?.access_token) {
        sessionStorage.setItem("token", data.access_token);
        sessionStorage.setItem("role", data.role);
        window.location.href = "/";
      } else {
        setError(data?.detail || "Invalid credentials. Please try again.");
      }
    } catch {
      setError("Connection failed. Please check your network.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg-base)",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* Background glow orbs */}
      <div style={{
        position: "absolute", top: "20%", left: "30%",
        width: 400, height: 400, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(37,99,235,0.10) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "20%", right: "25%",
        width: 300, height: 300, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(124,58,237,0.07) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Grid texture */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        pointerEvents: "none",
      }} />

      {/* Card */}
      <div style={{
        width: "100%",
        maxWidth: 400,
        padding: "40px 36px",
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(24px)",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 24,
        boxShadow: "0 32px 80px rgba(0,0,0,0.12), 0 0 0 1px rgba(37,99,235,0.05)",
        position: "relative",
        zIndex: 1,
        animation: "pageEnter 0.5s cubic-bezier(0.4,0,0.2,1) forwards",
      }}>

        {/* Logo mark */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
            boxShadow: "0 8px 32px rgba(37,99,235,0.30)",
            fontSize: 22, fontWeight: 800,
            fontFamily: "var(--font-display)",
            color: "#fff",
          }}>
            IG
          </div>
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: 22, fontWeight: 800,
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
            marginBottom: 6,
          }}>
            Welcome back
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            Sign in to your travel dashboard
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.25)",
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 20,
            fontSize: 13,
            color: "var(--accent-red)",
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
              Username
            </label>
            <input
              className="input-field"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
              Password
            </label>
            <input
              className="input-field"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>

          <button
            className="btn-primary"
            onClick={handleLogin}
            disabled={loading}
            style={{
              marginTop: 8,
              padding: "12px",
              fontSize: 15,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 0.8s linear infinite" }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Signing in…
              </span>
            ) : "Sign in"}
          </button>
        </div>

        <p style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: "var(--text-muted)" }}>
          IGXact Travel Dashboard · Secure access
        </p>
      </div>

      <style>{`
        @keyframes pageEnter {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
