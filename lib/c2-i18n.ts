"use client";

import { useCallback, useEffect, useState } from "react";

export type Lang = "id" | "en";

const STORAGE_KEY = "andima-c2-lang";
const EVENT_NAME = "andima-c2-lang-change";

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function useLang() {
  const [lang, setLangState] = useState<Lang>("id");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "id") {
        setLangState(saved);
      }
    } catch {
      // Abaikan jika storage tidak tersedia
    }

    const handleCustom = (event: Event) => {
      const next = (event as CustomEvent<Lang>).detail;
      if (next === "en" || next === "id") setLangState(next);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && (event.newValue === "en" || event.newValue === "id")) {
        setLangState(event.newValue);
      }
    };

    window.addEventListener(EVENT_NAME, handleCustom);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, handleCustom);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Abaikan jika storage tidak tersedia
    }
    window.dispatchEvent(new CustomEvent<Lang>(EVENT_NAME, { detail: next }));
  }, []);

  return { lang, setLang, isEn: lang === "en" };
}

/** Menampilkan label bulan dalam ID/EN tanpa mengubah nilai periode asli ke API. */
export function formatPeriodLabel(period: string, lang: Lang): string {
  if (!period) return "";
  const parts = period.trim().split(" ");
  if (parts.length !== 2) return period;
  const [month, year] = parts;
  const idIdx = MONTHS_ID.findIndex((m) => m.toLowerCase() === month.toLowerCase());
  const enIdx = MONTHS_EN.findIndex((m) => m.toLowerCase() === month.toLowerCase());
  const idx = idIdx >= 0 ? idIdx : enIdx;
  if (idx < 0) return period;
  return `${lang === "en" ? MONTHS_EN[idx] : MONTHS_ID[idx]} ${year}`;
}

export function formatTimestamp(value: string | null | undefined, lang: Lang): string {
  if (!value || !Number.isFinite(Date.parse(value))) {
    return lang === "en" ? "Not recorded" : "Belum tercatat";
  }
  const locale = lang === "en" ? "en-GB" : "id-ID";
  return `${new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value))} WIB`;
}