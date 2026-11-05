/**
 * One-off: BLESSY MERLIN D genuinely has two identical ₹1,000 receipts on the same date
 * (20.Jun.2026, SAP-FICO) — the content-based dedup key (notes+amount) treats them as one,
 * so the second was silently skipped during the gap-fill sync. Adds it back directly.
 *
 * Run: npx tsx scripts/add-blessy-duplicate-receipt.ts [--apply]
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const STUDENT_ID = "cmsn61euz03m12xyqkbjen5ig";

async function main() {
  const apply = process.argv.includes("--apply");

  const student = await prisma.student.findUniqueOrThrow({ where: { id: STUDENT_ID } });
  const existingCount = await prisma.payment.count({
    where: { studentId: STUDENT_ID, amount: 1000, notes: { contains: "20.Jun.2026" } },
  });
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } });

  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`Student: ${student.name}, existing ₹1,000 receipts dated 20.Jun.2026: ${existingCount}`);

  if (!apply) return;

  const payment = await prisma.payment.create({
    data: {
      companyId: student.companyId,
      branchId: student.branchId,
      studentId: student.id,
      amount: 1000,
      method: "OTHER",
      paidAt: new Date("2026-06-20T00:00:00+05:30"),
      recordedById: admin.id,
      notes: "Imported from legacy ERP — receipt 20.Jun.2026, via Paytm (duplicate receipt, added manually after gap-fill reconciliation)",
    },
  });
  console.log("Created payment:", payment.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
