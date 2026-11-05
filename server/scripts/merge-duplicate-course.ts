/**
 * One-off: re-points students/leads off the empty "SAP FICO" duplicate course onto the
 * canonical "SAP - FICO" course before the duplicate gets deleted. Safe/idempotent — only
 * touches rows still pointing at the duplicate.
 *
 * Run: npx tsx scripts/merge-duplicate-course.ts [--apply]
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DUPLICATE_COURSE_ID = "cmsbrzcg400072xryz8bckmgo";
const CANONICAL_COURSE_ID = "cmsn61aya002j2xyq5kkv2cjz";

async function main() {
  const apply = process.argv.includes("--apply");

  const students = await prisma.student.findMany({ where: { courseId: DUPLICATE_COURSE_ID }, select: { id: true, name: true, phone: true } });
  const leads = await prisma.lead.findMany({ where: { interestedCourseId: DUPLICATE_COURSE_ID }, select: { id: true, name: true, phone: true } });

  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`Students to move: ${students.length}`, students);
  console.log(`Leads to move: ${leads.length}`, leads);

  if (apply) {
    const s = await prisma.student.updateMany({ where: { courseId: DUPLICATE_COURSE_ID }, data: { courseId: CANONICAL_COURSE_ID } });
    const l = await prisma.lead.updateMany({ where: { interestedCourseId: DUPLICATE_COURSE_ID }, data: { interestedCourseId: CANONICAL_COURSE_ID } });
    console.log(`Updated ${s.count} students, ${l.count} leads.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
