import { api } from "@/lib/api";

/** Streams the full DB dump and triggers a browser download — needs the auth header, so a
 * plain <a href> won't work; fetch it as a blob and download it ourselves instead. */
export async function downloadBackup(): Promise<void> {
  const { data, headers } = await api.get<Blob>("/backup/download", { responseType: "blob" });

  const disposition = headers["content-disposition"] as string | undefined;
  const filenameMatch = disposition?.match(/filename="(.+)"/);
  const filename = filenameMatch?.[1] ?? `techmaax-ems-backup-${new Date().toISOString().slice(0, 10)}.sql`;

  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
