import { spawn } from "node:child_process";
import type { Response } from "express";
import { env } from "@/config/env.js";

function parseDbUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port || "3306",
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
  };
}

export function backupFilename(): string {
  return `techmaax-ems-backup-${new Date().toISOString().slice(0, 10)}.sql`;
}

/**
 * Streams a full `mysqldump` of the working database straight to the response — never written
 * to disk. `--single-transaction` gets a consistent InnoDB snapshot without locking tables;
 * the DB password is passed via MYSQL_PWD (an env var), never as a CLI argument, so it can't
 * leak through `ps`.
 */
export function streamDatabaseBackup(res: Response): Promise<void> {
  const { host, port, user, password, database } = parseDbUrl(env.DATABASE_URL);

  res.setHeader("Content-Type", "application/sql");
  res.setHeader("Content-Disposition", `attachment; filename="${backupFilename()}"`);

  return new Promise((resolve, reject) => {
    const dump = spawn(
      "mysqldump",
      [
        "-h", host,
        "-P", port,
        "-u", user,
        "--single-transaction",
        "--no-tablespaces",
        "--routines",
        "--triggers",
        database,
      ],
      { env: { ...process.env, MYSQL_PWD: password } },
    );

    let stderr = "";
    dump.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    dump.stdout.pipe(res);

    dump.on("error", reject);
    dump.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`mysqldump exited with code ${code}: ${stderr}`));
    });
  });
}
