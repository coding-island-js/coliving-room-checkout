"use client";
import { useState } from "react";
import type { Room } from "@/lib/rooms";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function CheckoutForm({ rooms }: { rooms: Room[] }) {
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...f, acceptedTerms: f.acceptedTerms === "on" }) });
    const data = await res.json();
    if (data.url) window.location.href = data.url; else setError(data.error);
  }
  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
      <select name="roomId" required>{rooms.map((r) => (
        <option key={r.id} value={r.id}>{r.property}: {r.name} (weekly {money(r.rentCents.weekly)}, move-in fee {money(r.moveInFeeCents)})</option>))}
      </select>
      <select name="cadence"><option value="weekly">Weekly</option><option value="biweekly">Every two weeks</option><option value="monthly">Monthly</option></select>
      <input name="moveInDate" type="date" required />
      <input name="name" placeholder="Full name" required />
      <input name="phone" placeholder="Phone" required />
      <input name="email" type="email" placeholder="Email" required />
      <label><input name="acceptedTerms" type="checkbox" /> I accept the member terms. The move-in fee is non-refundable.</label>
      {error && <p role="alert" style={{ color: "#b42318" }}>{error}</p>}
      <button type="submit">Hold my room and pay</button>
    </form>
  );
}
