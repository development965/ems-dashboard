import { api } from "@/lib/api";
import type { CreateStudentInput, Student, UpdateStudentInput } from "@/types/student";

export async function fetchStudents(search?: string): Promise<Student[]> {
  const { data } = await api.get<{ students: Student[] }>("/students", { params: search ? { search } : undefined });
  return data.students;
}

export async function fetchStudent(id: string): Promise<Student> {
  const { data } = await api.get<{ student: Student }>(`/students/${id}`);
  return data.student;
}

export async function createStudent(input: CreateStudentInput): Promise<Student> {
  const { data } = await api.post<{ student: Student }>("/students", input);
  return data.student;
}

export async function updateStudent(id: string, input: UpdateStudentInput): Promise<Student> {
  const { data } = await api.patch<{ student: Student }>(`/students/${id}`, input);
  return data.student;
}

export async function uploadStudentDocuments(
  id: string,
  files: { photo?: File; idProof?: File },
): Promise<Student> {
  const formData = new FormData();
  if (files.photo) formData.append("photo", files.photo);
  if (files.idProof) formData.append("idProof", files.idProof);

  const { data } = await api.post<{ student: Student }>(`/students/${id}/documents`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.student;
}
