/**
 * Fixes a systematic timezone bug in every legacy-ERP-imported record: the import pipeline
 * wrote timezone-naive date strings (e.g. "2026-07-01T00:00:00"), which Node interpreted as
 * local IST time when converting to UTC for storage — landing every single imported record
 * at exactly 18:30:00 UTC on the *previous* calendar day instead of midnight UTC on the
 * correct day. For receipts dated on the 1st of a month, this pushes them into the wrong
 * month in every server-side report/chart (which aggregates by UTC date).
 *
 * Fix: add 5 hours 30 minutes back to every affected row's date field, correcting it to true
 * midnight UTC on the intended date. Scoped precisely to rows carrying the exact 18:30:00
 * signature AND originating from the import (matched by notes/reason prefix), so organic
 * payments recorded directly through the app are never touched.
 *
 * Run: npx tsx scripts/fix-legacy-import-timezone.ts [--apply]
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);

  // HOUR()/MINUTE()/SECOND() rather than TIME(x) = '18:30:00' — that comparison behaves
  // inconsistently across MySQL/MariaDB versions once the column carries fractional seconds.
  const TIME_MATCH = "HOUR(%COL%) = 18 AND MINUTE(%COL%) = 30 AND SECOND(%COL%) = 0";
  const payments = await prisma.$queryRawUnsafe<{ id: string; paidAt: Date }[]>(
    `SELECT id, paidAt FROM payments WHERE ${TIME_MATCH.replaceAll("%COL%", "paidAt")} AND notes LIKE 'Imported from legacy ERP%'`,
  );
  const students = await prisma.$queryRawUnsafe<{ id: string; createdAt: Date }[]>(
    `SELECT id, createdAt FROM students WHERE ${TIME_MATCH.replaceAll("%COL%", "createdAt")} AND notes LIKE 'Legacy ERP register no%'`,
  );
  const discounts = await prisma.$queryRawUnsafe<{ id: string; createdAt: Date }[]>(
    `SELECT id, createdAt FROM discounts WHERE ${TIME_MATCH.replaceAll("%COL%", "createdAt")} AND reason LIKE 'Imported from legacy ERP%'`,
  );

  console.log(`Payments to fix: ${payments.length}`);
  console.log(`Students to fix: ${students.length}`);
  console.log(`Discounts to fix: ${discounts.length}`);

  if (!apply) return;

  // Bulk statements (single round trip each) rather than one update per row — thousands of
  // sequential round trips over an SSH tunnel is exactly what dropped the connection last time.
  const paymentsFixed = await prisma.$executeRawUnsafe(
    `UPDATE payments SET paidAt = DATE_ADD(paidAt, INTERVAL 330 MINUTE) WHERE ${TIME_MATCH.replaceAll("%COL%", "paidAt")} AND notes LIKE 'Imported from legacy ERP%'`,
  );
  const studentsFixed = await prisma.$executeRawUnsafe(
    `UPDATE students SET createdAt = DATE_ADD(createdAt, INTERVAL 330 MINUTE) WHERE ${TIME_MATCH.replaceAll("%COL%", "createdAt")} AND notes LIKE 'Legacy ERP register no%'`,
  );
  const discountsFixed = await prisma.$executeRawUnsafe(
    `UPDATE discounts SET createdAt = DATE_ADD(createdAt, INTERVAL 330 MINUTE) WHERE ${TIME_MATCH.replaceAll("%COL%", "createdAt")} AND reason LIKE 'Imported from legacy ERP%'`,
  );

  console.log(`Payments fixed: ${paymentsFixed}`);
  console.log(`Students fixed: ${studentsFixed}`);
  console.log(`Discounts fixed: ${discountsFixed}`);
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
