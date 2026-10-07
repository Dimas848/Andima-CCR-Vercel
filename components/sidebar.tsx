"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  ChevronDown,
  Menu,
  X,
} from "lucide-react";

type SidebarProps = {
  userName?: string;
  userRole?: string;
  userInitials?: string;
  onSignOut?: () => void;
  isSigningOut?: boolean;
};

type Account = {
  name: string;
  role: string;
  initials: string;
};

const fallbackAccount: Account = {
  name: "Andima User",
  role: "CCR User",
  initials: "AU",
};

function HrmsLink({ label, href }: { label: string; href: string }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`flex w-full items-center rounded-md px-3 py-2 text-xs transition-colors ${
        isActive ? "bg-[#B0C6D4] text-[#0f2324]" : "text-[#d9e2fc]/80 hover:bg-[#1e3765] hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}

export default function Sidebar({ userName, userRole, userInitials, onSignOut, isSigningOut = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublicRoute = pathname === "/login" || pathname === "/register" || pathname.startsWith("/auth/");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isC1Route = ["/sales-overview", "/customer-analytics", "/overdue-alert"].some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const isC2Route = ["/dashboard", "/data-upload", "/cost-exception", "/priority-exception", "/customer-cost", "/evidence", "/monthly-closing", "/export-report"].some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const [isCcrOpen, setIsCcrOpen] = useState(true);
  const [isC1Open, setIsC1Open] = useState(isC1Route);
  const [isC2Open, setIsC2Open] = useState(isC2Route);
  const [isInternalSigningOut, setIsInternalSigningOut] = useState(false);
  const [loadedAccount, setLoadedAccount] = useState<Account | null>(null);
  const hasSuppliedAccount = Boolean(userName && userRole && userInitials);
  const suppliedAccount = hasSuppliedAccount
    ? { name: userName, role: userRole, initials: userInitials }
    : null;
  const account = suppliedAccount ?? loadedAccount ?? fallbackAccount;

  useEffect(() => {
    if (isPublicRoute || hasSuppliedAccount) return;

    let isMounted = true;
    async function loadAccount() {
      try {
        const supabase = createClient();
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        if (!user || !isMounted) return;

        const { data: access } = await supabase
          .from("d3_user_access")
          .select("app_role, d3_employee!d3_user_access_employee_id_fkey(full_name)")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        const accountAccess = access as unknown as { app_role: string | null; d3_employee: { full_name: string } | null } | null;
        const metadataName = user.user_metadata?.full_name;
        const registeredName = typeof metadataName === "string" && metadataName.trim()
          ? metadataName.trim()
          : user.email?.split("@")[0] ?? "Andima User";
        const name = accountAccess?.d3_employee?.full_name?.trim() || registeredName;
        const role = accountAccess?.app_role === "HR" ? "HR" : accountAccess?.app_role === "MANAGER" ? "Manager" : accountAccess?.app_role === "EMPLOYEE" ? "Employee" : "CCR User";
        const initials = name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "AU";
        if (isMounted) setLoadedAccount({ name, role, initials });
      } catch {
        // The navigation remains available even if the account label cannot load.
      }
    }

    void loadAccount();
    return () => { isMounted = false; };
  }, [hasSuppliedAccount, isPublicRoute]);

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
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-[#0f2342] px-4 py-5 text-[#d9e2fc] shadow-lg transition-transform lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header Logo & Brand Text */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Logo-ANDIMA-wzx4gpZx20EFE5IYcH3jqabixELIo3.png"
              alt="Logo ANDIMA"
              width="400"
              height="246"
              className="h-10 w-auto object-contain shrink-0"
            />
            <div>
              <p className="text-xl font-bold tracking-[-0.5px] text-white">ANDIMA</p>
              <p className="text-xs text-[#d9e2fc]/80">Logistics Suite</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="rounded p-1 text-[#d9e2fc] hover:bg-white/10 lg:hidden"
            aria-label="Tutup navigasi"
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
              <span className="flex items-center gap-3">CCR</span>
              <ChevronDown size={16} className={`transition-transform ${isCcrOpen ? "rotate-0" : "-rotate-90"}`} />
            </button>
            {isCcrOpen && (
              <div className="ml-5 mt-2 border-l border-[#d9e2fc]/20 pl-3">
                <SidebarGroup label="C1" open={isC1Open} active={isC1Route} onToggle={() => setIsC1Open((value) => !value)}>
                  <HrmsLink label="Sales Overview" href="/sales-overview" />
                  <HrmsLink label="Customer Analytics" href="/customer-analytics" />
                  <HrmsLink label="Overdue Alert" href="/overdue-alert" />
                </SidebarGroup>
                <SidebarGroup label="C2" open={isC2Open} active={isC2Route} onToggle={() => setIsC2Open((value) => !value)}>
                  <HrmsLink label="Dashboard" href="/dashboard" />
                  <HrmsLink label="Data Upload" href="/data-upload" />
                  <HrmsLink label="Cost Exception" href="/cost-exception" />
                  <HrmsLink label="Priority Exception" href="/priority-exception" />
                  <HrmsLink label="Customer Cost" href="/customer-cost" />
                  <HrmsLink label="Evidence" href="/evidence" />
                  <HrmsLink label="Monthly Closing" href="/monthly-closing" />
                  <HrmsLink label="Export Report" href="/export-report" />
                </SidebarGroup>
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
              className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-red-600 px-3 py-1.5 text-red-500 transition hover:bg-red-500/10 disabled:opacity-50"
              aria-label="Logout"
              title="Logout"
            >
              <span className="text-sm font-bold text-center">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      <button
        type="button"
        onClick={() => setIsSidebarOpen(true)}
        className="fixed left-4 top-4 z-30 rounded-lg bg-[#0f2342] p-2 text-white lg:hidden"
        aria-label="Buka navigasi"
      >
        <Menu size={20} />
      </button>
    </>
  );
}

function SidebarGroup({ label, open, active, onToggle, children }: { label: string; open: boolean; active: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-xs transition-colors ${
          active ? "text-white" : "text-[#d9e2fc]/80 hover:bg-[#1e3765] hover:text-white"
        }`}
        aria-expanded={open}
      >
        <span>{label}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-0" : "-rotate-90"}`} />
      </button>
      {open && <div className="mt-1 space-y-1">{children}</div>}
    </div>
  );
}