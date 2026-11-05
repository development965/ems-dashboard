/**
 * One-off: creates (or resets the password on) a dedicated ACCOUNTANT-role account for the
 * distributed CFO revenue-dashboard package — company-wide read access to branches/students/
 * payments/discounts, but none of a Super Admin's power (no user/branch management, no DB
 * backup download). Generates a random password and writes it ONLY to the local output file
 * given as argv[2]; never prints it to stdout.
 *
 * Run: npx tsx scripts/create-readonly-service-account.ts <output-file-path>
 */
import fs from "node:fs";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@/utils/password.js";

const prisma = new PrismaClient();

const EMAIL = "cfo-dashboard@techmaax.com";
const NAME = "CFO Revenue Dashboard (automated)";

async function main() {
  const outPath = process.argv[2];
  if (!outPath) throw new Error("Usage: create-readonly-service-account.ts <output-file-path>");

  const password = crypto.randomBytes(24).toString("base64url");
  const passwordHash = await hashPassword(password);

  const company = await prisma.company.findFirstOrThrow();

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash, isActive: true, role: "ACCOUNTANT" },
    create: {
      companyId: company.id,
      name: NAME,
      email: EMAIL,
      passwordHash,
      role: "ACCOUNTANT",
      isActive: true,
    },
  });

  fs.writeFileSync(outPath, `EMS_URL=https://ems.techmaax.com\nEMS_EMAIL=${EMAIL}\nEMS_PASSWORD=${password}\n`, {
    mode: 0o600,
  });
  console.log(`Service account ready: ${user.email} (id ${user.id}). Password written to ${outPath}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
