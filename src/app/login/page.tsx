import Link from "next/link";
import React from "react";

function Login() {
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
      <div className="bg-black/50 p-10 rounded-2xl text-center space-y-6">
        <h2 className="text-5xl text-cyan-400 mb-4">Choose an Option</h2>

        <div className="flex flex-col md:flex-row gap-6 justify-center">
          {/* ✅ Fixed link destinations */}
          <Link
            href="/signin"
            className="px-8 py-4 bg-cyan-500 text-black rounded-xl text-2xl hover:bg-amber-700 transition"
          >
            Login
          </Link>

          <Link
            href="/register"
            className="px-8 py-4 bg-blue-700 text-black rounded-xl text-2xl hover:bg-green-400 transition"
          >
            Register
          </Link>
        </div>
      </div>
    </main>
  );
}

export default Login;
