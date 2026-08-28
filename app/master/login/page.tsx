"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MasterLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/master/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Login failed.");
      router.push("/master");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <h1>Master Control</h1>
      <p className="note">Password-protected shop editor. Same idea as Repair Status — no code, no deploy.</p>
      <form className="form" onSubmit={onSubmit}>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        <button className="btn" disabled={busy} type="submit">
          {busy ? "Opening…" : "Open Master Control"}
        </button>
        {error ? <p className="err">{error}</p> : null}
      </form>
    </div>
  );
}
