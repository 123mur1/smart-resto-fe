"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const menuItems = [
    { name: "Student", path: "/dashboard/student" },
    { name: "Staff", path: "/dashboard/staff" },
    { name: "Admin", path: "/dashboard/admin" },
  ];

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-cyan-700 text-white flex flex-col">
        <h2 className="text-2xl font-bold p-4 border-b border-cyan-500">Smart Campus restauraunt</h2>
        <nav className="flex-1 p-4 space-y-3">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`block p-2 rounded ${
                pathname.includes(item.path)
                  ? "bg-cyan-500 font-semibold"
                  : "hover:bg-cyan-600"
              }`}
            >
              {item.name}
            </Link>
          ))}
        </nav>
        <button
          onClick={() => {
            localStorage.clear();
            window.location.href = "/";
          }}
          className="bg-red-500 py-2 mx-4 mb-4 rounded"
        >
          Logout
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
