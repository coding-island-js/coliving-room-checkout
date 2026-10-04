"use client";
import { useEffect, useState } from "react";
import type { Cadence, Room } from "@/lib/rooms";

export type RoomView = Room & { minutesLeft: number };

const money = (c: number) =>
  `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

const CADENCES: { value: Cadence; label: string; first: string }[] = [
  { value: "weekly", label: "Weekly", first: "First week of rent" },
  { value: "biweekly", label: "Every 2 weeks", first: "First 2 weeks of rent" },
  { value: "monthly", label: "Monthly", first: "First month of rent" },
];

type Props = { rooms: RoomView[]; earliestDate: string; sameDayOpen: boolean; leftHoldId: string };

const isOpen = (r: RoomView) => r.status === "VACANT" && r.minutesLeft === 0;

export default function CheckoutForm({ rooms, earliestDate, sameDayOpen, leftHoldId }: Props) {
  const [roomId, setRoomId] = useState(rooms.find(isOpen)?.id ?? "");
  const [cadence, setCadence] = useState<Cadence>("weekly");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Back from Stripe without paying: free the room right away instead of waiting out the hold.
  useEffect(() => {
    if (!leftHoldId) return;
    fetch("/api/holds/release", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ holdId: leftHoldId }),
    })
      .catch(() => null)
      .finally(() => window.location.replace("/?released=1"));
  }, [leftHoldId]);

  const room = rooms.find((r) => r.id === roomId);
  const rent = room ? room.rentCents[cadence] : 0;
  const cad = CADENCES.find((c) => c.value === cadence)!;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = Object.fromEntries(new FormData(e.currentTarget));
    if (!roomId) return setError("Pick a room first.");
    setBusy(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...f, roomId, cadence, acceptedTerms: f.acceptedTerms === "on" }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("Could not reach the server. Please try again.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="form" noValidate>
      <fieldset>
        <legend>1. Pick a room</legend>
        <div className="rooms">
          {rooms.map((r) => {
            const open = isOpen(r);
            const held = r.status === "VACANT" && r.minutesLeft > 0;
            return (
              <label key={r.id} className={`room${open ? "" : " off"}${r.id === roomId ? " picked" : ""}`}>
                <input type="radio" name="room" value={r.id} checked={r.id === roomId} disabled={!open} onChange={() => setRoomId(r.id)} />
                <span className="room-body">
                  <span className="room-top">
                    <span className="room-house">{r.property}</span>
                    {r.status !== "VACANT" ? (
                      <span className="tag taken">Taken</span>
                    ) : held ? (
                      <span className="tag held">Held for 45 minutes</span>
                    ) : (
                      <span className="tag free">Available</span>
                    )}
                  </span>
                  <span className="room-name">{r.name}</span>
                  <span className="room-price">
                    {money(r.rentCents.weekly)} a week · {money(r.moveInFeeCents)} move-in fee
                  </span>
                  {held && (
                    <span className="room-note">
                      Another member is paying for this room. If they do not finish, it opens again in {r.minutesLeft}{" "}
                      {r.minutesLeft === 1 ? "minute" : "minutes"}.
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend>2. How often you pay rent</legend>
        <div className="cadences">
          {CADENCES.map((c) => (
            <label key={c.value} className={`cadence${c.value === cadence ? " picked" : ""}`}>
              <input type="radio" name="cadenceChoice" value={c.value} checked={c.value === cadence} onChange={() => setCadence(c.value)} />
              <span className="cadence-label">{c.label}</span>
              {room && <span className="cadence-price">{money(room.rentCents[c.value])}</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>3. Your details</legend>
        <label className="field">
          Move-in date
          <input name="moveInDate" type="date" min={earliestDate} defaultValue={earliestDate} required />
          <span className="hint">
            {sameDayOpen
              ? "Same-day move-in is open until 7 PM Dallas time."
              : "It is past 7 PM in Dallas, so the earliest move-in is tomorrow."}
          </span>
        </label>
        <label className="field">
          Full name
          <input name="name" autoComplete="name" required />
        </label>
        <label className="field">
          Phone
          <input name="phone" type="tel" autoComplete="tel" inputMode="tel" required />
        </label>
        <label className="field">
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label className="check">
          <input name="acceptedTerms" type="checkbox" />
          <span>I accept the member terms. I understand the move-in fee is non-refundable.</span>
        </label>
      </fieldset>

      {room && (
        <div className="total">
          <div>
            <span>Move-in fee, paid once</span>
            <span>{money(room.moveInFeeCents)}</span>
          </div>
          <div>
            <span>{cad.first}</span>
            <span>{money(rent)}</span>
          </div>
          <div className="sum">
            <span>Due today</span>
            <span>{money(room.moveInFeeCents + rent)}</span>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button type="submit" className="cta" disabled={busy || !room}>
        {busy ? "Holding your room…" : "Hold my room and pay"}
      </button>
      {!room && <p className="hint center">Every room is taken or on hold right now. Check back soon.</p>}
    </form>
  );
}
