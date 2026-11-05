import { api } from "@/lib/api";
import type { FeeReminderRecord, ReminderChannel, StudentNeedingReminder } from "@/types/feeReminder";

export async function fetchStudentsNeedingReminders(branchId?: string): Promise<StudentNeedingReminder[]> {
  const { data } = await api.get<{ students: StudentNeedingReminder[] }>("/fee-reminders", {
    params: branchId ? { branchId } : undefined,
  });
  return data.students;
}

export async function createFeeReminder(input: {
  studentId: string;
  channel: ReminderChannel;
  notes?: string;
}): Promise<void> {
  await api.post("/fee-reminders", input);
}

export async function fetchReminderHistory(studentId: string): Promise<FeeReminderRecord[]> {
  const { data } = await api.get<{ reminders: FeeReminderRecord[] }>(`/fee-reminders/student/${studentId}`);
  return data.reminders;
}
