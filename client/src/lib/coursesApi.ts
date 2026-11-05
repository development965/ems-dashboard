import { api } from "@/lib/api";
import type { Course, CreateCourseInput, CreateFeeStructureInput, FeeStructure } from "@/types/course";

export async function fetchCourses(): Promise<Course[]> {
  const { data } = await api.get<{ courses: Course[] }>("/courses");
  return data.courses;
}

export async function createCourse(input: CreateCourseInput): Promise<Course> {
  const { data } = await api.post<{ course: Course }>("/courses", input);
  return data.course;
}

export async function deleteCourse(courseId: string): Promise<void> {
  await api.delete(`/courses/${courseId}`);
}

export async function addFeeStructure(courseId: string, input: CreateFeeStructureInput): Promise<FeeStructure> {
  const { data } = await api.post<{ feeStructure: FeeStructure }>(`/courses/${courseId}/fee-structures`, input);
  return data.feeStructure;
}

export async function updateFeeStructure(
  courseId: string,
  feeId: string,
  input: Partial<CreateFeeStructureInput>,
): Promise<FeeStructure> {
  const { data } = await api.patch<{ feeStructure: FeeStructure }>(`/courses/${courseId}/fee-structures/${feeId}`, input);
  return data.feeStructure;
}

export async function deleteFeeStructure(courseId: string, feeId: string): Promise<void> {
  await api.delete(`/courses/${courseId}/fee-structures/${feeId}`);
}
