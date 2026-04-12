"use client";

import { useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
  try {
    const res = await fetch(
      process.env.NEXT_PUBLIC_API_URL + "/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      }
    );

    console.log("STATUS:", res.status);

    const text = await res.text(); // 👈 raw response
    console.log("RAW RESPONSE:", text);

    let data;
    try {
      data = JSON.parse(text); // 👈 manual parse
    } catch {
      data = null;
    }

    console.log("PARSED RESPONSE:", data);

    if (res.ok && data?.access_token) {
      sessionStorage.setItem("token", data.access_token);

      window.location.href = "/";
    } else {
      console.error("LOGIN FAILED:", data);
      alert(data?.detail || "Login failed");
    }

  } catch (err) {
    console.error("LOGIN ERROR:", err);
  }
};

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="bg-white/10 p-8 rounded-xl w-80">
        <h2 className="text-xl mb-4">🔐 Login</h2>

        <input
          placeholder="Username"
          className="w-full mb-3 p-2 bg-black border border-white/20"
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full mb-3 p-2 bg-black border border-white/20"
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 p-2 rounded"
        >
          Login
        </button>
      </div>
    </div>
  );
}