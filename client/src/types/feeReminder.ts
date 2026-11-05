export type ReminderChannel = "WHATSAPP" | "CALL" | "SMS" | "EMAIL" | "OTHER";

export interface StudentNeedingReminder {
  studentId: string;
  studentName: string;
  phone: string;
  branchId: string;
  branchName: string;
  courseName: string;
  balanceDue: number;
  enrolledAt: string;
  lastReminderAt: string | null;
  lastReminderChannel: ReminderChannel | null;
}

export interface FeeReminderRecord {
  id: string;
  studentId: string;
  channel: ReminderChannel;
  notes: string | null;
  createdAt: string;
  sentBy: { id: string; name: string };
}
