// Helper bersama untuk membersihkan nama dari data mentah.
// Tidak lagi mengisi nama perusahaan karangan: nilai tidak valid menjadi "Tanpa Nama".
// Parameter kedua dipertahankan hanya agar pemanggil lama cleanCustomerName(x, idx) tetap valid.
export function cleanCustomerName(
  raw: unknown,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _index = 0
): string {
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    return cleanCustomerName(o.text ?? o.name ?? o.label ?? o.result ?? "");
  }

  const str = String(raw ?? "").trim();
  const lower = str.toLowerCase();
  const invalid =
    !str ||
    str === "-" ||
    lower === "web url" ||
    lower === "web_url" ||
    lower === "null" ||
    lower === "undefined" ||
    lower.includes("[object object]") ||
    lower.startsWith("http");

  if (invalid) throw new Error("Nama perusahaan sumber tidak valid.");
  return str;
}
