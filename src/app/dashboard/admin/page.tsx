"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { API_BASE_URL, API_ENDPOINTS } from "@/lib/api-config";

const EXCHANGE_RATE = 1300; // 1 USD = 1300 RWF

// Helper function to convert USD to RWF and round to whole number
function usdToRwf(usdAmount: number | string): number {
  const amount = typeof usdAmount === "string" ? Number(usdAmount) : usdAmount;
  return Math.round(amount * EXCHANGE_RATE);
}

// Helper function to format amount in RWF
function formatRwf(amount: number | string): string {
  const rwfAmount = usdToRwf(amount);
  return `${rwfAmount.toLocaleString()} RWF`;
}

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

interface Payment {
  id: string;
  student_id: string;
  booking_id: string | null;
  amount: number | string;
  method: string;
  provider_ref: string | null;
  payment_date: string;
  status: string;
  student?: {
    id: string;
    user?: {
      fullName: string | null;
      email: string;
    };
  };
}

interface Transaction {
  id: string;
  student_id: string;
  meal_id: string | null;
  payment_id: string | null;
  booking_id: string | null;
  transaction_type: string;
  amount: number | string;
  balance_after: number | string | null;
  transaction_date: string;
  remarks: string | null;
  student?: {
    id: string;
    user?: {
      fullName: string | null;
      email: string;
    };
  };
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

type Tab = "overview" | "users" | "meals" | "payments" | "reports";

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
  const [payments, setPayments] = useState<Payment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [dateFilter, setDateFilter] = useState<{
    startDate: string;
    endDate: string;
  }>({
    startDate: "",
    endDate: "",
  });

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
      // Redirect to appropriate dashboard based on role
      if (role === "staff") {
        router.replace("/dashboard/staff");
      } else {
        router.replace("/dashboard/student");
      }
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
        fetchPayments(1), // Load payments on initial dashboard load
        fetchTransactions(1), // Load transactions on initial dashboard load
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
      const usersRes = await fetch(`${API_ENDPOINTS.USER.BASE}?page=1&limit=100`, {
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
      const mealsRes = await fetch(`${API_ENDPOINTS.MEAL.BASE}?page=1&limit=100`, {
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
        const financeRes = await fetch(API_ENDPOINTS.METRICS.FINANCE, {
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
        `${API_ENDPOINTS.USER.BASE}?page=${page}&limit=10&sort=created_at&order=desc`,
        {
          headers: { 
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        let errorMessage = `Failed to fetch users: ${res.status} ${res.statusText}`;
        try {
          const errorText = await res.text();
          if (errorText) {
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage = errorJson.message || errorJson.error || errorMessage;
            } catch {
              errorMessage = errorText.length > 100 ? errorMessage : errorText;
            }
          }
        } catch {
          // If we can't read error text, use default message
        }
        console.error("Fetch users error:", errorMessage);
        setUsers([]);
        setUsersTotal(0);
        return;
      }

      const data = await res.json();
      setUsers(data.users || []);
      setUsersTotal(data.meta?.total || 0);
    } catch (err: any) {
      console.error("Fetch users error:", err);
      setUsers([]);
      setUsersTotal(0);
    }
  }

  async function fetchMeals(page: number) {
    try {
      const res = await fetch(
        `${API_ENDPOINTS.MEAL.BASE}?page=${page}&limit=10&sort=created_at&order=desc`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        let errorMessage = `Failed to fetch meals: ${res.status} ${res.statusText}`;
        try {
          const errorText = await res.text();
          if (errorText) {
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage = errorJson.message || errorJson.error || errorMessage;
            } catch {
              errorMessage = errorText.length > 100 ? errorMessage : errorText;
            }
          }
        } catch {
          // If we can't read error text, use default message
        }
        console.error("Fetch meals error:", errorMessage);
        setMeals([]);
        setMealsTotal(0);
        return;
      }

      const data = await res.json();
      setMeals(data.meals || []);
      setMealsTotal(data.meta?.total || 0);
    } catch (err: any) {
      console.error("Fetch meals error:", err);
      setMeals([]);
      setMealsTotal(0);
    }
  }

  async function fetchPayments(page: number = 1, startDate?: string, endDate?: string) {
    if (!token) return;
    try {
      let url = `${API_ENDPOINTS.PAYMENT.BASE}?page=${page}&limit=20&sort=payment_date&order=desc`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const res = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        console.warn(`Payment fetch failed: ${res.status} ${res.statusText}`);
        setPayments([]);
        setPaymentsTotal(0);
        return;
      }

      const data = await res.json();
      console.log("Payment API response:", data); // Debug log
      
      // Backend returns: { payments: [...], meta: { total, page, limit, totalPages } }
      const allPaymentsList = data.payments || data.data || [];
      // Filter out CASH payments from display
      const paymentsList = allPaymentsList.filter((p: Payment) => p.method !== "CASH");
      const total = paymentsList.length; // Use filtered count
      
      console.log(`Fetched ${paymentsList.length} payments (excluding CASH), total: ${total}`); // Debug log
      
      setPayments(paymentsList);
      setPaymentsTotal(total);
    } catch (err: any) {
      console.error("Fetch payments error:", err);
      setPayments([]);
      setPaymentsTotal(0);
    }
  }

  async function fetchTransactions(page: number = 1, startDate?: string, endDate?: string) {
    if (!token) return;
    try {
      let url = `${API_ENDPOINTS.TRANSACTION.BASE}?page=${page}&limit=20&sort=transaction_date&order=desc`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const res = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        // If endpoint doesn't exist or returns error, silently handle it
        setTransactions([]);
        return;
      }

      const data = await res.json();
      setTransactions(data.transactions || data.data || []);
    } catch (err: any) {
      // Silently handle errors - transactions may not be available
      setTransactions([]);
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!token || !confirm("Are you sure you want to delete this user?"))
      return;

    try {
      const res = await fetch(API_ENDPOINTS.USER.BY_ID(userId), {
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
      const res = await fetch(API_ENDPOINTS.MEAL.BY_ID(mealId), {
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
            { id: "payments", label: "💳 Payments" },
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
          <OverviewTab
            statistics={statistics}
            users={users}
            payments={payments}
            transactions={transactions}
            onFetchPayments={fetchPayments}
            onFetchTransactions={fetchTransactions}
          />
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

        {activeTab === "payments" && (
          <PaymentsTab
            payments={payments}
            transactions={transactions}
            paymentsPage={paymentsPage}
            paymentsTotal={paymentsTotal}
            dateFilter={dateFilter}
            onPageChange={setPaymentsPage}
            onFetchPayments={fetchPayments}
            onFetchTransactions={fetchTransactions}
            onDateFilterChange={setDateFilter}
            token={token}
            API_BASE_URL={API_BASE_URL}
            statistics={statistics}
          />
        )}

        {activeTab === "reports" && (
          <ReportsTab
            statistics={statistics}
            users={users}
            meals={meals}
            onFetchUsers={fetchUsers}
            onFetchMeals={fetchMeals}
            onFetchPayments={fetchPayments}
            onFetchTransactions={fetchTransactions}
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
  onFetchPayments,
  onFetchTransactions,
  token,
  API_BASE_URL,
}: {
  statistics: Statistics;
  users: User[];
  meals: Meal[];
  onFetchUsers: (page: number) => void;
  onFetchMeals: (page: number) => void;
  onFetchPayments: (page: number, startDate?: string, endDate?: string) => void;
  onFetchTransactions: (page: number, startDate?: string, endDate?: string) => void;
  token: string | null;
  API_BASE_URL: string;
}) {
  const [generating, setGenerating] = useState(false);
  const [reportType, setReportType] = useState<"summary" | "users" | "meals" | "payments" | "transactions" | "full">("summary");
  const [format, setFormat] = useState<"pdf" | "csv" | "json">("pdf");
  const [reportDateRange, setReportDateRange] = useState<{
    startDate: string;
    endDate: string;
  }>({
    startDate: "",
    endDate: "",
  });
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);

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
    // Create a downloadable HTML file that can be printed or converted to PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${filename}</title>
          <meta charset="UTF-8">
          <style>
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
            body { 
              font-family: Arial, sans-serif; 
              padding: 20px; 
              margin: 0;
              background: white;
              color: #000;
            }
            h1 { color: #06b6d4; margin-top: 0; }
            h2 { color: #06b6d4; margin-top: 30px; }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 20px 0; 
              font-size: 12px;
            }
            th, td { 
              border: 1px solid #ddd; 
              padding: 8px; 
              text-align: left; 
            }
            th { 
              background-color: #06b6d4; 
              color: white; 
              font-weight: bold;
            }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .stats { 
              display: grid; 
              grid-template-columns: repeat(2, 1fr); 
              gap: 20px; 
              margin: 20px 0; 
            }
            .stat-box { 
              border: 1px solid #ddd; 
              padding: 15px; 
              border-radius: 5px; 
              background: #f5f5f5;
            }
            .stat-box h3 {
              margin: 0 0 10px 0;
              color: #333;
            }
            .stat-box p {
              margin: 0;
              font-size: 24px;
              font-weight: bold;
              color: #06b6d4;
            }
            .no-print {
              text-align: center;
              padding: 20px;
              background: #f0f0f0;
              margin-bottom: 20px;
            }
            .no-print button {
              background: #06b6d4;
              color: white;
              border: none;
              padding: 10px 20px;
              font-size: 16px;
              cursor: pointer;
              border-radius: 5px;
              margin: 0 10px;
            }
            .no-print button:hover {
              background: #059669;
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()">🖨️ Print / Save as PDF</button>
            <button onclick="window.close()">Close</button>
          </div>
          ${content}
        </body>
      </html>
    `;

    // Create a blob and download it
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().split("T")[0]}.html`;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Also open in a new window for printing
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      // Auto-print after a short delay
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  // Function to fetch ALL payments for a date range
  async function fetchAllPayments(startDate?: string, endDate?: string): Promise<Payment[]> {
    if (!token) return [];
    const allPayments: Payment[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        let url = `${API_ENDPOINTS.PAYMENT.BASE}?page=${page}&limit=100&sort=payment_date&order=desc`;
        if (startDate) url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;

        const res = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) break;

        const data = await res.json();
        const payments = data.payments || data.data || [];
        allPayments.push(...payments);

        const total = data.meta?.total || 0;
        hasMore = page * 100 < total;
        page++;
      } catch (err) {
        console.error("Error fetching payments:", err);
        break;
      }
    }

    return allPayments;
  }

  // Function to fetch ALL transactions for a date range
  async function fetchAllTransactions(startDate?: string, endDate?: string): Promise<Transaction[]> {
    if (!token) return [];
    const allTransactions: Transaction[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        let url = `${API_ENDPOINTS.TRANSACTION.BASE}?page=${page}&limit=100&sort=transaction_date&order=desc`;
        if (startDate) url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;

        const res = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) break;

        const data = await res.json();
        const transactions = data.transactions || data.data || [];
        allTransactions.push(...transactions);

        const total = data.meta?.total || 0;
        hasMore = page * 100 < total;
        page++;
      } catch (err) {
        console.error("Error fetching transactions:", err);
        break;
      }
    }

    return allTransactions;
  }

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      let reportData: any = {};
      let reportContent = "";
      let filename = "";

      // Fetch all payments and transactions for the date range if needed
      let fetchedPayments: Payment[] = [];
      let fetchedTransactions: Transaction[] = [];
      
      if (reportType === "payments" || reportType === "transactions" || reportType === "full") {
        if (reportDateRange.startDate || reportDateRange.endDate) {
          fetchedPayments = await fetchAllPayments(
            reportDateRange.startDate || undefined,
            reportDateRange.endDate || undefined
          );
          setAllPayments(fetchedPayments);

          fetchedTransactions = await fetchAllTransactions(
            reportDateRange.startDate || undefined,
            reportDateRange.endDate || undefined
          );
          setAllTransactions(fetchedTransactions);
        } else {
          // If no date range, fetch all
          fetchedPayments = await fetchAllPayments();
          setAllPayments(fetchedPayments);
          fetchedTransactions = await fetchAllTransactions();
          setAllTransactions(fetchedTransactions);
        }
      }

      // Add date range info to report
      const dateRangeInfo = reportDateRange.startDate || reportDateRange.endDate
        ? `<p><strong>Date Range:</strong> ${reportDateRange.startDate || "All time"} to ${reportDateRange.endDate || "All time"}</p>`
        : "<p><strong>Date Range:</strong> All time</p>";

      if (reportType === "summary" || reportType === "full") {
        reportContent += `
          <h1>Smart Campus Restaurant - Summary Report</h1>
          <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          ${dateRangeInfo}
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
            ${reportDateRange.startDate || reportDateRange.endDate ? `
            <div class="stat-box">
              <h3>Payments in Range</h3>
              <p>${fetchedPayments.length}</p>
            </div>
            <div class="stat-box">
              <h3>Transactions in Range</h3>
              <p>${fetchedTransactions.length}</p>
            </div>
            <div class="stat-box">
              <h3>Revenue in Range</h3>
              <p>$${fetchedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0).toFixed(2)}</p>
            </div>
            ` : ""}
          </div>
        `;
        reportData.summary = {
          ...statistics,
          paymentsCount: fetchedPayments.length,
          transactionsCount: fetchedTransactions.length,
          dateRangeRevenue: fetchedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
        };
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

      if (reportType === "payments" || reportType === "full") {
        // Use fetched payments directly, filter out CASH for display
        const paymentsToInclude = fetchedPayments.filter((p: Payment) => p.method !== "CASH");
        
        reportContent += `
          <h2>Payments Report</h2>
          <p><strong>Total Payments:</strong> ${paymentsToInclude.length} ${fetchedPayments.length > paymentsToInclude.length ? `(${fetchedPayments.length - paymentsToInclude.length} CASH payments excluded)` : ""}</p>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Student</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              ${paymentsToInclude.map(
                (p) => `
                <tr>
                  <td>${new Date(p.payment_date).toLocaleString()}</td>
                  <td>${p.student?.user?.fullName || p.student?.user?.email || "N/A"}</td>
                  <td>${formatRwf(p.amount)}</td>
                  <td>${p.method}</td>
                  <td>${p.status}</td>
                  <td>${p.provider_ref || "—"}</td>
                </tr>
              `
              ).join("")}
            </tbody>
          </table>
        `;
        reportData.payments = paymentsToInclude;
        if (filename) filename += "_payments";
        else filename = "payments_report";
      }

      if (reportType === "transactions" || reportType === "full") {
        const transactionsToInclude = fetchedTransactions;
        
        reportContent += `
          <h2>Transactions Report</h2>
          <p><strong>Total Transactions:</strong> ${transactionsToInclude.length}</p>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Student</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Balance After</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${transactionsToInclude.map(
                (t) => `
                <tr>
                  <td>${new Date(t.transaction_date).toLocaleString()}</td>
                  <td>${t.student?.user?.fullName || t.student?.user?.email || "N/A"}</td>
                  <td>${t.transaction_type}</td>
                  <td>${formatRwf(t.amount)}</td>
                  <td>${t.balance_after ? formatRwf(t.balance_after) : "—"}</td>
                  <td>${t.remarks || "—"}</td>
                </tr>
              `
              ).join("")}
            </tbody>
          </table>
        `;
        reportData.transactions = fetchedTransactions;
        if (filename) filename += "_transactions";
        else filename = "transactions_report";
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
        if (reportType === "payments" || reportType === "full") {
          generateCSV(allPayments, filename);
        }
        if (reportType === "transactions" || reportType === "full") {
          generateCSV(allTransactions, filename);
        }
        if (reportType === "summary") {
          generateCSV([reportData.summary], filename);
        }
      } else if (format === "json") {
        generateJSON(reportData, filename);
      } else {
        await generatePDF(reportContent, filename);
        // Show success message after a short delay to ensure download started
        setTimeout(() => {
          alert("Report generated successfully! The file has been downloaded. You can open it and print/save as PDF.");
        }, 500);
        return; // Return early to avoid double alert
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
          {/* Date Range Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Date Range (Optional)</label>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Start Date</label>
                <input
                  type="date"
                  value={reportDateRange.startDate}
                  onChange={(e) =>
                    setReportDateRange({ ...reportDateRange, startDate: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">End Date</label>
                <input
                  type="date"
                  value={reportDateRange.endDate}
                  onChange={(e) =>
                    setReportDateRange({ ...reportDateRange, endDate: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => setReportDateRange({ startDate: "", endDate: "" })}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition text-sm"
                >
                  Clear Dates
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Leave empty to include all records. Select dates to filter payments and transactions.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Report Type</label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { value: "summary", label: "📊 Summary", desc: "Statistics only" },
                { value: "users", label: "👥 Users", desc: "User list" },
                { value: "meals", label: "🍽️ Meals", desc: "Meal list" },
                { value: "payments", label: "💳 Payments", desc: "All payments" },
                { value: "transactions", label: "🔄 Transactions", desc: "All transactions" },
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
              <p>• Date Range: <span className="text-white">
                {reportDateRange.startDate || reportDateRange.endDate
                  ? `${reportDateRange.startDate || "All"} to ${reportDateRange.endDate || "All"}`
                  : "All time"}
              </span></p>
              <p>• Includes: {
                reportType === "summary" ? "Statistics only" :
                reportType === "users" ? "User data" :
                reportType === "meals" ? "Meal data" :
                reportType === "payments" ? "All payments" :
                reportType === "transactions" ? "All transactions" :
                "All data (Summary + Users + Meals + Payments + Transactions)"
              }</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewTab({
  statistics,
  users,
  payments,
  transactions,
  onFetchPayments,
  onFetchTransactions,
}: {
  statistics: Statistics;
  users: User[];
  payments: Payment[];
  transactions: Transaction[];
  onFetchPayments: (page?: number) => void;
  onFetchTransactions: (page?: number) => void;
}) {
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    // Fetch payments and transactions for charts
    onFetchPayments(1);
    onFetchTransactions(1);
  }, []);

  useEffect(() => {
    // Prepare chart data from transactions and payments
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toISOString().split("T")[0];
    });

    const revenueData = last7Days.map((date) => {
      const dayPayments = payments.filter(
        (p) => p.payment_date?.split("T")[0] === date
      );
      const dayTransactions = transactions.filter(
        (t) => t.transaction_date?.split("T")[0] === date && t.transaction_type === "DEBIT"
      );
      const revenue = dayPayments.reduce(
        (sum, p) => sum + Number(p.amount || 0),
        0
      ) + dayTransactions.reduce(
        (sum, t) => sum + Number(t.amount || 0),
        0
      );
      return {
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        revenue: revenue,
        transactions: dayPayments.length + dayTransactions.length,
      };
    });

    setChartData(revenueData);
  }, [payments, transactions]);

  // User growth data
  const userGrowthData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dateStr = date.toISOString().split("T")[0];
    const usersOnDate = users.filter(
      (u) => u.created_at?.split("T")[0] <= dateStr
    ).length;
    return {
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      users: usersOnDate,
    };
  });

  // Payment method distribution (excluding CASH)
  const paymentMethodData = [
    { name: "Mobile Money", value: payments.filter((p) => p.method === "MOBILE_MONEY").length },
    { name: "Card", value: payments.filter((p) => p.method === "CARD").length },
    { name: "Bank Transfer", value: payments.filter((p) => p.method === "BANK_TRANSIFER").length },
  ].filter((item) => item.value > 0);

  const COLORS = ["#06b6d4", "#10b981", "#f59e0b", "#8b5cf6"];

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
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

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-gray-800/50 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4">Revenue Trend (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
                labelStyle={{ color: "#e5e7eb" }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#06b6d4"
                fill="#06b6d4"
                fillOpacity={0.3}
                name="Revenue ($)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Transactions Chart */}
        <div className="bg-gray-800/50 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4">Transactions (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
                labelStyle={{ color: "#e5e7eb" }}
              />
              <Legend />
              <Bar dataKey="transactions" fill="#10b981" name="Transactions" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <div className="bg-gray-800/50 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4">User Growth (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={userGrowthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
                labelStyle={{ color: "#e5e7eb" }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="users"
                stroke="#8b5cf6"
                strokeWidth={2}
                name="Total Users"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Methods Chart */}
        <div className="bg-gray-800/50 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4">Payment Methods Distribution</h3>
          {paymentMethodData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={paymentMethodData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {paymentMethodData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
                  labelStyle={{ color: "#e5e7eb" }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-400">
              No payment data available
            </div>
          )}
        </div>
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
  );
}

function PaymentsTab({
  payments,
  transactions,
  paymentsPage,
  paymentsTotal,
  dateFilter,
  onPageChange,
  onFetchPayments,
  onFetchTransactions,
  onDateFilterChange,
  token,
  API_BASE_URL,
  statistics,
}: {
  payments: Payment[];
  transactions: Transaction[];
  paymentsPage: number;
  paymentsTotal: number;
  dateFilter: { startDate: string; endDate: string };
  onPageChange: (page: number) => void;
  onFetchPayments: (page: number, startDate?: string, endDate?: string) => void;
  onFetchTransactions: (page: number, startDate?: string, endDate?: string) => void;
  onDateFilterChange: (filter: { startDate: string; endDate: string }) => void;
  token: string | null;
  API_BASE_URL: string;
  statistics: Statistics;
}) {
  const [viewMode, setViewMode] = useState<"payments" | "transactions">("payments");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentsPage, dateFilter, viewMode]);

  async function loadData() {
    setLoading(true);
    try {
      if (viewMode === "payments") {
        await onFetchPayments(
          paymentsPage,
          dateFilter.startDate || undefined,
          dateFilter.endDate || undefined
        );
      } else {
        await onFetchTransactions(
          paymentsPage,
          dateFilter.startDate || undefined,
          dateFilter.endDate || undefined
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function handleDateFilter() {
    onPageChange(1);
    loadData();
  }

  function clearDateFilter() {
    onDateFilterChange({ startDate: "", endDate: "" });
    onPageChange(1);
    setTimeout(loadData, 100);
  }

  // Prepare data for charts
  const chartData = useMemo(() => {
    const data = viewMode === "payments" ? payments : transactions;
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().split("T")[0];
    });

    return last30Days.map((date) => {
      const dayData = data.filter((item) => {
        const itemDate = viewMode === "payments"
          ? (item as Payment).payment_date?.split("T")[0]
          : (item as Transaction).transaction_date?.split("T")[0];
        return itemDate === date;
      });

      const amount = dayData.reduce(
        (sum, item) => sum + Number((item as Payment | Transaction).amount || 0),
        0
      );

      return {
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        amount: amount,
        count: dayData.length,
      };
    });
  }, [payments, transactions, viewMode]);

  const allPayments = viewMode === "payments" ? payments : transactions;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Payment Records & Analytics</h2>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setViewMode("payments");
              onPageChange(1);
            }}
            className={`px-4 py-2 rounded-lg transition ${
              viewMode === "payments"
                ? "bg-cyan-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            Payments
          </button>
          <button
            onClick={() => {
              setViewMode("transactions");
              onPageChange(1);
            }}
            className={`px-4 py-2 rounded-lg transition ${
              viewMode === "transactions"
                ? "bg-cyan-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            Transactions
          </button>
        </div>
      </div>

      {/* Date Filter */}
      <div className="bg-gray-800/50 rounded-lg p-4">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">Start Date</label>
            <input
              type="date"
              value={dateFilter.startDate}
              onChange={(e) =>
                onDateFilterChange({ ...dateFilter, startDate: e.target.value })
              }
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">End Date</label>
            <input
              type="date"
              value={dateFilter.endDate}
              onChange={(e) =>
                onDateFilterChange({ ...dateFilter, endDate: e.target.value })
              }
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDateFilter}
              className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition"
            >
              Apply Filter
            </button>
            <button
              onClick={clearDateFilter}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 border border-cyan-500/30 rounded-lg p-4">
          <p className="text-gray-400 text-sm">
            {viewMode === "payments" 
              ? "Total Payments" 
              : "Total Transactions (All Types)"}
          </p>
          <p className="text-2xl font-bold text-cyan-400">
            {viewMode === "payments" 
              ? allPayments.length 
              : allPayments.length}
          </p>
          {viewMode === "transactions" && (
            <p className="text-xs text-gray-500 mt-1">
              {(allPayments as Transaction[]).filter((t) => t.transaction_type === "DEBIT").length} payments,{" "}
              {(allPayments as Transaction[]).filter((t) => t.transaction_type === "CREDIT").length} credits
            </p>
          )}
        </div>
        <div className="bg-gray-800/50 border border-green-500/30 rounded-lg p-4">
          <p className="text-gray-400 text-sm">Total Amount (Top-ups Only)</p>
          <p className="text-2xl font-bold text-green-400">
            {formatRwf(
              viewMode === "payments"
                ? (allPayments as Payment[]).filter((p) => !p.booking_id) // Top-ups have no booking_id
                    .reduce((sum, p) => sum + Number(p.amount || 0), 0)
                : (allPayments as Transaction[]).filter((t) => 
                    t.transaction_type === "CREDIT" && !t.booking_id // Top-up credits have no booking_id
                  ).reduce((sum, t) => sum + Number(t.amount || 0), 0)
            )}
          </p>
        </div>
        <div className="bg-gray-800/50 border border-amber-500/30 rounded-lg p-4">
          <p className="text-gray-400 text-sm">Average Amount</p>
          <p className="text-2xl font-bold text-amber-400">
            {(() => {
              const topUpPayments = viewMode === "payments"
                ? (allPayments as Payment[]).filter((p) => !p.booking_id)
                : (allPayments as Transaction[]).filter((t) => t.transaction_type === "CREDIT" && !t.booking_id);
              const total = topUpPayments.reduce((sum, p) => sum + Number((p as Payment | Transaction).amount || 0), 0);
              return topUpPayments.length > 0
                ? formatRwf(total / topUpPayments.length)
                : "0 RWF";
            })()}
          </p>
        </div>
        <div className="bg-gray-800/50 border border-purple-500/30 rounded-lg p-4">
          <p className="text-gray-400 text-sm">System Revenue</p>
          <p className="text-2xl font-bold text-purple-400">
            ${Number(statistics.totalRevenue).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800/50 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4">
            {viewMode === "payments" ? "Payment" : "Transaction"} Amount Trend (Last 30 Days)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" tick={{ fontSize: 12 }} />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
                labelStyle={{ color: "#e5e7eb" }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#06b6d4"
                fill="#06b6d4"
                fillOpacity={0.3}
                name="Amount ($)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4">
            {viewMode === "payments" ? "Payment" : "Transaction"} Count (Last 30 Days)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" tick={{ fontSize: 12 }} />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
                labelStyle={{ color: "#e5e7eb" }}
              />
              <Legend />
              <Bar dataKey="count" fill="#10b981" name="Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-gray-800/50 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold">
            {viewMode === "payments" ? "Payment" : "Transaction"} Records
          </h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : allPayments.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No {viewMode === "payments" ? "payments" : "transactions"} found for the selected date range.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    {viewMode === "payments" ? (
                      <>
                        <th className="text-left p-4">Date</th>
                        <th className="text-left p-4">Student</th>
                        <th className="text-left p-4">Amount</th>
                        <th className="text-left p-4">Method</th>
                        <th className="text-left p-4">Status</th>
                        <th className="text-left p-4">Reference</th>
                      </>
                    ) : (
                      <>
                        <th className="text-left p-4">Date</th>
                        <th className="text-left p-4">Student</th>
                        <th className="text-left p-4">Type</th>
                        <th className="text-left p-4">Amount</th>
                        <th className="text-left p-4">Balance After</th>
                        <th className="text-left p-4">Remarks</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {allPayments.map((item) => {
                    if (viewMode === "payments") {
                      const payment = item as Payment;
                      return (
                        <tr
                          key={payment.id}
                          className="border-b border-gray-700/50 hover:bg-gray-700/30"
                        >
                          <td className="p-4">
                            {new Date(payment.payment_date).toLocaleString()}
                          </td>
                          <td className="p-4">
                            {payment.student?.user?.fullName || payment.student?.user?.email || "N/A"}
                          </td>
                          <td className="p-4 text-amber-300 font-semibold">
                            {formatRwf(payment.amount)}
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-1 bg-cyan-600/20 text-cyan-300 rounded text-sm">
                              {payment.method}
                            </span>
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-2 py-1 rounded text-sm ${
                                payment.status === "COMPLETED"
                                  ? "bg-green-600/20 text-green-300"
                                  : payment.status === "PENDING"
                                  ? "bg-yellow-600/20 text-yellow-300"
                                  : "bg-red-600/20 text-red-300"
                              }`}
                            >
                              {payment.status}
                            </span>
                          </td>
                          <td className="p-4 text-gray-400 text-sm">
                            {payment.provider_ref || "—"}
                          </td>
                        </tr>
                      );
                    } else {
                      const transaction = item as Transaction;
                      return (
                        <tr
                          key={transaction.id}
                          className="border-b border-gray-700/50 hover:bg-gray-700/30"
                        >
                          <td className="p-4">
                            {new Date(transaction.transaction_date).toLocaleString()}
                          </td>
                          <td className="p-4">
                            {transaction.student?.user?.fullName || transaction.student?.user?.email || "N/A"}
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-2 py-1 rounded text-sm ${
                                transaction.transaction_type === "CREDIT"
                                  ? "bg-green-600/20 text-green-300"
                                  : "bg-red-600/20 text-red-300"
                              }`}
                            >
                              {transaction.transaction_type}
                            </span>
                          </td>
                          <td className={`p-4 font-semibold ${
                            transaction.transaction_type === "CREDIT" ? "text-green-300" : "text-red-300"
                          }`}>
                            {transaction.transaction_type === "CREDIT" ? "+" : "-"}
                            {formatRwf(transaction.amount)}
                          </td>
                          <td className="p-4 text-gray-300">
                            {transaction.balance_after
                              ? formatRwf(transaction.balance_after)
                              : "—"}
                          </td>
                          <td className="p-4 text-gray-400 text-sm">
                            {transaction.remarks || "—"}
                          </td>
                        </tr>
                      );
                    }
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center p-4 border-t border-gray-700">
              <p className="text-gray-400">
                Showing {(paymentsPage - 1) * 20 + 1} to{" "}
                {Math.min(paymentsPage * 20, paymentsTotal)} of {paymentsTotal}{" "}
                {viewMode === "payments" ? "payments" : "transactions"}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const newPage = Math.max(1, paymentsPage - 1);
                    onPageChange(newPage);
                  }}
                  disabled={paymentsPage === 1}
                  className="px-4 py-2 bg-gray-700 disabled:opacity-50 rounded-lg transition"
                >
                  Previous
                </button>
                <button
                  onClick={() => {
                    const newPage = paymentsPage + 1;
                    onPageChange(newPage);
                  }}
                  disabled={paymentsPage * 20 >= paymentsTotal}
                  className="px-4 py-2 bg-gray-700 disabled:opacity-50 rounded-lg transition"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
