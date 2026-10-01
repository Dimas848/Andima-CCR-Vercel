"use client";

import React, { useState } from "react";
import UserInput from "@/components/UserInput";
import CustomDropdown from "@/components/CustomDropdown";
import Pagination from "@/components/Pagination";
import CustomButton from "@/components/CustomButton";
import StatusBadge from "@/components/StatusBadge";
import CustomTable, { Column } from "@/components/CustomTable";

interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  status: "ok" | "warning" | "error";
  statusText: string;
}

const sampleEmployees: Employee[] = [
  {
    id: "EMP-001",
    name: "Andima Pratama",
    role: "Senior Software Engineer",
    department: "Engineering",
    status: "ok",
    statusText: "Active",
  },
  {
    id: "EMP-002",
    name: "Siti Rahmawati",
    role: "HR Generalist",
    department: "Human Resource",
    status: "ok",
    statusText: "Active",
  },
  {
    id: "EMP-003",
    name: "Budi Santoso",
    role: "UI/UX Designer",
    department: "Design System",
    status: "warning",
    statusText: "On Leave",
  },
  {
    id: "EMP-004",
    name: "Dewi Lestari",
    role: "Finance Officer",
    department: "Finance",
    status: "error",
    statusText: "Suspended",
  },
  {
    id: "EMP-005",
    name: "Reza Firmansyah",
    role: "DevOps Engineer",
    department: "Infrastructure",
    status: "ok",
    statusText: "Active",
  },
];

export default function HomePage() {
  const [inputValue, setInputValue] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>(["EMP-001"]);

  const columns: Column<Employee>[] = [
    {
      key: "id",
      header: "ID Karyawan",
      width: "140px",
      render: (row) => <span className="font-semibold text-slate-900">{row.id}</span>,
    },
    {
      key: "name",
      header: "Nama Lengkap",
      render: (row) => (
        <div>
          <div className="font-bold text-slate-900">{row.name}</div>
          <div className="text-xs text-slate-500">{row.role}</div>
        </div>
      ),
    },
    {
      key: "department",
      header: "Departemen",
      render: (row) => <span className="font-medium text-slate-700">{row.department}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "160px",
      render: (row) => {
        if (row.status === "ok") {
          return (
            <span className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold bg-[#179C77] text-white">
              OK!
            </span>
          );
        }
        if (row.status === "warning") {
          return (
            <span className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold bg-[#D68A12] text-white">
              Warning!
            </span>
          );
        }
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold bg-[#D72C46] text-white">
            Error
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "Aksi",
      align: "right",
      width: "100px",
      render: () => (
        <button className="text-xs font-bold text-[#7A5AF8] hover:text-[#6039E8] px-2.5 py-1 rounded-lg hover:bg-purple-50 transition">
          Detail
        </button>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col items-center justify-center p-8 gap-8 font-sans">

      <div className="w-full max-w-[340px]">
        <UserInput
          placeholder="User Input D1"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
      </div>

      <div className="w-full max-w-[340px]">
        <CustomDropdown
          placeholder="Dropdown testing miliki D1"
          categoryTitle="TESTING"
          categoryBadge="3 Active"
          defaultOpen={false}
          items={[
            { id: "node", label: "Node.js", subLabel: "v2.3.9" },
            { id: "react", label: "React.js", subLabel: "yes yes" },
            { id: "next", label: "Next.js", subLabel: "v2.4.1-rc" },
          ]}
        />
      </div>

      <div>
        <Pagination
          currentPage={currentPage}
          totalPages={24}
          onPageChange={(page) => setCurrentPage(page)}
        />
      </div>

      <div className="w-full max-w-[340px] flex flex-col gap-3">
        <CustomButton variant="primary">Button</CustomButton>
        <CustomButton variant="outline">Button</CustomButton>
        <CustomButton variant="active">Button</CustomButton>
        <CustomButton variant="disabled">Button</CustomButton>
      </div>

      <div className="w-full max-w-[340px] flex flex-col gap-3">
        <StatusBadge status="ok">OK!</StatusBadge>
        <StatusBadge status="warning">Warning!</StatusBadge>
        <StatusBadge status="error">Error</StatusBadge>
      </div>

      <div className="w-full max-w-4xl">
        <CustomTable
          columns={columns}
          data={sampleEmployees}
          selectable={true}
          selectedIds={selectedIds}
          onSelectChange={(ids) => setSelectedIds(ids)}
          currentPage={currentPage}
          totalPages={24}
          onPageChange={(page) => setCurrentPage(page)}
          totalItems={120}
          itemsPerPage={5}
        />
      </div>
    </div>
  );
}
