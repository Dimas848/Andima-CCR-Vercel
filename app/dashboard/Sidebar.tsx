"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  AlertCircle,
  ListOrdered,
  Users,
  FileCheck,
  Lock,
  FileDown,
  LogOut,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const menus = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Data Upload", icon: Upload, href: "/data-upload" },
  { label: "Cost Exception", icon: AlertCircle, href: "/cost-exception" },
  { label: "Priority Exception", icon: ListOrdered, href: "/priority-exception" },
  { label: "Customer Cost", icon: Users, href: "/customer-cost" },
  { label: "Evidence", icon: FileCheck, href: "/evidence" },
  { label: "Monthly Closing", icon: Lock, href: "/monthly-closing" },
  { label: "Export Report", icon: FileDown, href: "/export-report" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Gagal logout:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-[#0b2239] text-slate-300">
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white">
          <span className="text-sm font-black text-[#d4194f]">AT</span>
        </div>
        <div>
          <p className="text-sm font-bold text-white">Monthly Cost</p>
          <p className="text-[11px] text-slate-400">C2 - Finance Ops</p>
        </div>
      </div>

      <p className="px-6 pb-2 pt-6 text-[10px] font-bold tracking-widest text-slate-500">
        MENU UTAMA
      </p>

      {/* Menu */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
        {menus.map((m) => {
          const Icon = m.icon;
          const isActive = m.href !== null && pathname === m.href;
          const classes = `flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold transition-colors ${
            isActive
              ? "bg-[#123a5c] text-white ring-1 ring-sky-500/40"
              : "hover:bg-white/5 hover:text-white"
          }`;
          const iconClasses = `h-4 w-4 ${isActive ? "text-sky-400" : "text-slate-400"}`;

          return m.href ? (
            <Link key={m.label} href={m.href} className={classes}>
              <Icon className={iconClasses} /> {m.label}
            </Link>
          ) : (
            <button key={m.label} className={classes}>
              <Icon className={iconClasses} /> {m.label}
            </button>
          );
        })}
      </nav>

      {/* User & Tombol Logout */}
      <div className="m-3 flex items-center justify-between gap-3 rounded-xl bg-white/5 p-3">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d4194f] text-xs font-bold text-white">
            RA
          </div>
          <div className="truncate">
            <p className="truncate text-[13px] font-bold text-white">Rina Anggraini</p>
            <p className="truncate text-[11px] text-slate-400">Finance Controller</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          title="Keluar dari akun"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-500/20 hover:text-rose-400 disabled:opacity-50"
        >
          {isLoggingOut ? (
            <Loader2 className="h-4 w-4 animate-spin text-rose-400" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  );
}