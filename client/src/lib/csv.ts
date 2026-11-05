/** Serializes rows to CSV and triggers a browser download — no server round-trip needed since
 * the data is already fetched and on-screen. */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const lines = [headers, ...rows].map((row) => row.map(escape).join(","));
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
