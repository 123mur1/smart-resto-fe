"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE_URL = "http://localhost:3003";
const BOOKING_ENDPOINT = `${API_BASE_URL}/booking`;

type MealType = "BREAKFAST" | "LUNCH" | "DINNER";

interface MealBooking {
  id: string;
  meal_type: MealType | string;
  status: string;
  price: number | string;
  created_at: string;
  qr_code?: string | null;
  qr_expires_at?: string | null;
}

interface User {
  id: string;
  fullName: string;
  email: string;
  role: string;
  mealBalance?: number;
}

interface StudentProfile {
  id: string;
  registrationNumber?: string;
  registration_no?: string;
  department?: string;
  balance?: number | string;
  meal_balance?: number | string;
  mealBalance?: number;
}

interface PaymentReceipt {
  mealType: MealType;
  mealLabel: string;
  paymentMethod: string;
  amountPaid: number;
  qrCode?: string | null;
  timestamp: string;
  mobileMoneyNumber?: string;
  remainingBalance?: number;
}

interface ToastState {
  type: "success" | "error";
  message: string;
}

export default function StudentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [bookings, setBookings] = useState<MealBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [bookingInProgress, setBookingInProgress] = useState<MealType | null>(
    null
  );
  const [refreshing, setRefreshing] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [selectedMeal, setSelectedMeal] = useState<MealType | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState("");
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(
    null
  );
  const [latestReceipt, setLatestReceipt] = useState<PaymentReceipt | null>(
    null
  );
  const numericBalance = useMemo(() => {
    const rawProfileBalance =
      studentProfile?.balance ??
      studentProfile?.meal_balance ??
      studentProfile?.mealBalance ??
      null;
    const profileBalance =
      typeof rawProfileBalance === "number"
        ? rawProfileBalance
        : rawProfileBalance
        ? Number(rawProfileBalance)
        : null;
    const userBalance =
      typeof user?.mealBalance === "number"
        ? user.mealBalance
        : user?.mealBalance
        ? Number(user.mealBalance)
        : null;
    return profileBalance ?? userBalance ?? 0;
  }, [studentProfile, user]);

  const registrationNumber = useMemo(() => {
    return (
      studentProfile?.registrationNumber ||
      studentProfile?.registration_no ||
      studentId ||
      "N/A"
    );
  }, [studentProfile, studentId]);
  const [showTopUpForm, setShowTopUpForm] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpMethod, setTopUpMethod] = useState("MOBILE_MONEY");
  const [topUpMobileNumber, setTopUpMobileNumber] = useState("");
  const [topUpReference, setTopUpReference] = useState("");
  const [topUpNote, setTopUpNote] = useState("");
  const [topUpError, setTopUpError] = useState("");
  const [topUpLoading, setTopUpLoading] = useState(false);

  const mealPrices = useMemo<
    Record<MealType, { label: string; price: number }>
  >(
    () => ({
      BREAKFAST: { label: "Breakfast", price: 5 },
      LUNCH: { label: "Lunch", price: 8 },
      DINNER: { label: "Dinner", price: 10 },
    }),
    []
  );

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

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

    setUser(parsedUser);
    loadDashboard(parsedUser.id);
  }, [router, token]);

  async function loadDashboard(userId: string) {
    setLoading(true);
    try {
      const resolvedStudentId = await fetchUser(userId);
      if (resolvedStudentId) {
        await fetchBookings(resolvedStudentId);
      }
    } catch (err: any) {
      console.error("Dashboard fetch error:", err);
      setError(err.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function fetchUser(userId: string) {
    if (!token) return null;
    const res = await fetch(`${API_BASE_URL}/user/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || "Unable to fetch student profile");
    }

    const data = await res.json();
    const resolvedUser = data?.user || data;
    const normalizedUser =
      resolvedUser && typeof resolvedUser === "object"
        ? {
            ...resolvedUser,
            mealBalance:
              resolvedUser.mealBalance ??
              resolvedUser.meal_balance ??
              resolvedUser.mealCredits ??
              0,
          }
        : resolvedUser;

    setUser(normalizedUser);
    if (normalizedUser)
      localStorage.setItem("user", JSON.stringify(normalizedUser));

    // Attempt to fetch student profile to grab studentId
    try {
      const studentRes = await fetch(
        `${API_BASE_URL}/student?userId=${encodeURIComponent(resolvedUser.id)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (studentRes.ok) {
        const studentRecord = await studentRes.json();
        if (studentRecord?.id) {
          const normalizedStudent = {
            ...studentRecord,
            balance:
              studentRecord.balance !== undefined &&
              studentRecord.balance !== null
                ? Number(studentRecord.balance)
                : studentRecord.meal_balance !== undefined &&
                  studentRecord.meal_balance !== null
                ? Number(studentRecord.meal_balance)
                : studentRecord.mealBalance !== undefined &&
                  studentRecord.mealBalance !== null
                ? Number(studentRecord.mealBalance)
                : undefined,
          };
          setStudentId(studentRecord.id);
          setStudentProfile(normalizedStudent);
          localStorage.setItem("studentId", studentRecord.id);
          setUser((prev) => {
            if (!prev) return prev;
            const updatedUser = {
              ...prev,
              mealBalance:
                normalizedStudent.balance ??
                studentRecord.meal_balance ??
                studentRecord.mealBalance ??
                studentRecord.mealCredits ??
                prev.mealBalance ??
                0,
            };
            localStorage.setItem("user", JSON.stringify(updatedUser));
            return updatedUser;
          });
          return studentRecord.id;
        }
      }
    } catch (err) {
      console.warn("Unable to fetch student profile", err);
    }
    return null;
  }

  async function fetchBookings(studentIdOverride?: string) {
    const resolvedStudentId =
      studentIdOverride ||
      studentId ||
      localStorage.getItem("studentId") ||
      null;
    if (!token || !resolvedStudentId) return;
    const res = await fetch(
      `${BOOKING_ENDPOINT}?studentId=${encodeURIComponent(resolvedStudentId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || "Unable to fetch booking history");
    }

    const data = await res.json();
    setBookings(data || []);
  }

  function openPaymentForm(mealType: MealType) {
    setSelectedMeal(mealType);
    setPaymentMethod("CASH");
    setPaymentAmount(mealPrices[mealType].price.toString());
    setPaymentError("");
    setShowPaymentForm(true);
    setMobileMoneyNumber("");
  }

  function closePaymentForm() {
    setShowPaymentForm(false);
    setSelectedMeal(null);
    setPaymentError("");
    setPaymentAmount("");
    setMobileMoneyNumber("");
  }

  function openTopUpForm() {
    setShowTopUpForm(true);
    setTopUpAmount("");
    setTopUpMethod("MOBILE_MONEY");
    setTopUpMobileNumber("");
    setTopUpReference("");
    setTopUpNote("");
    setTopUpError("");
  }

  function closeTopUpForm() {
    setShowTopUpForm(false);
    setTopUpError("");
    setTopUpLoading(false);
  }

  function handleDownloadReceipt(booking: MealBooking) {
    if (!user) return;
    const studentName = user.fullName || "Student";
    const resolvedRegistration = registrationNumber || "N/A";
    const mealLabel =
      mealPrices[booking.meal_type as MealType]?.label || booking.meal_type;
    const date = new Date(booking.created_at).toLocaleString();
    const balance = `$${numericBalance.toFixed(2)}`;
    const price = booking.price
      ? `$${Number(booking.price).toFixed(2)}`
      : "N/A";

    const receiptLines = [
      "Smart Campus Restaurant",
      "Meal Receipt",
      "-----------------------------------",
      `Student Name: ${studentName}`,
      `Registration No: ${resolvedRegistration}`,
      `Meal Type: ${mealLabel}`,
      `Price: ${price}`,
      `Booking Status: ${booking.status}`,
      `QR Code: ${booking.qr_code || "Pending"}`,
      `Date: ${date}`,
      `Remaining Balance: ${balance}`,
    ];

    const pdfContent = createSimplePdf(receiptLines);
    const blob = new Blob([pdfContent], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `receipt-${booking.id}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function handleBookMeal(
    mealType: MealType,
    paymentDetails: {
      method: string;
      amount: number;
      mobileMoneyNumber?: string;
    }
  ) {
    const resolvedStudentId =
      studentId || localStorage.getItem("studentId") || user?.id;
    if (!user || !token || !resolvedStudentId) {
      router.replace("/login");
      return;
    }

    const mealPrice = mealPrices[mealType].price;
    if (numericBalance < mealPrice) {
      setToast({
        type: "error",
        message: "Insufficient balance. Please top up before booking.",
      });
      return;
    }
    setBookingInProgress(mealType);
    setToast(null);
    setBookingLoading(true);

    try {
      const bookingRes = await fetch(BOOKING_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId: resolvedStudentId,
          mealType,
          price: mealPrices[mealType].price,
        }),
      });

      const bookingData = await bookingRes.json();
      if (!bookingRes.ok)
        throw new Error(bookingData.message || "Failed to create booking");

      const bookingId = bookingData.booking?.id;
      if (!bookingId) throw new Error("Booking id missing");

      const payRes = await fetch(`${BOOKING_ENDPOINT}/${bookingId}/pay`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentMethod: paymentDetails.method,
        }),
      });

      const payData = await payRes.json();
      if (!payRes.ok)
        throw new Error(payData.message || "Failed to confirm payment");

      setToast({
        type: "success",
        message: "Booking confirmed and QR code generated.",
      });
      setLatestReceipt({
        mealType,
        mealLabel: mealPrices[mealType].label,
        paymentMethod: paymentDetails.method,
        amountPaid: paymentDetails.amount,
        mobileMoneyNumber: paymentDetails.mobileMoneyNumber,
        qrCode:
          payData?.booking?.qr_code ||
          payData?.qrCode ||
          bookingData?.booking?.qr_code ||
          null,
        remainingBalance:
          typeof payData?.remainingBalance === "number"
            ? payData.remainingBalance
            : Math.max(numericBalance - mealPrices[mealType].price, 0),
        timestamp: new Date().toISOString(),
      });
      await Promise.all([fetchBookings(), fetchUser(user.id)]);
    } catch (err: any) {
      setToast({
        type: "error",
        message: err.message || "Failed to book meal",
      });
    } finally {
      setBookingInProgress(null);
      setBookingLoading(false);
      closePaymentForm();
    }
  }

  async function handlePaymentSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedMeal) return;
    const amountNumber = Number(paymentAmount);
    if (!paymentAmount || Number.isNaN(amountNumber) || amountNumber <= 0) {
      setPaymentError("Please enter a valid payment amount.");
      return;
    }
    if (amountNumber < mealPrices[selectedMeal].price) {
      setPaymentError(
        `Amount must be at least $${mealPrices[selectedMeal].price.toFixed(2)}.`
      );
      return;
    }
    if (
      paymentMethod === "MOBILE_MONEY" &&
      (!mobileMoneyNumber.trim() || mobileMoneyNumber.trim().length < 6)
    ) {
      setPaymentError("Enter a valid mobile money number (at least 6 digits).");
      return;
    }
    setPaymentError("");
    await handleBookMeal(selectedMeal, {
      method: paymentMethod,
      amount: amountNumber,
      mobileMoneyNumber:
        paymentMethod === "MOBILE_MONEY" ? mobileMoneyNumber.trim() : undefined,
    });
  }

  async function handleTopUpSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const resolvedStudentId =
      studentId || localStorage.getItem("studentId") || user.id;
    if (!resolvedStudentId) {
      setTopUpError("Unable to resolve student account. Please re-login.");
      return;
    }
    const amountNumber = Number(topUpAmount);
    if (!topUpAmount || Number.isNaN(amountNumber) || amountNumber <= 0) {
      setTopUpError("Enter a valid top-up amount.");
      return;
    }
    if (
      topUpMethod === "MOBILE_MONEY" &&
      (!topUpMobileNumber.trim() || topUpMobileNumber.trim().length < 6)
    ) {
      setTopUpError("Enter a valid mobile money number.");
      return;
    }
    setTopUpError("");
    setTopUpLoading(true);
    try {
      const noteParts = [
        topUpNote?.trim() || null,
        topUpMethod === "MOBILE_MONEY" && topUpMobileNumber
          ? `Mobile money ${topUpMobileNumber.trim()}`
          : null,
      ].filter(Boolean);

      const res = await fetch(`${API_BASE_URL}/student/topup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          studentId: resolvedStudentId,
          amount: amountNumber,
          paymentMethod: topUpMethod,
          providerReference: topUpReference || undefined,
          note: noteParts.length > 0 ? noteParts.join(" | ") : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to top up balance.");
      }
      setToast({
        type: "success",
        message: "Balance added successfully.",
      });
      await Promise.all([fetchUser(user.id), fetchBookings()]);
      closeTopUpForm();
    } catch (err: any) {
      setTopUpError(err.message || "Unable to process top-up.");
    } finally {
      setTopUpLoading(false);
    }
  }

  async function handleRefresh() {
    if (!user) return;
    setRefreshing(true);
    await loadDashboard(user.id);
    setRefreshing(false);
  }

  if (loading)
    return (
      <p className="text-center mt-10 text-white">Loading dashboard...</p>
    );
  if (error)
    return (
      <p className="text-center mt-10 text-red-400 bg-red-900/30 p-2 rounded">
        {error}
      </p>
    );

  return (
    <main
      className="min-h-screen flex flex-col items-center text-white p-6"
      style={{
        backgroundImage:
          "url('https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=80')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="bg-black/60 w-full max-w-5xl p-6 rounded-2xl shadow-2xl border border-white/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-sm uppercase tracking-wide text-white/60">
              Smart Campus restaraunt
            </p>
            <h1 className="text-3xl font-bold text-cyan-400">
              🎓 Student Dashboard
            </h1>
            <p className="text-white/70 text-sm mt-1">
              Track meals, balance, and bookings in one place
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-5 py-2 rounded-lg border border-cyan-400 text-cyan-400 hover:bg-cyan-400/10 transition disabled:opacity-60"
          >
            {refreshing ? "Refreshing..." : "Refresh data"}
          </button>
        </div>

        {toast && (
          <div
            className={`mb-4 rounded-md p-3 text-sm ${
              toast.type === "success"
                ? "bg-green-900/30 text-green-300 border border-green-500/40"
                : "bg-red-900/30 text-red-300 border border-red-500/40"
            }`}
          >
            {toast.message}
          </div>
        )}

        {user && (
          <>
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white/10 rounded-xl p-4 border border-white/10">
                <p className="text-white/70 text-sm">Welcome</p>
                <p className="text-xl font-semibold">{user.fullName}</p>
                <p className="text-xs text-white/60 mt-1">{user.email}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-4 border border-white/10">
                <p className="text-white/70 text-sm">Meal Balance</p>
                <p className="text-3xl font-bold text-amber-300">
                  ${numericBalance.toFixed(2)}
                </p>
                <p className="text-xs text-white/60 mt-1">
                  Top up before booking your meals
                </p>
                <button
                  onClick={openTopUpForm}
                  className="mt-3 w-full rounded-lg border border-amber-300 text-amber-200 py-1 text-sm hover:bg-amber-300/10 transition"
                >
                  + Add balance
                </button>
              </div>
              <div className="bg-white/10 rounded-xl p-4 border border-white/10">
                <p className="text-white/70 text-sm">Recent Activity</p>
                <p className="text-xl font-semibold">
                  {bookings.length > 0
                    ? bookings[0].meal_type
                    : "No meals booked"}
                </p>
                <p className="text-xs text-white/60 mt-1">
                  {bookings.length > 0
                    ? new Date(bookings[0].created_at).toLocaleString()
                    : "Book your first meal"}
                </p>
              </div>
            </section>

            <section className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-lg">Quick meal booking</h2>
                <p className="text-sm text-white/60">
                  Choose a meal slot, pay, and get your QR instantly
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(Object.keys(mealPrices) as MealType[]).map((mealType) => (
                  <div
                    key={mealType}
                    className="rounded-2xl bg-white/10 border border-white/10 p-4 flex flex-col gap-2"
                  >
                    <div>
                      <p className="text-lg font-semibold">
                        {mealPrices[mealType].label}
                      </p>
                      <p className="text-sm text-white/70">
                        {mealType === "BREAKFAST"
                          ? "Start your day energized"
                          : mealType === "LUNCH"
                          ? "Midday meal to recharge"
                          : "Evening meal to unwind"}
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-amber-300">
                      ${mealPrices[mealType].price.toFixed(2)}
                    </p>
                    <button
                      onClick={() => openPaymentForm(mealType)}
                      disabled={
                        bookingInProgress === mealType || bookingLoading || !user
                      }
                      className="mt-auto bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg py-2 transition disabled:opacity-70"
                    >
                      {bookingInProgress === mealType || bookingLoading
                        ? "Processing..."
                        : `Book ${mealPrices[mealType].label}`}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {latestReceipt && (
              <section className="mb-8">
                <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-white">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-base text-emerald-200">
                      Latest Receipt
                    </h3>
                    <span className="text-xs text-white/70">
                      {new Date(latestReceipt.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <p className="text-white/70 text-xs uppercase tracking-wide">
                        Student
                      </p>
                      <p className="font-medium">
                        {user.fullName} ({registrationNumber || "N/A"})
                      </p>
                    </div>
                    <div>
                      <p className="text-white/70 text-xs uppercase tracking-wide">
                        Meal
                      </p>
                      <p className="font-medium">{latestReceipt.mealLabel}</p>
                    </div>
                    <div>
                      <p className="text-white/70 text-xs uppercase tracking-wide">
                        Payment
                      </p>
                      <p className="font-medium">
                        {latestReceipt.paymentMethod} · $
                        {latestReceipt.amountPaid.toFixed(2)}
                      </p>
                      {latestReceipt.paymentMethod === "MOBILE_MONEY" &&
                        latestReceipt.mobileMoneyNumber && (
                          <p className="text-xs text-white/60">
                            {latestReceipt.mobileMoneyNumber}
                          </p>
                        )}
                    </div>
                    <div>
                      <p className="text-white/70 text-xs uppercase tracking-wide">
                        Remaining balance
                      </p>
                      <p className="font-medium">
                        {typeof latestReceipt.remainingBalance === "number"
                          ? `$${latestReceipt.remainingBalance.toFixed(2)}`
                          : `$${numericBalance.toFixed(2)}`}
                      </p>
                    </div>
                    <div>
                      <p className="text-white/70 text-xs uppercase tracking-wide">
                        QR Code
                      </p>
                      <p className="font-mono text-xs">
                        {latestReceipt.qrCode || "Pending"}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-lg">My bookings & QR codes</h2>
                <p className="text-sm text-white/60">
                  Showing the latest {bookings.length} bookings
                </p>
              </div>

              {bookings.length > 0 ? (
                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/10 text-white/80 uppercase text-xs tracking-wide">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Meal</th>
                        <th className="px-4 py-3">Price</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">QR Code</th>
                        <th className="px-4 py-3">Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((booking) => (
                        <tr key={booking.id} className="border-t border-white/10">
                          <td className="px-4 py-3 text-white/80">
                            {new Date(booking.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            {mealPrices[booking.meal_type as MealType]?.label ||
                              booking.meal_type}
                          </td>
                          <td className="px-4 py-3 text-amber-200">
                            ${booking.price ? Number(booking.price).toFixed(2) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-3 py-1 rounded-full text-xs ${
                                booking.status === "CONSUMED"
                                  ? "bg-green-500/20 text-green-300"
                                  : booking.status === "PAID"
                                  ? "bg-cyan-500/20 text-cyan-200"
                                  : booking.status === "PENDING_PAYMENT"
                                  ? "bg-yellow-500/20 text-yellow-300"
                                  : "bg-red-500/20 text-red-300"
                              }`}
                            >
                              {booking.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {booking.qr_code && booking.status === "PAID" ? (
                              <div className="text-xs text-white">
                                <p className="font-mono">{booking.qr_code}</p>
                                <p className="text-[10px] text-white/60">
                                  Expires:{" "}
                                  {booking.qr_expires_at
                                    ? new Date(
                                        booking.qr_expires_at
                                      ).toLocaleTimeString()
                                    : "N/A"}
                                </p>
                              </div>
                            ) : (
                              <span className="text-white/50 text-xs">
                                {booking.status === "CONSUMED"
                                  ? "Used"
                                  : "Not available"}
                              </span>
                            )}
                          </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleDownloadReceipt(booking)}
                                className="text-xs bg-white/10 border border-white/20 rounded-full px-3 py-1 hover:bg-white/20 transition"
                              >
                                Download
                              </button>
                            </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-white/10 border border-dashed border-white/30 rounded-2xl p-6 text-center text-white/70">
                  No bookings yet. Book your first meal to see QR codes here.
                </div>
              )}
            </section>
          </>
        )}

        {showPaymentForm && selectedMeal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 text-white rounded-2xl w-full max-w-md border border-white/10 p-6 relative">
              <button
                onClick={closePaymentForm}
                className="absolute top-3 right-3 text-white/60 hover:text-white"
              >
                ✕
              </button>
              <h3 className="text-xl font-semibold mb-1">
                Book {mealPrices[selectedMeal].label}
              </h3>
              <p className="text-sm text-white/60 mb-4">
                Provide your payment details to continue.
              </p>
              <form className="space-y-4" onSubmit={handlePaymentSubmit}>
                <div>
                  <label className="text-xs uppercase tracking-wide text-white/60">
                    Payment method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full mt-1 bg-black/30 border border-white/20 rounded-lg px-3 py-2"
                  >
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="MOBILE_MONEY">Mobile money</option>
                  </select>
                </div>
                {paymentMethod === "MOBILE_MONEY" && (
                  <div>
                    <label className="text-xs uppercase tracking-wide text-white/60">
                      Mobile money number
                    </label>
                    <input
                      type="tel"
                      value={mobileMoneyNumber}
                      onChange={(e) => setMobileMoneyNumber(e.target.value)}
                      className="w-full mt-1 bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white"
                      placeholder="e.g. 2507 123 456"
                    />
                  </div>
                )}
                <div>
                  <label className="text-xs uppercase tracking-wide text-white/60">
                    Amount to pay
                  </label>
                  <input
                    type="number"
                    min={mealPrices[selectedMeal].price}
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full mt-1 bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white"
                    placeholder={`$${mealPrices[selectedMeal].price.toFixed(2)}`}
                  />
                  <p className="text-xs text-white/50 mt-1">
                    Meal price: ${mealPrices[selectedMeal].price.toFixed(2)}
                  </p>
                </div>
                {paymentError && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">
                    {paymentError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={bookingLoading}
                  className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg py-3 transition disabled:opacity-70"
                >
                  {bookingLoading ? "Processing..." : "Pay & Generate QR"}
                </button>
              </form>
            </div>
          </div>
        )}

        {showTopUpForm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 text-white rounded-2xl w-full max-w-md border border-white/10 p-6 relative">
              <button
                onClick={closeTopUpForm}
                className="absolute top-3 right-3 text-white/60 hover:text-white"
              >
                ✕
              </button>
              <h3 className="text-xl font-semibold mb-1">Top up balance</h3>
              <p className="text-sm text-white/60 mb-4">
                Add funds to your wallet before booking meals.
              </p>
              <form className="space-y-4" onSubmit={handleTopUpSubmit}>
                <div>
                  <label className="text-xs uppercase tracking-wide text-white/60">
                    Amount to add
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    className="w-full mt-1 bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white"
                    placeholder="e.g. 25"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide text-white/60">
                    Payment method
                  </label>
                  <select
                    value={topUpMethod}
                    onChange={(e) => setTopUpMethod(e.target.value)}
                    className="w-full mt-1 bg-black/30 border border-white/20 rounded-lg px-3 py-2"
                  >
                    <option value="MOBILE_MONEY">Mobile money</option>
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="BANK_TRANSIFER">Bank transfer</option>
                  </select>
                </div>
                {topUpMethod === "MOBILE_MONEY" && (
                  <div>
                    <label className="text-xs uppercase tracking-wide text-white/60">
                      Mobile money number
                    </label>
                    <input
                      type="tel"
                      value={topUpMobileNumber}
                      onChange={(e) => setTopUpMobileNumber(e.target.value)}
                      className="w-full mt-1 bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white"
                      placeholder="e.g. 2507 123 456"
                    />
                  </div>
                )}
                <div>
                  <label className="text-xs uppercase tracking-wide text-white/60">
                    Provider reference (optional)
                  </label>
                  <input
                    type="text"
                    value={topUpReference}
                    onChange={(e) => setTopUpReference(e.target.value)}
                    className="w-full mt-1 bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white"
                    placeholder="Receipt or transaction code"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide text-white/60">
                    Note (optional)
                  </label>
                  <textarea
                    value={topUpNote}
                    onChange={(e) => setTopUpNote(e.target.value)}
                    className="w-full mt-1 bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white"
                    rows={2}
                    placeholder="Any helpful note"
                  />
                </div>
                <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded p-2">
                  Funds will be deducted automatically every time you pay for a
                  meal. Make sure the top-up amount covers your planned meals.
                </p>
                {topUpError && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">
                    {topUpError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={topUpLoading}
                  className="w-full bg-amber-400 hover:bg-amber-300 text-black font-semibold rounded-lg py-3 transition disabled:opacity-70"
                >
                  {topUpLoading ? "Processing..." : "Add balance"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function createSimplePdf(lines: string[]) {
  const streamContent = buildTextStream(lines);
  const streamLength = streamContent.length;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((obj, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefPosition = pdf.length;
  const totalObjects = objects.length + 1;

  pdf += `xref\n0 ${totalObjects}\n0000000000 65535 f \n`;
  for (let i = 1; i < totalObjects; i++) {
    pdf += `${offsets[i].toString().padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${totalObjects} /Root 1 0 R >>\nstartxref\n${xrefPosition}\n%%EOF`;
  return pdf;
}

function buildTextStream(lines: string[]) {
  const sanitized = lines.map(escapePdfText);
  const textLines = ["BT", "/F1 14 Tf"];
  let y = 780;
  sanitized.forEach((line) => {
    textLines.push(`1 0 0 1 72 ${y} Tm`);
    textLines.push(`(${line}) Tj`);
    y -= 18;
  });
  textLines.push("ET");
  return textLines.join("\n");
}

function escapePdfText(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
