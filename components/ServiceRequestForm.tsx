"use client";

import { useState } from "react";
import { CONTACT_PREFERENCES, SERVICE_NEEDS } from "@/lib/service-lead";

export function ServiceRequestForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    const form = e.currentTarget;
    const photos = (form.elements.namedItem("photos") as HTMLInputElement | null)?.files;
    if (photos && photos.length > 3) {
      setStatus("err");
      setMessage("Send up to 3 photos.");
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/service-request", { method: "POST", body: new FormData(form) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not send.");
      setStatus("ok");
      setMessage("Got it — I'll reply with next steps.");
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
        <select name="serviceType" required defaultValue="">
          <option value="" disabled>
            Choose one
          </option>
          {SERVICE_NEEDS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Description
        <textarea name="description" required maxLength={4000} placeholder="What should it do, and what is wrong with the part you have?" />
      </label>
      <label>
        Fit notes
        <textarea name="fitNotes" maxLength={4000} placeholder="Bolt pattern, shaft size, how it mounts, what it has to clear." />
      </label>
      <label>
        Approx size
        <input name="approxSize" maxLength={160} placeholder="About 4 in wide, or the size of the broken piece" />
      </label>
      <label>
        Photos (up to 3)
        <input name="photos" type="file" accept="image/*" multiple />
      </label>
      <label>
        Preferred contact
        <select name="preferredContact" defaultValue="">
          <option value="">No preference</option>
          {CONTACT_PREFERENCES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <button className="btn btn-bronze" type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Send request"}
      </button>
      {message ? <p className={status === "ok" ? "ok" : "err"}>{message}</p> : null}
    </form>
  );
}
