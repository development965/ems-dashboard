import { prisma } from "@/config/prisma.js";
import { ConflictError, NotFoundError } from "@/utils/AppError.js";
import { toMoney } from "@/utils/money.js";
import { logAudit } from "@/utils/audit.js";
import type { AuthUser } from "@/types/express.js";
import type { Course, CourseFeeStructure } from "@prisma/client";
import type {
  CreateCourseInput,
  CreateFeeStructureInput,
  UpdateCourseInput,
  UpdateFeeStructureInput,
} from "@/modules/courses/courses.schema.js";

function serializeCourse(course: Course & { feeStructures: CourseFeeStructure[] }) {
  return {
    ...course,
    feeStructures: course.feeStructures.map((fee) => ({ ...fee, amount: toMoney(fee.amount) })),
  };
}

export async function listCourses(user: AuthUser) {
  const courses = await prisma.course.findMany({
    where: { companyId: user.companyId },
    include: { feeStructures: { orderBy: { mode: "asc" } } },
    orderBy: { name: "asc" },
  });
  return courses.map(serializeCourse);
}

export async function getCourse(user: AuthUser, courseId: string) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, companyId: user.companyId },
    include: { feeStructures: { orderBy: { mode: "asc" } } },
  });
  if (!course) throw new NotFoundError("Course not found");
  return serializeCourse(course);
}

export async function createCourse(user: AuthUser, input: CreateCourseInput) {
  const course = await prisma.course.create({ data: { ...input, companyId: user.companyId } });
  return serializeCourse({ ...course, feeStructures: [] });
}

export async function updateCourse(user: AuthUser, courseId: string, input: UpdateCourseInput) {
  await getCourse(user, courseId);
  const course = await prisma.course.update({
    where: { id: courseId },
    data: input,
    include: { feeStructures: { orderBy: { mode: "asc" } } },
  });
  return serializeCourse(course);
}

/** Blocked once any student has ever enrolled in this course — deactivate it instead
 * (via updateCourse's isActive) to hide it from new enrollments without losing history. */
export async function deleteCourse(user: AuthUser, courseId: string) {
  const course = await getCourse(user, courseId);

  const enrolledCount = await prisma.student.count({ where: { courseId } });
  if (enrolledCount > 0) {
    throw new ConflictError(
      `Can't delete "${course.name}" — ${enrolledCount} student${enrolledCount === 1 ? " is" : "s are"} enrolled in it. Deactivate it instead to hide it from new enrollments.`,
    );
  }

  await prisma.course.delete({ where: { id: courseId } });

  await logAudit({
    actor: user,
    action: "course.delete",
    entityType: "Course",
    entityId: courseId,
    summary: `Deleted course ${course.name} (${course.code})`,
  });
}

export async function addFeeStructure(user: AuthUser, courseId: string, input: CreateFeeStructureInput) {
  await getCourse(user, courseId);
  const fee = await prisma.courseFeeStructure.create({ data: { ...input, courseId } });
  return { ...fee, amount: toMoney(fee.amount) };
}

export async function updateFeeStructure(
  user: AuthUser,
  courseId: string,
  feeStructureId: string,
  input: UpdateFeeStructureInput,
) {
  await getCourse(user, courseId);
  const existing = await prisma.courseFeeStructure.findFirst({ where: { id: feeStructureId, courseId } });
  if (!existing) throw new NotFoundError("Fee structure not found");

  const fee = await prisma.courseFeeStructure.update({ where: { id: feeStructureId }, data: input });
  return { ...fee, amount: toMoney(fee.amount) };
}

export async function deleteFeeStructure(user: AuthUser, courseId: string, feeStructureId: string) {
  await getCourse(user, courseId);
  const existing = await prisma.courseFeeStructure.findFirst({ where: { id: feeStructureId, courseId } });
  if (!existing) throw new NotFoundError("Fee structure not found");
  await prisma.courseFeeStructure.delete({ where: { id: feeStructureId } });
}
