"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Users, Loader2 } from "lucide-react";

export default function AdminUsersPage() {
  const router = useRouter();
  const { session, userRole, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!session) {
        router.push("/login");
      } else if (userRole?.role !== "admin") {
        router.push("/");
      }
    }
  }, [loading, session, userRole, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-12 h-12 animate-spin text-green-600" />
      </div>
    );
  }

  if (!session || userRole?.role !== "admin") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-green-600">
                Users Management
              </h1>
              <p className="text-gray-600 mt-1">View and manage all users</p>
            </div>
            <button
              onClick={() => router.push("/")}
              className="px-6 py-2 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-colors font-semibold"
            >
              Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Users Management
          </h2>
          <p className="text-gray-600">
            This admin page is under construction. User management features will
            be available soon.
          </p>
        </div>
      </main>
    </div>
  );
}
