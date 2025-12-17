"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_ENDPOINTS } from "@/lib/api-config";

export default function Register() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    registrationNo: "",
    faculty: "",
  });
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"register" | "verify">("register");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [warning, setWarning] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOtp(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setSuccess("");
    setWarning("");

    if (!formData.fullName || !formData.phone) {
      setError("Full name and phone number are required.");
      setLoading(false);
      return;
    }

    if (!formData.registrationNo || !formData.faculty) {
      setError("Registration number and faculty are required.");
      setLoading(false);
      return;
    }

    if (!formData.email || !formData.password) {
      setError("Email and password are required.");
      setLoading(false);
      return;
    }

    try {
      // Step 1: Register user and trigger OTP
      const res = await fetch(API_ENDPOINTS.AUTH.REGISTER, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Registration failed");

      // Move to OTP verification step
      // Show warning if email failed but registration succeeded
      if (data.warning) {
        setWarning(data.warning);
      }
      setSuccess(
        data.message ||
          "Verification OTP sent to your email, please verify your account."
      );
      setStep("verify");
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setSuccess("");
    setWarning("");

    try {
      const res = await fetch(API_ENDPOINTS.AUTH.VERIFY_EMAIL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: formData.email, otp }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "OTP verification failed");

      setSuccess(data.message || "OTP verified! Redirecting to login...");
      setTimeout(() => router.push("/signin"), 1500);
    } catch (err: any) {
      setError(err.message || "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="min-h-screen flex flex-col justify-center items-center text-white"
      style={{
        backgroundImage:
          "url('https://images.unsplash.com/photo-1600891964599-f61ba0e24092?auto=format&fit=crop&w=1600&q=80')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="bg-black/60 p-10 rounded-2xl w-full max-w-lg text-center shadow-xl">
        <h2 className="text-4xl font-bold text-cyan-400 mb-6">
          {step === "register" ? "Register" : "Verify OTP"}
        </h2>

        {error && (
          <p className="mb-4 text-sm text-red-400 bg-red-900/30 p-2 rounded-md">
            {error}
          </p>
        )}
        {warning && (
          <p className="mb-4 text-sm text-yellow-400 bg-yellow-900/30 p-2 rounded-md">
            ⚠️ {warning}
          </p>
        )}
        {success && (
          <p className="mb-4 text-sm text-green-400 bg-green-900/30 p-2 rounded-md">
            {success}
          </p>
        )}

        {step === "register" ? (
          <form onSubmit={handleSubmit} className="space-y-5 text-left">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block mb-1 text-sm font-medium text-gray-300">
                  Full Name
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-400 bg-transparent p-2 text-white focus:border-cyan-400 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-300">
                  Registration Number
                </label>
                <input
                  type="text"
                  name="registrationNo"
                  value={formData.registrationNo}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-gray-400 bg-transparent p-2 text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-300">
                  Faculty / Department
                </label>
                <input
                  type="text"
                  name="faculty"
                  value={formData.faculty}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-gray-400 bg-transparent p-2 text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block mb-1 text-sm font-medium text-gray-300">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-400 bg-transparent p-2 text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block mb-1 text-sm font-medium text-gray-300">
                Phone
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-400 bg-transparent p-2 text-white focus:border-cyan-400 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block mb-1 text-sm font-medium text-gray-300">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-400 bg-transparent p-2 text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 mt-4 rounded-lg bg-cyan-500 text-black font-semibold text-lg hover:bg-amber-400 transition disabled:opacity-70"
            >
              {loading ? "Registering..." : "Register"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-5 text-left">
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-300">
                Enter OTP sent to your email
              </label>
              <input
                type="text"
                name="otp"
                value={otp}
                onChange={handleOtpChange}
                required
                className="w-full rounded-lg border border-gray-400 bg-transparent p-2 text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 mt-4 rounded-lg bg-cyan-500 text-black font-semibold text-lg hover:bg-amber-400 transition disabled:opacity-70"
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
          </form>
        )}

        <p className="mt-6 text-gray-300 text-sm">
          Already have an account?{" "}
          <Link href="/signin" className="text-cyan-400 hover:underline">
            Sign in
          </Link>
        </p>

        <p className="mt-2 text-sm text-gray-400">
          <Link href="/login" className="hover:underline">
            ← Back to options
          </Link>
        </p>
      </div>
    </main>
  );
}
