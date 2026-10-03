/**
 * Starts the local portable PostgreSQL 16 server (no install, no admin).
 * Binaries: %LOCALAPPDATA%/braingrow-pg/dist | Data: %LOCALAPPDATA%/braingrow-pg/data
 * Listens on 127.0.0.1:5433, database `braingrow`, user `postgres` (trust auth, loopback only).
 * Idempotent — exits 0 if the server is already up.
 */
import { spawnSync } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const PORT = Number(process.env.PGPORT || 5433);
const BASE = path.join(os.homedir(), "AppData", "Local", "braingrow-pg");
const BIN = path.join(BASE, "dist", "pgsql", "bin", "pg_ctl.exe");
const DATA = path.join(BASE, "data");

function portUp() {
  return new Promise((resolve) => {
    const s = net.connect(PORT, "127.0.0.1");
    s.on("connect", () => {
      s.end();
      resolve(true);
    });
    s.on("error", () => resolve(false));
  });
}

const up = await portUp();
if (up) {
  console.log(`Postgres already running on 127.0.0.1:${PORT}`);
  process.exit(0);
}

const r = spawnSync(BIN, ["-D", DATA, "-l", path.join(DATA, "logfile"), "-o", `-p ${PORT}`, "-w", "start"], {
  stdio: "inherit",
});
if (r.status !== 0) {
  console.error(`pg_ctl start failed (exit ${r.status}). Is another instance running, or was the data dir removed?`);
  process.exit(1);
}
console.log(`Postgres started on 127.0.0.1:${PORT}`);
