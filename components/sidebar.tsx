"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { ChevronDown, Menu, Wallet, X } from "lucide-react";
import { useLang } from "@/lib/c2-i18n";

type SidebarProps = {
  userName?: string;
  userRole?: string;
  userInitials?: string;
  onSignOut?: () => void;
  isSigningOut?: boolean;
};

type Account = { name: string; role: string; initials: string };

const MENU_ITEMS: { href: string; id: string; en: string }[] = [
  { href: "/dashboard", id: "Dasbor", en: "Dashboard" },
  { href: "/data-upload", id: "Unggah Data", en: "Data Upload" },
  { href: "/customer-cost", id: "Biaya Pelanggan", en: "Customer Cost" },
  { href: "/tax-tracing", id: "Pelacakan Komponen Pajak", en: "Tax Component Tracing" },
  { href: "/evidence", id: "Bukti Dokumen", en: "Evidence" },
  { href: "/monthly-closing", id: "Validasi", en: "Validation" },
  { href: "/export-report", id: "Laporan", en: "Report" },
];

function HrmsLink({ label, href }: { label: string; href: string }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs transition-colors ${
        isActive ? "bg-[#B0C6D4] font-bold text-[#0f2324]" : "text-[#d9e2fc]/80 hover:bg-[#1e3765] hover:text-white"
      }`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isActive ? "bg-emerald-500" : "bg-[#d9e2fc]/50"}`} />
      <span>{label}</span>
    </Link>
  );
}

export default function Sidebar({
  userName,
  userRole,
  userInitials,
  onSignOut,
  isSigningOut = false,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, setLang, isEn } = useLang();
  const isPublicRoute = pathname === "/login" || pathname === "/register" || pathname.startsWith("/auth/");

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isC2Route = [
    "/dashboard",
    "/data-upload",
    "/customer-cost",
    "/tax-tracing",
    "/cost-exception",
    "/priority-exception",
    "/evidence",
    "/monthly-closing",
    "/export-report",
  ].some((route) => pathname === route || pathname.startsWith(`${route}/`));

  const [isCcrOpen, setIsCcrOpen] = useState(true);
  const [isInternalSigningOut, setIsInternalSigningOut] = useState(false);
  const [loadedAccount, setLoadedAccount] = useState<Account | null>(null);

  const fallbackAccount: Account = {
    name: isEn ? "Profile not loaded" : "Profil belum dimuat",
    role: "",
    initials: "—",
  };
  const hasSuppliedAccount = Boolean(userName && userRole && userInitials);
  const suppliedAccount = hasSuppliedAccount ? { name: userName!, role: userRole!, initials: userInitials! } : null;
  const account = suppliedAccount ?? loadedAccount ?? fallbackAccount;

  const matchedItem = MENU_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const currentPageTitle = matchedItem ? matchedItem[lang] : isEn ? "CCR Module" : "Modul CCR";

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("andima-sidebar-collapse", { detail: isCollapsed }));
  }, [isCollapsed]);

  function toggleCollapse() {
    setIsCollapsed((prev) => !prev);
  }

  useEffect(() => {
    if (isPublicRoute || hasSuppliedAccount) return;
    let isMounted = true;
    async function loadAccount() {
      try {
        if (isC2Route) {
          const response = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
          const result = await response.json();
          if (!response.ok || !result.success) {
            if (isMounted) setLoadedAccount({ name: "Sesi/peran perlu diperiksa", role: "", initials: "—" });
            return;
          }
          const name = String(result.data.name);
          if (isMounted) {
            setLoadedAccount({
              name,
              role: String(result.data.role),
              initials: name.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase(),
            });
          }
          return;
        }
        const supabase = createClient();
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        if (!user || !isMounted) return;

        const { data: access } = await supabase
          .from("d3_user_access")
          .select("app_role, d3_employee!d3_user_access_employee_id_fkey(full_name)")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        const accountAccess = access as unknown as {
          app_role: string | null;
          d3_employee: { full_name: string } | null;
        } | null;

        const metadataName = user.user_metadata?.full_name;
        const registeredName =
          typeof metadataName === "string" && metadataName.trim()
            ? metadataName.trim()
            : user.email?.split("@")[0] ?? "Andima User";

        const name = accountAccess?.d3_employee?.full_name?.trim() || registeredName;
        const role =
          accountAccess?.app_role === "HR"
            ? "HR"
            : accountAccess?.app_role === "MANAGER"
            ? "Manager"
            : accountAccess?.app_role === "EMPLOYEE"
            ? "Employee"
            : "CCR User";

        const initials =
          name.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "AU";

        if (isMounted) setLoadedAccount({ name, role, initials });
      } catch {
        // Navigasi tetap berjalan meskipun profil pengguna gagal dimuat.
      }
    }
    void loadAccount();
    return () => {
      isMounted = false;
    };
  }, [hasSuppliedAccount, isPublicRoute, isC2Route]);

  async function handleSignOut() {
    if (onSignOut) {
      onSignOut();
      return;
    }
    setIsInternalSigningOut(true);
    try {
      await createClient().auth.signOut({ scope: "local" });
      router.replace("/login");
      router.refresh();
    } finally {
      setIsInternalSigningOut(false);
    }
  }

  if (isPublicRoute) return null;

  return (
    <>
      <header
        className={`fixed right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white pl-3 pr-4 transition-[left] duration-200 sm:pl-4 sm:pr-8 ${
          isCollapsed ? "left-0 lg:left-0" : "left-0 lg:left-[260px]"
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Tombol garis 3 untuk mobile */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#155cfd] text-white shadow-sm hover:bg-[#124fd9] lg:hidden"
            aria-label={isEn ? "Open navigation" : "Buka navigasi"}
          >
            <Menu size={16} />
          </button>

          {/* Tombol garis 3 selalu tampil di desktop untuk buka/tutup sidebar */}
          <button
            type="button"
            onClick={toggleCollapse}
            className="hidden h-8 w-8 items-center justify-center rounded-lg bg-[#155cfd] text-white shadow-sm hover:bg-[#124fd9] lg:inline-flex"
            aria-label={
              isCollapsed
                ? isEn
                  ? "Show sidebar"
                  : "Tampilkan sidebar"
                : isEn
                ? "Hide sidebar"
                : "Sembunyikan sidebar"
            }
            title={
              isCollapsed
                ? isEn
                  ? "Show sidebar"
                  : "Tampilkan sidebar"
                : isEn
                ? "Hide sidebar"
                : "Sembunyikan sidebar"
            }
          >
            <Menu size={16} />
          </button>

          <div className="flex items-center gap-2.5 text-sm">
            <span className="font-bold tracking-tight text-slate-900">ANDIMA CCR</span>
            <span className="text-slate-300">|</span>
            <span className="font-medium text-slate-600">{currentPageTitle}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Toggle Bahasa EN | ID */}
          <div
            role="group"
            aria-label={isEn ? "Language switcher" : "Pengalih bahasa"}
            className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold"
          >
            <button
              type="button"
              onClick={() => setLang("en")}
              aria-pressed={isEn}
              className={`rounded-full px-2.5 py-1 transition-all ${
                isEn ? "bg-white text-[#155cfd] shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang("id")}
              aria-pressed={!isEn}
              className={`rounded-full px-2.5 py-1 transition-all ${
                !isEn ? "bg-white text-[#155cfd] shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              ID
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
              {account.initials}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-xs font-semibold leading-tight text-slate-900">{account.name}</p>
              {account.role && <p className="mt-0.5 text-[11px] leading-tight text-slate-500">{account.role}</p>}
            </div>
          </div>
        </div>
      </header>

      {isSidebarOpen && (
        <div className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-[#0f2342] px-4 py-5 text-[#d9e2fc] shadow-lg transition-transform duration-200 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${isCollapsed ? "lg:-translate-x-full" : "lg:translate-x-0"}`}
      >
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Logo-ANDIMA-wzx4gpZx20EFE5IYcH3jqabixELIo3.png"
              alt="Logo ANDIMA"
              width="400"
              height="246"
              className="h-10 w-auto shrink-0 object-contain"
            />
            <div>
              <p className="text-xl font-bold tracking-[-0.5px] text-white">ANDIMA</p>
              <p className="text-xs text-[#d9e2fc]/80">Logistics Suite</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="rounded-md p-1.5 text-[#d9e2fc]/80 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
            aria-label={isEn ? "Close navigation" : "Tutup navigasi"}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="mt-8 space-y-1.5 text-sm font-semibold">
          <div>
            <button
              type="button"
              onClick={() => setIsCcrOpen((value) => !value)}
              className="flex w-full items-center justify-between rounded-lg bg-[#155cfd] px-3 py-2.5 text-white shadow-sm"
            >
              <span className="flex items-center gap-2.5">
                <Wallet size={16} />
                <span>CCR</span>
              </span>
              <ChevronDown size={16} className={`transition-transform ${isCcrOpen ? "rotate-0" : "-rotate-90"}`} />
            </button>

            {isCcrOpen && (
              <div className="ml-5 mt-2 space-y-1 border-l border-[#d9e2fc]/20 pl-3">
                {MENU_ITEMS.map((item) => (
                  <HrmsLink key={item.href} label={item[lang]} href={item.href} />
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="mt-auto space-y-3">
          <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={isSigningOut || isInternalSigningOut}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-red-600 px-3 py-1.5 text-red-500 transition hover:bg-red-500/10 disabled:opacity-50"
              aria-label={isEn ? "Logout" : "Keluar"}
              title={`${account.name} (${account.role}) - ${isEn ? "Logout" : "Keluar"}`}
            >
              <span className="text-center text-sm font-bold">{isEn ? "Logout" : "Keluar"}</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}