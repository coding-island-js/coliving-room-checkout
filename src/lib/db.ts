import postgres from "postgres";

export const sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {} });

// The only state the site owns besides logins: the reservation hold.
// The partial unique index means a room can have at most one live hold.
export async function ensureSchema() {
  await sql`create table if not exists holds (
    id serial primary key,
    room_id text not null,
    expires_at timestamptz not null,
    stripe_session_id text unique,
    status text not null default 'held' check (status in ('held','converted','released'))
  )`;
  await sql`create unique index if not exists one_live_hold_per_room on holds (room_id) where status = 'held'`;
}

// Rooms with a live hold right now, and when each hold ends. Used to show "Held" on the page.
export async function liveHolds(now = new Date()): Promise<Map<string, Date>> {
  const rows = await sql`select room_id, expires_at from holds where status = 'held' and expires_at > ${now}`;
  return new Map(rows.map((r) => [r.room_id as string, new Date(r.expires_at)]));
}
