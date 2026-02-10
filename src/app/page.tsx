"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Users,
  Leaf,
  Cloud,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  Bug,
  ChevronRight,
  Loader2,
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const { session, userRole, loading, roleLoading, signOut } = useAuth();
  const isAdmin = userRole?.role === "admin";

  const adminMenuItems = [
    {
      id: "users",
      title: "Users Management",
      subtitle: "View & manage all users",
      icon: Users,
      color: "#06923E",
      route: "/admin/users",
    },
    {
      id: "lands",
      title: "Cultivated Lands",
      subtitle: "All registered agricultural lands",
      icon: Leaf,
      color: "#06923E",
      route: "/admin/lands",
    },
    {
      id: "weather",
      title: "Weather Reports",
      subtitle: "Monitor weather data",
      icon: Cloud,
      color: "#E67514",
      route: "/admin/weather",
    },
    {
      id: "observations",
      title: "Field Observations",
      subtitle: "Review farmer submissions",
      icon: Bug,
      color: "#06923E",
      route: "/admin/observations",
    },
    {
      id: "disasters",
      title: "Disaster Reports",
      subtitle: "Manage disaster incidents",
      icon: AlertTriangle,
      color: "#FF1E00",
      route: "/admin/disasters",
    },
    {
      id: "compensation",
      title: "Compensation Claims",
      subtitle: "Track claims and payments",
      icon: DollarSign,
      color: "#06923E",
      route: "/admin/compensation",
    },
    {
      id: "warnings",
      title: "Food Security Warnings",
      subtitle: "Predictive alerts & analysis",
      icon: TrendingUp,
      color: "#E67514",
      route: "/admin/warnings",
    },
  ];

  if (loading || roleLoading || (session && !userRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-green-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    // Middleware handles redirect to /login
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-green-600">
                {isAdmin ? "Admin Dashboard" : "Dashboard"}
              </h1>
              <p className="text-gray-600 mt-1">
                Welcome, {userRole?.first_name}!
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Role:{" "}
                <span className="font-semibold uppercase">
                  {userRole?.role}
                </span>
              </p>
            </div>
            <button
              onClick={async () => {
                await signOut();
                router.push("/login");
              }}
              className="px-6 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-semibold"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isAdmin ? (
          <div className="text-center py-12">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Admin Access Required
            </h2>
            <p className="text-gray-600 mb-6">
              You don't have admin permissions to access this dashboard
            </p>
            <div className="space-x-4">
              <button
                onClick={() => router.push("/dashboard/lands")}
                className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-semibold"
              >
                Go to My Lands
              </button>
              <button
                onClick={() => router.push("/dashboard/observations")}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
              >
                Submit Observation
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {adminMenuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => router.push(item.route)}
                className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 p-6 flex items-center gap-4 border border-gray-100 hover:border-green-200 hover:-translate-y-1 group text-left"
              >
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${item.color}15` }}
                >
                  <item.icon size={28} color={item.color} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 text-lg mb-1">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-600">{item.subtitle}</p>
                </div>
                <ChevronRight
                  size={20}
                  className="text-gray-400 group-hover:text-green-600 transition-colors"
                />
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
