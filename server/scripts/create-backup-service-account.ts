/**
 * One-off: creates (or resets the password on) a dedicated SUPER_ADMIN account used only
 * by the local daily-backup script — keeps the real admin's personal password out of any
 * script/config file on disk. Generates a random password and writes it ONLY to the local
 * output file given as argv[2]; never prints it to stdout.
 *
 * Run: npx tsx scripts/create-backup-service-account.ts <output-file-path>
 */
import fs from "node:fs";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@/utils/password.js";

const prisma = new PrismaClient();

const EMAIL = "backup-agent@techmaax.com";
const NAME = "Backup Agent (automated)";

async function main() {
  const outPath = process.argv[2];
  if (!outPath) throw new Error("Usage: create-backup-service-account.ts <output-file-path>");

  const password = crypto.randomBytes(24).toString("base64url");
  const passwordHash = await hashPassword(password);

  const company = await prisma.company.findFirstOrThrow();

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash, isActive: true, role: "SUPER_ADMIN" },
    create: {
      companyId: company.id,
      name: NAME,
      email: EMAIL,
      passwordHash,
      role: "SUPER_ADMIN",
      isActive: true,
    },
  });

  fs.writeFileSync(outPath, `EMS_BACKUP_EMAIL=${EMAIL}\nEMS_BACKUP_PASSWORD=${password}\n`, { mode: 0o600 });
  console.log(`Service account ready: ${user.email} (id ${user.id}). Password written to ${outPath}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
