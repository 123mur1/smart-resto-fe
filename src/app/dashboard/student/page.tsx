"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL, API_ENDPOINTS } from "@/lib/api-config";

const BOOKING_ENDPOINT = API_ENDPOINTS.BOOKING.BASE;

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
  const [paymentMethod, setPaymentMethod] = useState("MOBILE_MONEY");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [selectedMeal, setSelectedMeal] = useState<MealType | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
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
  const [topUpCardNumber, setTopUpCardNumber] = useState("");
  const [topUpAccountNumber, setTopUpAccountNumber] = useState("");
  const [topUpReference, setTopUpReference] = useState("");
  const [topUpNote, setTopUpNote] = useState("");
  const [topUpError, setTopUpError] = useState("");
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [currency, setCurrency] = useState<"RWF" | "USD">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("currency") as "RWF" | "USD") || "RWF";
    }
    return "RWF";
  });

  // Currency conversion rates (RWF to USD)
  // Balance is stored in USD in the database
  const exchangeRate = 1300; // 1 USD = 1300 RWF (approximate)
  
  // Exact RWF prices - these are the actual prices users pay
  const exactRwfPrices = {
    BREAKFAST: 500,  // Exactly 500 RWF
    LUNCH: 1000,     // Exactly 1000 RWF
    DINNER: 1000,    // Exactly 1000 RWF
  };
  
  // Calculate USD prices from exact RWF amounts to avoid rounding errors
  const mealPrices = useMemo<
    Record<MealType, { label: string; price: number }>
  >(
    () => {
      if (currency === "RWF") {
        return {
          BREAKFAST: { label: "Breakfast", price: exactRwfPrices.BREAKFAST },
          LUNCH: { label: "Lunch", price: exactRwfPrices.LUNCH },
          DINNER: { label: "Dinner", price: exactRwfPrices.DINNER },
        };
      }
      
      // Convert exact RWF prices to USD
      return {
        BREAKFAST: { label: "Breakfast", price: exactRwfPrices.BREAKFAST / exchangeRate },
        LUNCH: { label: "Lunch", price: exactRwfPrices.LUNCH / exchangeRate },
        DINNER: { label: "Dinner", price: exactRwfPrices.DINNER / exchangeRate },
      };
    },
    [currency]
  );

  // Convert amount from USD (stored) to display currency
  const convertToDisplayCurrency = (amountInUSD: number): number => {
    if (currency === "RWF") {
      return amountInUSD * exchangeRate;
    }
    return amountInUSD;
  };

  // Convert amount from display currency to USD (for storage)
  // Use proper rounding to avoid floating point errors
  // For exact amounts like 500 RWF, we need to preserve precision
  const convertToUSD = (amount: number, fromCurrency: "RWF" | "USD"): number => {
    if (fromCurrency === "RWF") {
      // Use higher precision (6 decimals) for calculation, then round to 4 for storage
      // This ensures 500 RWF = 0.384615... USD exactly
      const usdAmount = amount / exchangeRate;
      // Round to 6 decimal places for precision, then to 4 for database
      return Math.round(usdAmount * 1000000) / 1000000;
    }
    return amount;
  };

  // Format currency display (amount should be in USD, will be converted for display)
  const formatCurrency = (amountInUSD: number): string => {
    const displayAmount = convertToDisplayCurrency(amountInUSD);
    if (currency === "RWF") {
      return `${Math.round(displayAmount).toLocaleString()} RWF`;
    }
    return `$${displayAmount.toFixed(2)}`;
  };

  // Format currency symbol only
  const currencySymbol = currency === "RWF" ? "RWF" : "$";

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

    // Role-based access control: Only students can access student dashboard
    const role = parsedUser.role?.toLowerCase();
    if (role === "admin" || role === "superadmin") {
      router.replace("/dashboard/admin");
      return;
    }
    if (role === "staff") {
      router.replace("/dashboard/staff");
      return;
    }
    // Allow access for students (role === "student" or "students" or undefined/default)
    if (role && role !== "student" && role !== "students") {
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
    const res = await fetch(API_ENDPOINTS.USER.BY_ID(userId), {
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
        `${API_ENDPOINTS.STUDENT.BASE}?userId=${encodeURIComponent(resolvedUser.id)}`,
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
    setPaymentMethod("MOBILE_MONEY");
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
    setCardNumber("");
    setAccountNumber("");
  }

  function openTopUpForm() {
    setShowTopUpForm(true);
    setTopUpAmount("");
    setTopUpMethod("MOBILE_MONEY");
    setTopUpMobileNumber("");
    setTopUpCardNumber("");
    setTopUpAccountNumber("");
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
    const balance = formatCurrency(numericBalance);
    const price = booking.price
      ? formatCurrency(Number(booking.price))
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
      cardNumber?: string;
      accountNumber?: string;
    }
  ) {
    const resolvedStudentId =
      studentId || localStorage.getItem("studentId") || user?.id;
    if (!user || !token || !resolvedStudentId) {
      router.replace("/login");
      return;
    }

    // Compare in USD (balance is stored in USD)
    // Use exact conversion with proper rounding
    const mealPriceInUSD = currency === "RWF" 
      ? convertToUSD(mealPrices[mealType].price, "RWF")
      : mealPrices[mealType].price;
    
    // Round to 2 decimal places to match database Decimal(10,2) precision
    // Use proper rounding to avoid floating point errors
    // For 1000 RWF: 1000/1300 = 0.769230... → round to 0.77 USD
    // When converted back: 0.77 * 1300 = 1001, so we'll round RWF display to whole numbers
    const exactPriceInUSD = Math.round(mealPriceInUSD * 100) / 100;
    
    if (numericBalance < exactPriceInUSD) {
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
          price: exactPriceInUSD, // Send exact rounded price in USD to backend (500 RWF = 0.3846 USD)
          paymentMethod: paymentDetails.method, // Send payment method to avoid defaulting to CASH
        }),
      });

      const bookingData = await bookingRes.json();
      if (!bookingRes.ok)
        throw new Error(bookingData.message || "Failed to create booking");

      const bookingId = bookingData.booking?.id;
      if (!bookingId) throw new Error("Booking id missing");

      const payRes = await fetch(API_ENDPOINTS.BOOKING.PAY(bookingId), {
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
            : Math.max(numericBalance - mealPriceInUSD, 0),
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
    // Convert meal price to display currency for comparison
    const mealPriceInDisplayCurrency = mealPrices[selectedMeal].price;
    const mealPriceInUSD = currency === "RWF" 
      ? convertToUSD(mealPriceInDisplayCurrency, "RWF")
      : mealPriceInDisplayCurrency;
    
    // Convert entered amount to USD for comparison
    const enteredAmountInUSD = convertToUSD(amountNumber, currency);
    
    if (enteredAmountInUSD < mealPriceInUSD) {
      const minAmountDisplay = currency === "RWF"
        ? `${Math.round(mealPriceInDisplayCurrency).toLocaleString()} RWF`
        : `$${mealPriceInDisplayCurrency.toFixed(2)}`;
      setPaymentError(
        `Amount must be at least ${minAmountDisplay}.`
      );
      return;
    }
    if (paymentMethod === "MOBILE_MONEY") {
      if (!mobileMoneyNumber.trim() || mobileMoneyNumber.trim().length < 6) {
        setPaymentError("Enter a valid mobile money number (at least 6 digits).");
        return;
      }
    }
    if (paymentMethod === "CARD") {
      if (!cardNumber.trim() || cardNumber.replace(/\s/g, "").length < 13) {
        setPaymentError("Enter a valid card number (minimum 13 digits).");
        return;
      }
    }
    if (paymentMethod === "BANK_TRANSIFER") {
      if (!accountNumber.trim() || accountNumber.trim().length < 5) {
        setPaymentError("Enter a valid account number (minimum 5 characters).");
        return;
      }
    }
    setPaymentError("");
    // Convert payment amount to USD before processing
    const paymentAmountInUSD = convertToUSD(amountNumber, currency);
    
    await handleBookMeal(selectedMeal, {
      method: paymentMethod,
      amount: paymentAmountInUSD, // Send in USD
      mobileMoneyNumber:
        paymentMethod === "MOBILE_MONEY" ? mobileMoneyNumber.trim() : undefined,
      cardNumber:
        paymentMethod === "CARD" ? cardNumber.trim().replace(/\s/g, "") : undefined,
      accountNumber:
        paymentMethod === "BANK_TRANSIFER" ? accountNumber.trim() : undefined,
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
    if (!topUpAmount || Number.isNaN(amountNumber)) {
      setTopUpError("Enter a valid top-up amount.");
      return;
    }
    // For RWF, minimum is 1 (whole numbers only)
    if (currency === "RWF") {
      if (amountNumber < 1 || amountNumber % 1 !== 0) {
        setTopUpError("RWF amounts must be whole numbers (minimum 1 RWF).");
        return;
      }
    } else {
      // For USD, minimum is 0.01
      if (amountNumber < 0.01) {
        setTopUpError("Minimum amount is $0.01.");
        return;
      }
    }
    if (topUpMethod === "MOBILE_MONEY") {
      if (!topUpMobileNumber.trim() || topUpMobileNumber.trim().length < 6) {
        setTopUpError("Enter a valid mobile money number.");
        return;
      }
    }
    if (topUpMethod === "CARD") {
      if (!topUpCardNumber.trim() || topUpCardNumber.trim().length < 13) {
        setTopUpError("Enter a valid card number (minimum 13 digits).");
        return;
      }
    }
    if (topUpMethod === "BANK_TRANSIFER") {
      if (!topUpAccountNumber.trim() || topUpAccountNumber.trim().length < 5) {
        setTopUpError("Enter a valid account number (minimum 5 characters).");
        return;
      }
    }
    setTopUpError("");
    setTopUpLoading(true);
    try {
      const noteParts = [
        topUpNote?.trim() || null,
        topUpMethod === "MOBILE_MONEY" && topUpMobileNumber
          ? `Mobile money ${topUpMobileNumber.trim()}`
          : null,
        topUpMethod === "CARD" && topUpCardNumber
          ? `Card ending ${topUpCardNumber.trim().replace(/\s/g, "").slice(-4)}`
          : null,
        topUpMethod === "BANK_TRANSIFER" && topUpAccountNumber
          ? `Account ${topUpAccountNumber.trim()}`
          : null,
      ].filter(Boolean);

      // Convert amount to USD before sending to backend (balance is stored in USD)
      const amountInUSD = convertToUSD(amountNumber, currency);

      const res = await fetch(API_ENDPOINTS.STUDENT.TOPUP, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          studentId: resolvedStudentId,
          amount: amountInUSD, // Send in USD
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
        message: `Successfully deposited ${formatCurrency(amountInUSD)}. New balance: ${formatCurrency(data.balance || (numericBalance + amountInUSD))}`,
      });
      // Refresh data
      await Promise.all([fetchUser(user.id), fetchBookings()]);
      // Show success for a moment before closing
      setTimeout(() => {
        closeTopUpForm();
      }, 1500);
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
              <div className="bg-linear-to-br from-amber-500/20 via-amber-400/10 to-amber-500/20 rounded-xl p-5 border-2 border-amber-400/30 shadow-lg shadow-amber-500/10">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white/70 text-sm font-medium">Meal Balance</p>
                      <select
                        value={currency}
                      onChange={(e) => {
                        const newCurrency = e.target.value as "RWF" | "USD";
                        setCurrency(newCurrency);
                        localStorage.setItem("currency", newCurrency);
                      }}
                      className="text-xs bg-white/10 border border-white/20 rounded px-2 py-0.5 text-white/80 focus:outline-none"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="RWF">RWF</option>
                      <option value="USD">USD</option>
                    </select>
                    </div>
                    <p className="text-3xl font-bold text-amber-300 mt-1">
                      {formatCurrency(numericBalance)}
                    </p>
                  </div>
                  <div className="text-4xl">💰</div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-white/60">
                    {numericBalance < 5 // Balance is in USD, compare with $5 USD
                      ? "⚠️ Low balance - Top up now to book meals"
                      : "✅ Ready to book meals"}
                  </p>
                  <button
                    onClick={openTopUpForm}
                    className="w-full rounded-lg bg-linear-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-black font-bold py-2.5 text-sm transition shadow-md shadow-amber-500/20 flex items-center justify-center gap-2"
                  >
                    <span>+</span>
                    <span>Deposit Funds</span>
                  </button>
                </div>
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
                        {currency === "RWF" 
                          ? `${Math.round(mealPrices[mealType].price).toLocaleString()} RWF`
                          : `$${mealPrices[mealType].price.toFixed(2)}`}
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
                          ? formatCurrency(latestReceipt.remainingBalance)
                          : formatCurrency(numericBalance)}
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
                            {booking.price ? formatCurrency(Number(booking.price)) : "—"}
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
                    <option value="MOBILE_MONEY">Mobile Money</option>
                    <option value="CARD">Card</option>
                    <option value="BANK_TRANSIFER">Bank Transfer</option>
                  </select>
                </div>
                {paymentMethod === "MOBILE_MONEY" && (
                  <div>
                    <label className="text-xs uppercase tracking-wide text-white/60">
                      Mobile Money Number <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="tel"
                      value={mobileMoneyNumber}
                      onChange={(e) => setMobileMoneyNumber(e.target.value)}
                      className="w-full mt-1 bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white"
                      placeholder="e.g. 2507 123 456"
                      required
                    />
                  </div>
                )}

                {paymentMethod === "CARD" && (
                  <div>
                    <label className="text-xs uppercase tracking-wide text-white/60">
                      Card Number <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => {
                        // Only allow numbers and spaces, format as user types
                        const value = e.target.value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim();
                        setCardNumber(value);
                      }}
                      className="w-full mt-1 bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white"
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                      required
                    />
                    <p className="text-xs text-white/50 mt-1">
                      Enter your card number (13-19 digits)
                    </p>
                  </div>
                )}

                {paymentMethod === "BANK_TRANSIFER" && (
                  <div>
                    <label className="text-xs uppercase tracking-wide text-white/60">
                      Account Number <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="w-full mt-1 bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white"
                      placeholder="Enter your bank account number"
                      required
                    />
                    <p className="text-xs text-white/50 mt-1">
                      Enter your bank account number
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-xs uppercase tracking-wide text-white/60">
                    Amount to pay
                  </label>
                  <input
                    type="number"
                    min={mealPrices[selectedMeal].price}
                    step={currency === "RWF" ? "1" : "0.01"}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full mt-1 bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white"
                    placeholder={currency === "RWF" 
                      ? `${Math.round(mealPrices[selectedMeal].price).toLocaleString()} RWF`
                      : `$${mealPrices[selectedMeal].price.toFixed(2)}`}
                  />
                  <p className="text-xs text-white/50 mt-1">
                    Meal price: {currency === "RWF" 
                      ? `${Math.round(mealPrices[selectedMeal].price).toLocaleString()} RWF`
                      : `$${mealPrices[selectedMeal].price.toFixed(2)}`}
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
            <div className="bg-gray-900 text-white rounded-xl w-full max-w-md border border-white/10 p-5 relative">
              <button
                onClick={closeTopUpForm}
                className="absolute top-3 right-3 text-white/60 hover:text-white transition"
              >
                ✕
              </button>
              
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Deposit Funds</h3>
                <select
                  value={currency}
                  onChange={(e) => {
                    const newCurrency = e.target.value as "RWF" | "USD";
                    setCurrency(newCurrency);
                    localStorage.setItem("currency", newCurrency);
                  }}
                  className="text-xs bg-black/30 border border-white/20 rounded px-2 py-1 text-white focus:outline-none"
                >
                  <option value="RWF">RWF</option>
                  <option value="USD">USD</option>
                </select>
              </div>

              <form className="space-y-4" onSubmit={handleTopUpSubmit}>
                {/* Quick Amount Buttons */}
                <div>
                  <label className="text-xs text-white/70 mb-2 block">Amount</label>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {(currency === "RWF" 
                      ? [5000, 10000, 20000, 50000] 
                      : [5, 10, 20, 50]
                    ).map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setTopUpAmount(amount.toString())}
                        className={`py-1.5 px-2 rounded text-sm font-medium transition ${
                          topUpAmount === amount.toString()
                            ? "bg-cyan-500 text-white"
                            : "bg-white/5 border border-white/10 hover:bg-white/10"
                        }`}
                      >
                        {currency === "RWF" ? `${(amount / 1000).toFixed(0)}k` : `$${amount}`}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={currency === "RWF" ? "1" : "0.01"}
                    step={currency === "RWF" ? "1" : "0.01"}
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    className="w-full bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                    placeholder={`Enter amount in ${currency}`}
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <label className="text-xs text-white/70 mb-2 block">Payment Method</label>
                  <select
                    value={topUpMethod}
                    onChange={(e) => setTopUpMethod(e.target.value)}
                    className="w-full bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="MOBILE_MONEY">Mobile Money</option>
                    <option value="CARD">Card</option>
                    <option value="BANK_TRANSIFER">Bank Transfer</option>
                  </select>
                </div>

                {/* Mobile Money Number */}
                {topUpMethod === "MOBILE_MONEY" && (
                  <div>
                    <label className="text-xs text-white/70 mb-2 block">
                      Mobile Money Number <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="tel"
                      value={topUpMobileNumber}
                      onChange={(e) => setTopUpMobileNumber(e.target.value)}
                      className="w-full bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                      placeholder="e.g. 2507 123 456"
                      required
                    />
                  </div>
                )}

                {/* Card Number */}
                {topUpMethod === "CARD" && (
                  <div>
                    <label className="text-xs text-white/70 mb-2 block">
                      Card Number <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={topUpCardNumber}
                      onChange={(e) => {
                        // Only allow numbers and spaces, format as user types
                        const value = e.target.value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim();
                        setTopUpCardNumber(value);
                      }}
                      className="w-full bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                      required
                    />
                    <p className="text-xs text-white/50 mt-1">
                      Enter your card number (13-19 digits)
                    </p>
                  </div>
                )}

                {/* Account Number */}
                {topUpMethod === "BANK_TRANSIFER" && (
                  <div>
                    <label className="text-xs text-white/70 mb-2 block">
                      Account Number <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={topUpAccountNumber}
                      onChange={(e) => setTopUpAccountNumber(e.target.value)}
                      className="w-full bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white focus:border-cyan-400 focus:outline-none"
                      placeholder="Enter your bank account number"
                      required
                    />
                    <p className="text-xs text-white/50 mt-1">
                      Enter your bank account number
                    </p>
                  </div>
                )}

                {/* Provider Reference - Collapsed by default */}
                <details className="text-xs">
                  <summary className="text-white/60 cursor-pointer hover:text-white/80">
                    Additional Details (Optional)
                  </summary>
                  <div className="mt-2 space-y-2">
                    <input
                      type="text"
                      value={topUpReference}
                      onChange={(e) => setTopUpReference(e.target.value)}
                      className="w-full bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:border-cyan-400 focus:outline-none"
                      placeholder="Transaction reference"
                    />
                    <input
                      type="text"
                      value={topUpNote}
                      onChange={(e) => setTopUpNote(e.target.value)}
                      className="w-full bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:border-cyan-400 focus:outline-none"
                      placeholder="Note (optional)"
                    />
                  </div>
                </details>

                {/* Error Message */}
                {topUpError && (
                  <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-300">
                    {topUpError}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={topUpLoading || !topUpAmount || Number(topUpAmount) <= 0}
                  className="w-full bg-linear-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-black font-semibold rounded-lg py-2.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {topUpLoading 
                    ? "Processing..." 
                    : `Deposit ${currency === "RWF" 
                      ? `${topUpAmount && !isNaN(Number(topUpAmount)) ? Math.round(Number(topUpAmount)).toLocaleString() : "0"} RWF`
                      : `$${topUpAmount && !isNaN(Number(topUpAmount)) ? Number(topUpAmount).toFixed(2) : "0.00"}`
                    }`
                  }
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
