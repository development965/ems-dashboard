import { api } from "@/lib/api";
import type { CreateUserInput, ManagedUser, UpdateUserInput } from "@/types/user";

export async function fetchUsers(): Promise<ManagedUser[]> {
  const { data } = await api.get<{ users: ManagedUser[] }>("/users");
  return data.users;
}

export async function createUser(input: CreateUserInput): Promise<ManagedUser> {
  const { data } = await api.post<{ user: ManagedUser }>("/users", input);
  return data.user;
}

export async function updateUser(userId: string, input: UpdateUserInput): Promise<ManagedUser> {
  const { data } = await api.patch<{ user: ManagedUser }>(`/users/${userId}`, input);
  return data.user;
}

export async function resetUserPassword(userId: string, newPassword: string): Promise<void> {
  await api.post(`/users/${userId}/reset-password`, { newPassword });
}

export async function deleteUser(userId: string): Promise<void> {
  await api.delete(`/users/${userId}`);
}

export async function changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post("/users/me/change-password", { currentPassword, newPassword });
}
