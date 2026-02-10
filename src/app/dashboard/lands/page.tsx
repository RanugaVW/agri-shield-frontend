"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  middlewareSelect,
  middlewareInsert,
  middlewareDelete,
} from "@/lib/middleware";
import {
  Plus,
  Trash2,
  Leaf,
  MapPin,
  Calendar,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";

const DISTRICTS = [
  "Colombo",
  "Gampaha",
  "Kalutara",
  "Kandy",
  "Matara",
  "Galle",
  "Hambantota",
  "Jaffna",
  "Mullaitivu",
  "Batticaloa",
  "Trincomalee",
  "Kurunegala",
  "Putt alam",
  "Anuradhapura",
  "Polonnaruwa",
  "Badulla",
  "Nuwara Eliya",
  "Monaragala",
  "Ratnapura",
  "Kegalle",
  "Kilinochchi",
  "Vavuniya",
  "Mannar",
];

const CROP_TYPES = [
  "Rice",
  "Coconut",
  "Tea",
  "Rubber",
  "Spices",
  "Fruits",
  "Vegetables",
  "Maize",
  "Sugarcane",
  "Tobacco",
  "Cotton",
  "Mixed Crops",
  "Other",
];

interface Land {
  created_at: string | number | Date;
  id: string;
  land_name: string;
  crop_type: string;
  land_extent_acres: number;
  district: string;
  verification_status: string;
  location_latitude?: number;
  location_longitude?: number;
  planting_date?: string;
  expected_harvest_date?: string;
  grama_niladhari_division?: string;
  notes?: string;
}

export default function LandsPage() {
  const router = useRouter();
  const { session, userRole, loading: authLoading } = useAuth();
  const [lands, setLands] = useState<Land[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    land_name: "",
    crop_type: "",
    land_extent_acres: "",
    district: "",
    location_latitude: "",
    location_longitude: "",
    planting_date: "",
    expected_harvest_date: "",
    grama_niladhari_division: "",
    notes: "",
  });

  useEffect(() => {
    if (!authLoading && !session) {
      router.push("/login");
    } else if (session) {
      fetchLands();
    }
  }, [authLoading, session, router]);

  const fetchLands = async () => {
    try {
      setLoading(true);
      if (!session?.user?.id) return;

      const response = await middlewareSelect("cultivated_lands", "*", {
        farmer_id: session.user.id,
      });

      if (response.status !== "success") {
        throw response.error || new Error("Failed to fetch lands");
      }

      const sortedData = ((response.data as unknown as Land[]) || []).sort(
        (a: unknown, b: unknown) =>
          new Date((b as Land).created_at).getTime() - new Date((a as Land).created_at).getTime(),
      );
      setLands(sortedData as Land[]);
    } catch (error: unknown) {
      console.error("Error fetching lands:", error);
      setError("Failed to load lands");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.land_name.trim()) {
      setError("Please enter land name");
      return;
    }
    if (!formData.crop_type) {
      setError("Please select crop type");
      return;
    }
    if (
      !formData.land_extent_acres ||
      isNaN(parseFloat(formData.land_extent_acres))
    ) {
      setError("Please enter valid land extent in acres");
      return;
    }
    if (!formData.district) {
      setError("Please select district");
      return;
    }

    try {
      setSubmitting(true);

      const insertData = {
        farmer_id: session?.user?.id,
        land_name: formData.land_name,
        crop_type: formData.crop_type,
        land_extent_acres: parseFloat(formData.land_extent_acres),
        district: formData.district,
        location_latitude: formData.location_latitude
          ? parseFloat(formData.location_latitude)
          : null,
        location_longitude: formData.location_longitude
          ? parseFloat(formData.location_longitude)
          : null,
        planting_date: formData.planting_date || null,
        expected_harvest_date: formData.expected_harvest_date || null,
        grama_niladhari_division: formData.grama_niladhari_division || null,
        notes: formData.notes || null,
      };

      const response = await middlewareInsert("cultivated_lands", insertData);

      if (response.status !== "success") {
        throw response.error || new Error("Failed to add land");
      }

      setShowModal(false);
      resetForm();
      fetchLands();
    } catch (error: unknown) {
      console.error("Error adding land:", error);
      const message = error instanceof Error ? error.message : "Failed to add land";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      land_name: "",
      crop_type: "",
      land_extent_acres: "",
      district: "",
      location_latitude: "",
      location_longitude: "",
      planting_date: "",
      expected_harvest_date: "",
      grama_niladhari_division: "",
      notes: "",
    });
    setError("");
  };

  const deleteLand = async (landId: string) => {
    if (!confirm("Are you sure you want to delete this land?")) return;

    try {
      const response = await middlewareDelete("cultivated_lands", {
        id: landId,
      });
      if (response.status !== "success") {
        throw response.error || new Error("Failed to delete land");
      }
      fetchLands();
    } catch (error: unknown) {
      setError("Failed to delete land");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-green-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading your lands...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-green-600">My Lands</h1>
              <p className="text-gray-600 mt-1">
                Manage your cultivated agricultural lands
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => router.push("/")}
                className="px-6 py-2 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-colors font-semibold"
              >
                Dashboard
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="px-6 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-semibold flex items-center gap-2"
              >
                <Plus size={20} />
                Add Land
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && !showModal && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {lands.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow-md">
            <Leaf className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              No lands registered yet
            </h2>
            <p className="text-gray-600 mb-6">
              Get started by adding your first cultivated land
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-semibold inline-flex items-center gap-2"
            >
              <Plus size={20} />
              Add Your First Land
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lands.map((land) => (
              <div
                key={land.id}
                className="bg-white rounded-2xl shadow-md p-6 border border-gray-100 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-green-600 mb-2">
                      {land.land_name}
                    </h3>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        land.verification_status === "verified"
                          ? "bg-green-100 text-green-800"
                          : land.verification_status === "rejected"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {land.verification_status}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteLand(land.id)}
                    className="text-red-600 hover:text-red-700 transition-colors p-2 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Leaf size={18} className="text-green-600" />
                    <span className="font-semibold text-sm">Crop:</span>
                    <span className="text-sm">{land.crop_type}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <MapPin size={18} className="text-green-600" />
                    <span className="font-semibold text-sm">Area:</span>
                    <span className="text-sm">
                      {land.land_extent_acres} acres
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <MapPin size={18} className="text-green-600" />
                    <span className="font-semibold text-sm">District:</span>
                    <span className="text-sm">{land.district}</span>
                  </div>
                  {land.grama_niladhari_division && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <MapPin size={18} className="text-green-600" />
                      <span className="font-semibold text-sm">GN:</span>
                      <span className="text-sm">
                        {land.grama_niladhari_division}
                      </span>
                    </div>
                  )}
                  {land.planting_date && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <Calendar size={18} className="text-green-600" />
                      <span className="font-semibold text-sm">Planted:</span>
                      <span className="text-sm">{land.planting_date}</span>
                    </div>
                  )}
                  {land.expected_harvest_date && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <Calendar size={18} className="text-green-600" />
                      <span className="font-semibold text-sm">Harvest:</span>
                      <span className="text-sm">
                        {land.expected_harvest_date}
                      </span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-gray-400 mt-4 font-mono">
                  ID: {land.id}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add Land Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Add New Land</h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Land Name *
                </label>
                <input
                  type="text"
                  value={formData.land_name}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      land_name: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 outline-none"
                  placeholder="e.g., North Farm, Home Garden"
                  disabled={submitting}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Crop Type *
                  </label>
                  <select
                    value={formData.crop_type}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        crop_type: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 outline-none"
                    disabled={submitting}
                    required
                  >
                    <option value="">Select crop type...</option>
                    {CROP_TYPES.map((crop) => (
                      <option key={crop} value={crop}>
                        {crop}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Land Extent (Acres) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.land_extent_acres}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        land_extent_acres: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 outline-none"
                    placeholder="e.g., 5.5"
                    disabled={submitting}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    District *
                  </label>
                  <select
                    value={formData.district}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        district: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 outline-none"
                    disabled={submitting}
                    required
                  >
                    <option value="">Select district...</option>
                    {DISTRICTS.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    GN Division
                  </label>
                  <input
                    type="text"
                    value={formData.grama_niladhari_division}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        grama_niladhari_division: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 outline-none"
                    placeholder="e.g., Colombo North"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={formData.location_latitude}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        location_latitude: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 outline-none"
                    placeholder="e.g., 6.9271"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={formData.location_longitude}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        location_longitude: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 outline-none"
                    placeholder="e.g., 80.7789"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Planting Date
                  </label>
                  <input
                    type="date"
                    value={formData.planting_date}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        planting_date: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 outline-none"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Expected Harvest Date
                  </label>
                  <input
                    type="date"
                    value={formData.expected_harvest_date}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        expected_harvest_date: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 outline-none"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 outline-none resize-none"
                  placeholder="Any additional information..."
                  disabled={submitting}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Adding Land...
                  </span>
                ) : (
                  "Add Land"
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
