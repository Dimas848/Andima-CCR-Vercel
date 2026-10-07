// lib/dateUtils.ts

export const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

export const SHORT_MONTH_NAMES_ID = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
];

/**
 * 1. Mengambil Periode Bulan & Tahun Saat Ini (contoh: "Oktober 2026")
 * offsetMonths = 0 (Bulan ini), 1 (Bulan lalu), 2 (2 bulan lalu)
 */
export function getCurrentPeriod(offsetMonths = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() - offsetMonths);
  return `${MONTH_NAMES_ID[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * 2. Membuat Opsi Dropdown Periode Otomatis (Bulan ini, bulan lalu, dst.)
 */
export function getDynamicPeriodOptions(count = 4): { value: string; label: string }[] {
  return Array.from({ length: count }, (_, i) => {
    const period = getCurrentPeriod(i);
    return { value: period, label: period };
  });
}

/**
 * 3. Format Tanggal & Jam Live Saat Ini (contoh: "07 Okt 2026 · 14:30")
 */
export function formatLiveDateTime(date: Date = new Date(), minusMinutes = 0): string {
  const target = new Date(date.getTime() - minusMinutes * 60 * 1000);
  const day = String(target.getDate()).padStart(2, "0");
  const month = SHORT_MONTH_NAMES_ID[target.getMonth()];
  const year = target.getFullYear();
  const hours = String(target.getHours()).padStart(2, "0");
  const minutes = String(target.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} · ${hours}:${minutes}`;
}