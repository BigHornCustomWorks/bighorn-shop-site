"use client";

import { useState } from "react";

export function QuoteForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");
    const form = e.currentTarget;
    const data = new FormData(form);
    try {
      const res = await fetch("/api/quote", { method: "POST", body: data });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not send.");
      setStatus("ok");
      setMessage("Got it. Clint will get back to you from the shop.");
      form.reset();
    } catch (err) {
      setStatus("err");
      setMessage(err instanceof Error ? err.message : "Could not send. Email bighorncustomworks@gmail.com.");
    }
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <label>
        Name
        <input name="name" required maxLength={120} autoComplete="name" />
      </label>
      <label>
        Email
        <input name="email" type="email" required maxLength={160} autoComplete="email" />
      </label>
      <label>
        Phone
        <input name="phone" type="tel" maxLength={40} autoComplete="tel" />
      </label>
      <label>
        What do you need?
        <textarea name="need" required maxLength={4000} placeholder="One-off part, mill upgrade, fab, repair, or an app the floor actually needs." />
      </label>
      <label>
        Photo (optional)
        <input name="photo" type="file" accept="image/*" />
      </label>
      <button className="btn" type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Send quote request"}
      </button>
      {message ? <p className={status === "ok" ? "ok" : "err"}>{message}</p> : null}
    </form>
  );
}
