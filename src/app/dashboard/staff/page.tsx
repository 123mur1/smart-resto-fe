"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_ENDPOINTS } from "@/lib/api-config";

const QRScanner = dynamic(() => import("../../components/QRScanner"), {
  ssr: false,
});

const VERIFY_ENDPOINT = API_ENDPOINTS.BOOKING.VERIFY;
const HISTORY_ENDPOINT = API_ENDPOINTS.BOOKING.BASE;

type ScanStatus = "approved" | "rejected" | "pending";

interface StaffUser {
  id: string;
  fullName?: string;
  email: string;
  role: string;
}

interface ScanRecord {
  id: string;
  studentName: string;
  mealType: string;
  timestamp: string;
  status: ScanStatus;
  source: "camera" | "manual";
  message?: string;
}

export default function StaffDashboard() {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanRecord[]>([]);
  const [manualCode, setManualCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (!storedToken) {
      router.replace("/login");
      return;
    }

    if (!storedUser) {
      router.replace("/login");
      return;
    }

    const parsedUser = JSON.parse(storedUser);
    const role = parsedUser.role?.toLowerCase();

    // Role-based access control: Only staff can access staff dashboard
    if (role !== "staff") {
      // Redirect to appropriate dashboard based on role
      if (role === "admin" || role === "superadmin") {
        router.replace("/dashboard/admin");
      } else {
        router.replace("/dashboard/student");
      }
      return;
    }

    setToken(storedToken);
    setStaff(parsedUser);
    fetchRecentScans(storedToken);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayScans = scanHistory.filter(
      (scan) => new Date(scan.timestamp).toDateString() === today
    );
    return {
      today: todayScans.length,
      approved: todayScans.filter((scan) => scan.status === "approved").length,
      rejected: todayScans.filter((scan) => scan.status === "rejected").length,
    };
  }, [scanHistory]);

  async function fetchRecentScans(authToken: string) {
    try {
      const res = await fetch(HISTORY_ENDPOINT, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const mapped: ScanRecord[] = (data || []).map((booking: any) => {
        const status =
          booking.status === "CONSUMED"
            ? "approved"
            : booking.status === "CANCELLED"
            ? "rejected"
            : "pending";
        return {
          id: booking.id,
          studentName:
            booking.student?.user?.fullName ||
            booking.student?.registration_no ||
            booking.student_id,
          mealType: booking.meal_type || "Meal",
          timestamp: booking.updated_at || booking.created_at,
          status,
          source: "camera",
          message: booking.payment?.status,
        };
      });
      setScanHistory(mapped);
    } catch (error) {
      console.error("Failed to fetch recent scans", error);
    }
  }

  async function verifyAccess(payload: {
    code: string;
    source: "camera" | "manual";
  }) {
    if (!token) {
      setToast({ type: "error", message: "You are not authenticated. Please sign in again." });
      router.replace("/login");
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch(VERIFY_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ qrCode: payload.code }),
      });

      let status: ScanStatus = "approved";
      let message = "Access granted";
      let responseData: any = {};

      if (!res.ok) {
        const errorText = await res.text();
        try {
          responseData = JSON.parse(errorText);
          message = responseData.message || "Failed to validate QR code";
        } catch {
          message = errorText || "Failed to validate QR code";
        }
        status = "rejected";
      } else {
        responseData = await res.json();
        message = responseData.message || "Access granted";
      }

      const record: ScanRecord = {
        id: responseData?.record?.id || crypto.randomUUID(),
        studentName: responseData?.student?.fullName || payload.code,
        mealType: responseData?.meal?.meal_type || "Meal",
        timestamp: new Date().toISOString(),
        status,
        source: payload.source,
        message,
      };

      setScanHistory((prev) => [record, ...prev].slice(0, 10));
      setToast({ type: status === "approved" ? "success" : "error", message });
    } catch (error: any) {
      console.error("QR verification failed:", error);
      setToast({
        type: "error",
        message: error.message || "Unable to verify QR code at the moment.",
      });
    } finally {
      setVerifying(false);
    }
  }

  function handleScan(data: string) {
    verifyAccess({ code: data, source: "camera" });
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualCode.trim()) {
      setToast({ type: "error", message: "Enter a QR or student code first." });
      return;
    }
    await verifyAccess({ code: manualCode.trim(), source: "manual" });
    setManualCode("");
  }

  if (loading) {
    return (
      <p className="text-center mt-10 text-white/80">Loading staff dashboard...</p>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      {toast && (
        <div
          className={`fixed top-5 right-5 px-4 py-3 rounded-xl shadow-lg ${
            toast.type === "success"
              ? "bg-green-500/20 text-green-300 border border-green-400/30"
              : "bg-red-500/20 text-red-300 border border-red-400/30"
          }`}
        >
          {toast.message}
        </div>
      )}

      <header className="max-w-6xl mx-auto mb-10">
        <p className="text-sm uppercase tracking-[0.4em] text-cyan-300">
          Staff Portal
        </p>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
          <div>
            <h1 className="text-3xl font-bold">QR Verification Console</h1>
            <p className="text-gray-400 mt-2">
              Scan student meal passes, validate QR codes, and monitor access in real time.
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3">
            <p className="text-sm text-gray-400">Signed in as</p>
            <p className="font-semibold">
              {staff?.fullName || staff?.email || "Staff member"}
            </p>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto grid gap-6 md:grid-cols-2 mb-10">
        <StatsCard label="Validations today" value={stats.today} accent="from-cyan-500 to-blue-500" />
        <div className="grid grid-cols-2 gap-4">
          <StatsCard label="Approved" value={stats.approved} accent="from-green-500 to-emerald-500" />
          <StatsCard label="Rejected" value={stats.rejected} accent="from-red-500 to-rose-500" />
        </div>
      </section>

      <section className="max-w-6xl mx-auto grid gap-8 lg:grid-cols-2">
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-1">Live QR Scanner</h2>
            <p className="text-gray-400 text-sm">
              Present a student QR over the camera feed to validate their meal.
            </p>
          </div>
          <QRScanner onScan={handleScan} />
          <p className="text-xs text-gray-500">
            Having trouble? Use the manual entry card to type a code.
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
            <h2 className="text-xl font-semibold mb-3">Manual Entry</h2>
            <p className="text-gray-400 text-sm mb-4">
              Type a student ID, registration number, or QR value if the camera cannot read.
            </p>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="e.g. STUDENT-QR-1029"
                className="w-full rounded-2xl bg-gray-900 border border-white/10 px-4 py-3 focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                disabled={verifying}
                className="w-full py-3 rounded-2xl bg-cyan-500 text-black font-semibold hover:bg-cyan-400 transition disabled:opacity-50"
              >
                {verifying ? "Verifying..." : "Validate Code"}
              </button>
            </form>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
            <h2 className="text-xl font-semibold mb-3">Recent Validations</h2>
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {scanHistory.length === 0 && (
                <p className="text-gray-400 text-sm">No scans yet. Start by validating a QR.</p>
              )}
              {scanHistory.map((scan) => (
                <ScanItem key={scan.id} record={scan} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function StatsCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div
      className={`rounded-3xl p-6 bg-gradient-to-br ${accent} text-white shadow-lg border border-white/10`}
    >
      <p className="text-sm uppercase tracking-[0.3em] text-white/70">{label}</p>
      <p className="text-4xl font-bold mt-4">{value}</p>
    </div>
  );
}

function ScanItem({ record }: { record: ScanRecord }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-gray-950/60 border border-white/5 px-4 py-3">
      <div>
        <p className="font-semibold">{record.studentName}</p>
        <p className="text-sm text-gray-400">
          {record.mealType} • {new Date(record.timestamp).toLocaleTimeString()}
        </p>
      </div>
      <span
        className={`px-3 py-1 rounded-full text-xs uppercase tracking-wide ${
          record.status === "approved"
            ? "bg-green-500/20 text-green-300"
            : record.status === "rejected"
            ? "bg-red-500/20 text-red-300"
            : "bg-yellow-500/20 text-yellow-300"
        }`}
      >
        {record.status}
      </span>
    </div>
  );
}

