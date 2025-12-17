import Link from "next/link";

const heroStats = [
  { label: "Active Students", value: "1,245+" },
  { label: "Meals Served Weekly", value: "7,800+" },
  { label: "Avg. Wait Time", value: "45s" },
  { label: "Admin Insights", value: "24/7" },
];

const features = [
  {
    title: "QR & RFID Check-in",
    desc: "Frictionless access using student IDs, QR codes or RFID cards.",
    icon: "📲",
  },
  {
    title: "Real-time Analytics",
    desc: "Monitor meal trends, inventory, and payments in a live dashboard.",
    icon: "📊",
  },
  {
    title: "Automated Reports",
    desc: "Export meal history, revenue summaries, and student insights in one click.",
    icon: "📄",
  },
];

export default function Page() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-linear-to-br from-gray-900 via-gray-950 to-black opacity-95" />
          <img
            src="https://images.unsplash.com/photo-1600891964599-f61ba0e24092?auto=format&fit=crop&w=1600&q=80"
            alt="Cafeteria"
            className="w-full h-full object-cover opacity-30"
          />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-6 py-28">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1">
              <p className="text-sm uppercase tracking-[0.4em] text-cyan-300">
                E-Campus Restaurant
              </p>
              <h1 className="text-4xl md:text-6xl font-bold mt-4 leading-tight">
                Modern, data-driven meal management for{" "}
                <span className="text-cyan-400">students & staff</span>.
              </h1>
              <p className="mt-6 text-lg text-gray-300 max-w-2xl">
                A unified platform that handles registration, verification,
                digital meal passes, staff dashboards, analytics, and automated
                reporting for your campus restaurant.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mt-10">
                <Link
                  href="/login"
                  className="px-8 py-4 rounded-full text-lg font-semibold bg-cyan-500 text-black hover:bg-cyan-400 transition shadow-lg shadow-cyan-500/20"
                >
                  Login / Register
                </Link>
                <Link
                  href="/dashboard/student"
                  className="px-8 py-4 rounded-full text-lg font-semibold border border-white/30 hover:border-cyan-400 hover:text-cyan-300 transition"
                >
                  Explore Demo Dashboard
                </Link>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-4">
              {heroStats.map((stat) => (
                <div
                  key={stat.label}
                  className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center backdrop-blur"
                >
                  <p className="text-3xl font-bold text-cyan-300">
                    {stat.value}
                  </p>
                  <p className="text-sm text-gray-300 mt-2">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-12">
          <p className="text-cyan-400 uppercase tracking-[0.4em] text-xs">
            Why choose us
          </p>
          <h2 className="text-4xl font-bold mt-4">
            Designed for modern campus experiences
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto mt-4">
            Empower administrators with insights, streamline student meal
            access, and keep staff in control with real-time data.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-linear-to-br from-white/5 to-white/0 border border-white/10 rounded-3xl p-6 hover:border-cyan-400/60 transition group"
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-2xl font-semibold mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-400">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Call to action */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="bg-linear-to-r from-cyan-500 to-blue-600 rounded-3xl p-10 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#ffffff40,transparent_50%)] pointer-events-none" />
          <div className="relative">
            <p className="uppercase tracking-[0.4em] text-xs text-white/70">
              Ready to digitize your restaurant?
            </p>
            <h3 className="text-3xl md:text-4xl font-bold mt-4">
              Launch a seamless dining experience today.
            </h3>
            <p className="text-white/80 mt-4 mb-8 max-w-3xl mx-auto">
              Connect student registration, verification, bookings, staff
              oversight, and analytics with a single secure workflow.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="px-8 py-4 rounded-full text-lg font-semibold bg-white text-cyan-600 hover:bg-white/90 transition"
              >
                Create an Account
              </Link>
              <Link
                href="/login"
                className="px-8 py-4 rounded-full text-lg font-semibold border border-white/60 text-white hover:bg-white/10 transition"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
