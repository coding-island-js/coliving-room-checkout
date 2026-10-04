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
