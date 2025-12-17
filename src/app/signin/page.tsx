"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_ENDPOINTS } from "@/lib/api-config";

export default function SignIn() {
  const router = useRouter();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(API_ENDPOINTS.AUTH.LOGIN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Invalid email or password");
      }

      const data = await res.json();
      console.log("✅ Login response:", data);

      // Accept common token keys from backend
      const token = data.accessToken || data.token || data.access_token;
      if (token) localStorage.setItem("token", token);

      // Determine and normalize role (case-insensitive)
      const role = data.user?.role || data.role || data.user?.roleName;
      const normalizedRole = role?.toString().toLowerCase();
      const effectiveRole = normalizedRole || "student";
      localStorage.setItem("role", effectiveRole);

      // Save full user info
      if (data.user) localStorage.setItem("user", JSON.stringify(data.user));

      // Redirect using normalized role (default to student dashboard)
      if (effectiveRole === "admin") router.push("/dashboard/admin");
      else if (effectiveRole === "staff") router.push("/dashboard/staff");
      else router.push("/dashboard/student");
    } catch (err: any) {
      console.error("❌ Login error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="min-h-screen flex flex-col justify-center items-center text-white"
      style={{
        backgroundImage:
          "url('https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=80')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="bg-black/60 p-10 rounded-2xl w-full max-w-md text-center">
        <h2 className="text-4xl font-bold text-cyan-400 mb-6">Sign In</h2>

        {error && (
          <p className="mb-4 text-sm text-red-400 bg-red-900/30 p-2 rounded-md">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 text-left">
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
            className="w-full py-2 mt-4 rounded-lg bg-cyan-500 text-black font-semibold text-lg hover:bg-amber-400 transition"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-gray-300 text-sm">
          Don’t have an account?{" "}
          <Link href="/register" className="text-cyan-400 hover:underline">
            Register here
          </Link>
        </p>

        <p className="mt-2 text-sm text-gray-400">
          <Link href="/" className="hover:underline">
            ← Back to options
          </Link>
        </p>
      </div>
    </main>
  );
}
