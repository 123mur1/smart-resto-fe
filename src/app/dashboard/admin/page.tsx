"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE_URL = "http://localhost:3003";

interface User {
  id: string;
  fullName: string | null;
  email: string;
  phone: string | null;
  role: string;
  created_at: string;
}

interface Meal {
  id: string;
  meal_type: string;
  status: string;
  price: number | string;
  user_id: string;
  created_at: string;
}

interface Statistics {
  totalUsers: number;
  totalStudents: number;
  totalMeals: number;
  activeMeals: number;
  totalRevenue: number;
  walletLiability: number;
}

interface ToastState {
  type: "success" | "error";
  message: string;
}

type Tab = "overview" | "users" | "meals" | "reports";

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [statistics, setStatistics] = useState<Statistics>({
    totalUsers: 0,
    totalStudents: 0,
    totalMeals: 0,
    activeMeals: 0,
    totalRevenue: 0,
    walletLiability: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [usersPage, setUsersPage] = useState(1);
  const [mealsPage, setMealsPage] = useState(1);
  const [usersTotal, setUsersTotal] = useState(0);
  const [mealsTotal, setMealsTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [showUserModal, setShowUserModal] = useState(false);
  const [showMealModal, setShowMealModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);

  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }

    const storedUser = localStorage.getItem("user");
    const parsedUser: User | null = storedUser ? JSON.parse(storedUser) : null;

    if (!parsedUser) {
      router.replace("/login");
      return;
    }

    const role = parsedUser.role?.toLowerCase();
    if (role !== "admin" && role !== "superadmin") {
      router.replace("/dashboard/student");
      return;
    }

    setUser(parsedUser);
    loadDashboard();
  }, [router, token]);

  async function loadDashboard() {
    setLoading(true);
    try {
      await Promise.all([
        fetchStatistics(),
        fetchUsers(1),
        fetchMeals(1),
      ]);
    } catch (err: any) {
      console.error("Dashboard fetch error:", err);
      setError(err.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function fetchStatistics() {
    if (!token) return;

    try {
      // Fetch users - use max limit of 100 and fetch multiple pages if needed
      const usersRes = await fetch(`${API_BASE_URL}/user?page=1&limit=100`, {
        headers: { 
          "Content-Type": "application/json",
        },
      });

      let allUsers: User[] = [];
      if (usersRes.ok) {
        try {
          const usersData = await usersRes.json();
          console.log("Users API response:", usersData);
          // Handle different response structures
          allUsers = usersData.users || usersData.data?.users || (Array.isArray(usersData) ? usersData : []);
          console.log("Parsed users:", allUsers.length);
        } catch (parseError) {
          console.error("Failed to parse users response:", parseError);
        }
      } else {
        console.error("Users fetch failed:", usersRes.status, usersRes.statusText);
        try {
          const errorText = await usersRes.text();
          const errorData = JSON.parse(errorText);
          console.error("Error details:", errorData);
        } catch {
          console.error("Could not parse error response");
        }
      }

      // Fetch meals - use max limit of 100
      const mealsRes = await fetch(`${API_BASE_URL}/meal?page=1&limit=100`, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      let allMeals: Meal[] = [];
      if (mealsRes.ok) {
        try {
          const mealsData = await mealsRes.json();
          console.log("Meals API response:", mealsData);
          // Handle different response structures
          allMeals = mealsData.meals || mealsData.data?.meals || (Array.isArray(mealsData) ? mealsData : []);
          console.log("Parsed meals:", allMeals.length);
        } catch (parseError) {
          console.error("Failed to parse meals response:", parseError);
        }
      } else {
        console.error("Meals fetch failed:", mealsRes.status, mealsRes.statusText);
        try {
          const errorText = await mealsRes.text();
          const errorData = JSON.parse(errorText);
          console.error("Error details:", errorData);
        } catch {
          console.error("Could not parse error response");
        }
      }

      // Fetch financial metrics
      let financeMetrics: { totalRevenue: number; walletLiability: number } = {
        totalRevenue: 0,
        walletLiability: 0,
      };
      try {
        const financeRes = await fetch(`${API_BASE_URL}/metrics/finance`, {
          headers: {
            "Content-Type": "application/json",
          },
        });
        if (financeRes.ok) {
          const financeData = await financeRes.json();
          financeMetrics = {
            totalRevenue: Number(financeData.totalRevenue || 0),
            walletLiability: Number(financeData.walletLiability || 0),
          };
        }
      } catch (financeError) {
        console.warn("Finance metrics unavailable", financeError);
      }

      // Calculate statistics
      const totalUsers = allUsers.length;
      const totalStudents = allUsers.filter(
        (u: User) => u.role?.toUpperCase() === "STUDENTS" || u.role?.toUpperCase() === "STUDENT"
      ).length;
      const totalMeals = allMeals.length;
      const activeMeals = allMeals.filter(
        (m: Meal) => m.status === "ACTIVE"
      ).length;
      const fallbackRevenue = allMeals.reduce((sum: number, m: Meal) => {
        return sum + Number(m.price || 0);
      }, 0);
      const totalRevenue = financeMetrics.totalRevenue || fallbackRevenue;
      const walletLiability = financeMetrics.walletLiability;

      console.log("Final statistics:", {
        totalUsers,
        totalStudents,
        totalMeals,
        activeMeals,
        totalRevenue,
        walletLiability,
      });

      setStatistics({
        totalUsers,
        totalStudents,
        totalMeals,
        activeMeals,
        totalRevenue,
        walletLiability,
      });
    } catch (err: any) {
      console.error("Statistics fetch error:", err);
      // Only set error for network errors, not HTTP errors
      if (err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError")) {
        setError("Failed to connect to backend server. Make sure it's running on http://localhost:3003");
      }
    }
  }

  async function fetchUsers(page: number) {
    if (!token) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/user?page=${page}&limit=10&sort=created_at&order=desc`,
        {
          headers: { 
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to fetch users: ${res.status} ${res.statusText}. ${errorText}`);
      }

      const data = await res.json();
      setUsers(data.users || []);
      setUsersTotal(data.meta?.total || 0);
    } catch (err: any) {
      console.error("Fetch users error:", err);
      setError(err.message || "Failed to fetch users. Make sure the backend server is running.");
    }
  }

  async function fetchMeals(page: number) {
    try {
      const res = await fetch(
        `${API_BASE_URL}/meal?page=${page}&limit=10&sort=created_at&order=desc`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to fetch meals: ${res.status} ${res.statusText}. ${errorText}`);
      }

      const data = await res.json();
      setMeals(data.meals || []);
      setMealsTotal(data.meta?.total || 0);
    } catch (err: any) {
      console.error("Fetch meals error:", err);
      setError(err.message || "Failed to fetch meals. Make sure the backend server is running.");
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!token || !confirm("Are you sure you want to delete this user?"))
      return;

    try {
      const res = await fetch(`${API_BASE_URL}/user/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to delete user");

      setToast({ type: "success", message: "User deleted successfully" });
      fetchUsers(usersPage);
      fetchStatistics();
    } catch (err: any) {
      setToast({ type: "error", message: err.message });
    }
  }

  async function handleDeleteMeal(mealId: string) {
    if (!token || !confirm("Are you sure you want to delete this meal?"))
      return;

    try {
      const res = await fetch(`${API_BASE_URL}/meal/${mealId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to delete meal");

      setToast({ type: "success", message: "Meal deleted successfully" });
      fetchMeals(mealsPage);
      fetchStatistics();
    } catch (err: any) {
      setToast({ type: "error", message: err.message });
    }
  }

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-xl text-white">Loading dashboard...</p>
      </div>
    );

  if (error)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-xl text-red-400">{error}</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${
            toast.type === "success"
              ? "bg-green-500 text-white"
              : "bg-red-500 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-cyan-400">
              👨‍💼 Admin Dashboard
            </h1>
            <p className="text-gray-400 mt-1">
              Welcome back, {user?.fullName || user?.email}
            </p>
          </div>
          <button
            onClick={() => {
              localStorage.clear();
              router.push("/");
            }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-700 bg-gray-800/30">
        <div className="flex space-x-1 p-4">
          {[
            { id: "overview", label: "📊 Overview" },
            { id: "users", label: "👥 Users" },
            { id: "meals", label: "🍽️ Meals" },
            { id: "reports", label: "📄 Reports" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`px-6 py-3 rounded-lg transition ${
                activeTab === tab.id
                  ? "bg-cyan-600 text-white"
                  : "bg-gray-700/50 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard
                title="Total Users"
                value={statistics.totalUsers}
                icon="👥"
                color="blue"
              />
              <StatCard
                title="Students"
                value={statistics.totalStudents}
                icon="🎓"
                color="green"
              />
              <StatCard
                title="Total Meals"
                value={statistics.totalMeals}
                icon="🍽️"
                color="yellow"
              />
              <StatCard
                title="Active Meals"
                value={statistics.activeMeals}
                icon="✅"
                color="cyan"
              />
              <StatCard
                title="Total Revenue"
                value={`$${Number(statistics.totalRevenue).toFixed(2)}`}
                icon="💰"
                color="amber"
              />
              <StatCard
                title="Wallet Liability"
                value={`$${Number(statistics.walletLiability).toFixed(2)}`}
                icon="🪙"
                color="purple"
              />
            </div>

            {/* Recent Activity */}
            <div className="bg-gray-800/50 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Recent Users</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left p-3">Name</th>
                      <th className="text-left p-3">Email</th>
                      <th className="text-left p-3">Role</th>
                      <th className="text-left p-3">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.slice(0, 5).map((u) => (
                      <tr
                        key={u.id}
                        className="border-b border-gray-700/50 hover:bg-gray-700/30"
                      >
                        <td className="p-3">{u.fullName || "—"}</td>
                        <td className="p-3">{u.email}</td>
                        <td className="p-3">
                          <span className="px-2 py-1 bg-cyan-600/20 text-cyan-300 rounded text-sm">
                            {u.role}
                          </span>
                        </td>
                        <td className="p-3 text-gray-400">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <UsersTab
            users={users}
            usersPage={usersPage}
            usersTotal={usersTotal}
            onPageChange={setUsersPage}
            onFetchUsers={fetchUsers}
            onDeleteUser={handleDeleteUser}
            token={token}
            API_BASE_URL={API_BASE_URL}
          />
        )}

        {activeTab === "meals" && (
          <MealsTab
            meals={meals}
            mealsPage={mealsPage}
            mealsTotal={mealsTotal}
            onPageChange={setMealsPage}
            onFetchMeals={fetchMeals}
            onDeleteMeal={handleDeleteMeal}
            token={token}
            API_BASE_URL={API_BASE_URL}
          />
        )}

        {activeTab === "reports" && (
          <ReportsTab
            statistics={statistics}
            users={users}
            meals={meals}
            onFetchUsers={fetchUsers}
            onFetchMeals={fetchMeals}
            token={token}
            API_BASE_URL={API_BASE_URL}
          />
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: string;
  color: string;
}) {
  const colorClasses = {
    blue: "bg-blue-600/20 border-blue-500",
    green: "bg-green-600/20 border-green-500",
    yellow: "bg-yellow-600/20 border-yellow-500",
    cyan: "bg-cyan-600/20 border-cyan-500",
    amber: "bg-amber-600/20 border-amber-500",
    purple: "bg-purple-600/20 border-purple-500",
  };

  return (
    <div
      className={`${colorClasses[color as keyof typeof colorClasses]} border rounded-lg p-4`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
}

function UsersTab({
  users,
  usersPage,
  usersTotal,
  onPageChange,
  onFetchUsers,
  onDeleteUser,
  token,
  API_BASE_URL,
}: {
  users: User[];
  usersPage: number;
  usersTotal: number;
  onPageChange: (page: number) => void;
  onFetchUsers: (page: number) => void;
  onDeleteUser: (id: string) => void;
  token: string | null;
  API_BASE_URL: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">User Management</h2>
        <button
          onClick={() => {
            // TODO: Implement create user modal
            alert("Create user feature coming soon!");
          }}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition"
        >
          + Add User
        </button>
      </div>

      <div className="bg-gray-800/50 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700/50">
            <tr>
              <th className="text-left p-4">Name</th>
              <th className="text-left p-4">Email</th>
              <th className="text-left p-4">Phone</th>
              <th className="text-left p-4">Role</th>
              <th className="text-left p-4">Joined</th>
              <th className="text-left p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className="border-b border-gray-700/50 hover:bg-gray-700/30"
              >
                <td className="p-4">{u.fullName || "—"}</td>
                <td className="p-4">{u.email}</td>
                <td className="p-4">{u.phone || "—"}</td>
                <td className="p-4">
                  <span className="px-2 py-1 bg-cyan-600/20 text-cyan-300 rounded text-sm">
                    {u.role}
                  </span>
                </td>
                <td className="p-4 text-gray-400">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="p-4">
                  <button
                    onClick={() => onDeleteUser(u.id)}
                    className="px-3 py-1 bg-red-600/20 text-red-300 hover:bg-red-600/30 rounded text-sm transition"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center">
        <p className="text-gray-400">
          Showing {(usersPage - 1) * 10 + 1} to{" "}
          {Math.min(usersPage * 10, usersTotal)} of {usersTotal} users
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const newPage = Math.max(1, usersPage - 1);
              onPageChange(newPage);
              onFetchUsers(newPage);
            }}
            disabled={usersPage === 1}
            className="px-4 py-2 bg-gray-700 disabled:opacity-50 rounded-lg transition"
          >
            Previous
          </button>
          <button
            onClick={() => {
              const newPage = usersPage + 1;
              onPageChange(newPage);
              onFetchUsers(newPage);
            }}
            disabled={usersPage * 10 >= usersTotal}
            className="px-4 py-2 bg-gray-700 disabled:opacity-50 rounded-lg transition"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function MealsTab({
  meals,
  mealsPage,
  mealsTotal,
  onPageChange,
  onFetchMeals,
  onDeleteMeal,
  token,
  API_BASE_URL,
}: {
  meals: Meal[];
  mealsPage: number;
  mealsTotal: number;
  onPageChange: (page: number) => void;
  onFetchMeals: (page: number) => void;
  onDeleteMeal: (id: string) => void;
  token: string | null;
  API_BASE_URL: string;
}) {
  const mealTypeLabels: Record<string, string> = {
    BREAKFAST: "Breakfast",
    LUNCH: "Lunch",
    DINNER: "Dinner",
    LUNCH_DINNER: "Lunch & Dinner",
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Meal Management</h2>
        <button
          onClick={() => {
            // TODO: Implement create meal modal
            alert("Create meal feature coming soon!");
          }}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition"
        >
          + Add Meal
        </button>
      </div>

      <div className="bg-gray-800/50 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700/50">
            <tr>
              <th className="text-left p-4">Type</th>
              <th className="text-left p-4">Price</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">Created</th>
              <th className="text-left p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {meals.map((m) => (
              <tr
                key={m.id}
                className="border-b border-gray-700/50 hover:bg-gray-700/30"
              >
                <td className="p-4">
                  {mealTypeLabels[m.meal_type] || m.meal_type}
                </td>
                <td className="p-4 text-amber-300">
                  ${m.price ? Number(m.price).toFixed(2) : "0.00"}
                </td>
                <td className="p-4">
                  <span
                    className={`px-2 py-1 rounded text-sm ${
                      m.status === "ACTIVE"
                        ? "bg-green-600/20 text-green-300"
                        : "bg-gray-600/20 text-gray-300"
                    }`}
                  >
                    {m.status}
                  </span>
                </td>
                <td className="p-4 text-gray-400">
                  {new Date(m.created_at).toLocaleDateString()}
                </td>
                <td className="p-4">
                  <button
                    onClick={() => onDeleteMeal(m.id)}
                    className="px-3 py-1 bg-red-600/20 text-red-300 hover:bg-red-600/30 rounded text-sm transition"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center">
        <p className="text-gray-400">
          Showing {(mealsPage - 1) * 10 + 1} to{" "}
          {Math.min(mealsPage * 10, mealsTotal)} of {mealsTotal} meals
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const newPage = Math.max(1, mealsPage - 1);
              onPageChange(newPage);
              onFetchMeals(newPage);
            }}
            disabled={mealsPage === 1}
            className="px-4 py-2 bg-gray-700 disabled:opacity-50 rounded-lg transition"
          >
            Previous
          </button>
          <button
            onClick={() => {
              const newPage = mealsPage + 1;
              onPageChange(newPage);
              onFetchMeals(newPage);
            }}
            disabled={mealsPage * 10 >= mealsTotal}
            className="px-4 py-2 bg-gray-700 disabled:opacity-50 rounded-lg transition"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportsTab({
  statistics,
  users,
  meals,
  onFetchUsers,
  onFetchMeals,
  token,
  API_BASE_URL,
}: {
  statistics: Statistics;
  users: User[];
  meals: Meal[];
  onFetchUsers: (page: number) => void;
  onFetchMeals: (page: number) => void;
  token: string | null;
  API_BASE_URL: string;
}) {
  const [generating, setGenerating] = useState(false);
  const [reportType, setReportType] = useState<"summary" | "users" | "meals" | "full">("summary");
  const [format, setFormat] = useState<"pdf" | "csv" | "json">("pdf");

  const generateCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      alert("No data to export");
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            if (value === null || value === undefined) return "";
            if (typeof value === "string" && value.includes(",")) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateJSON = (data: any, filename: string) => {
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.json`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generatePDF = async (content: string, filename: string) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to generate PDF");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${filename}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #06b6d4; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #06b6d4; color: white; }
            .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0; }
            .stat-box { border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      let reportData: any = {};
      let reportContent = "";
      let filename = "";

      if (reportType === "summary" || reportType === "full") {
        reportContent += `
          <h1>Smart Campus Restaurant - Summary Report</h1>
          <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          <div class="stats">
            <div class="stat-box">
              <h3>Total Users</h3>
              <p>${statistics.totalUsers}</p>
            </div>
            <div class="stat-box">
              <h3>Total Students</h3>
              <p>${statistics.totalStudents}</p>
            </div>
            <div class="stat-box">
              <h3>Total Meals</h3>
              <p>${statistics.totalMeals}</p>
            </div>
            <div class="stat-box">
              <h3>Active Meals</h3>
              <p>${statistics.activeMeals}</p>
            </div>
            <div class="stat-box">
              <h3>Total Revenue</h3>
              <p>$${Number(statistics.totalRevenue).toFixed(2)}</p>
            </div>
          </div>
        `;
        reportData.summary = statistics;
        filename = "summary_report";
      }

      if (reportType === "users" || reportType === "full") {
        if (users.length < statistics.totalUsers) {
          await onFetchUsers(1);
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        reportContent += `
          <h2>Users Report</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              ${users.map(
                (u) => `
                <tr>
                  <td>${u.fullName || "—"}</td>
                  <td>${u.email}</td>
                  <td>${u.phone || "—"}</td>
                  <td>${u.role}</td>
                  <td>${new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              `
              ).join("")}
            </tbody>
          </table>
        `;
        reportData.users = users;
        if (filename) filename += "_users";
        else filename = "users_report";
      }

      if (reportType === "meals" || reportType === "full") {
        if (meals.length < statistics.totalMeals) {
          await onFetchMeals(1);
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        reportContent += `
          <h2>Meals Report</h2>
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Price</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              ${meals.map(
                (m) => `
                <tr>
                  <td>${m.meal_type}</td>
                  <td>$${Number(m.price).toFixed(2)}</td>
                  <td>${m.status}</td>
                  <td>${new Date(m.created_at).toLocaleDateString()}</td>
                </tr>
              `
              ).join("")}
            </tbody>
          </table>
        `;
        reportData.meals = meals;
        if (filename) filename += "_meals";
        else filename = "meals_report";
      }

      if (reportType === "full") {
        filename = "full_report";
      }

      if (format === "csv") {
        if (reportType === "users" || reportType === "full") {
          generateCSV(users, filename);
        }
        if (reportType === "meals" || reportType === "full") {
          generateCSV(meals, filename);
        }
        if (reportType === "summary") {
          generateCSV([statistics], filename);
        }
      } else if (format === "json") {
        generateJSON(reportData, filename);
      } else {
        await generatePDF(reportContent, filename);
      }

      alert("Report generated successfully!");
    } catch (error: any) {
      console.error("Report generation error:", error);
      alert("Failed to generate report: " + error.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-800/50 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-6">Generate Report</h2>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Report Type</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { value: "summary", label: "📊 Summary", desc: "Statistics only" },
                { value: "users", label: "👥 Users", desc: "User list" },
                { value: "meals", label: "🍽️ Meals", desc: "Meal list" },
                { value: "full", label: "📄 Full Report", desc: "All data" },
              ].map((type) => (
                <button
                  key={type.value}
                  onClick={() => setReportType(type.value as any)}
                  className={`p-4 rounded-lg border-2 transition ${
                    reportType === type.value
                      ? "border-cyan-500 bg-cyan-500/20"
                      : "border-gray-700 hover:border-gray-600"
                  }`}
                >
                  <div className="font-semibold">{type.label}</div>
                  <div className="text-xs text-gray-400 mt-1">{type.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Export Format</label>
            <div className="flex gap-3">
              {[
                { value: "pdf", label: "📄 PDF" },
                { value: "csv", label: "📊 CSV" },
                { value: "json", label: "📋 JSON" },
              ].map((fmt) => (
                <button
                  key={fmt.value}
                  onClick={() => setFormat(fmt.value as any)}
                  className={`px-6 py-3 rounded-lg border-2 transition ${
                    format === fmt.value
                      ? "border-cyan-500 bg-cyan-500/20"
                      : "border-gray-700 hover:border-gray-600"
                  }`}
                >
                  {fmt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <button
              onClick={handleGenerateReport}
              disabled={generating}
              className="w-full py-4 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold text-lg transition"
            >
              {generating ? "⏳ Generating Report..." : "🚀 Generate Report"}
            </button>
          </div>

          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
            <h3 className="font-semibold mb-2">Report Preview</h3>
            <div className="text-sm text-gray-400 space-y-1">
              <p>• Report Type: <span className="text-white">{reportType.toUpperCase()}</span></p>
              <p>• Format: <span className="text-white">{format.toUpperCase()}</span></p>
              <p>• Includes: {
                reportType === "summary" ? "Statistics only" :
                reportType === "users" ? "User data" :
                reportType === "meals" ? "Meal data" :
                "All data (Summary + Users + Meals)"
              }</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
