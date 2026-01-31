"use client";

import React, { createContext, useContext, useState } from "react";
import { Session } from "@supabase/supabase-js";
import {
  middlewareSelect,
  middlewareInsert,
  middlewareUpdate,
  middlewareAuthSignIn,
  middlewareAuthSignUp,
  middlewareAuthSignOut,
} from "@/lib/middleware";
import { useSessionManager } from "@/hooks/useSessionManager";

interface UserRole {
  id: string;
  email: string;
  username?: string;
  role: "admin" | "agri_officer" | "farmer" | "viewer";
  first_name: string;
  last_name: string;
  age: number;
  address_line_1: string;
  address_line_2: string;
  phone_number: string;
  postal_code: string;
  district: string;
  grama_niladhari_division?: string;
  can_manage_farmers: boolean;
  can_manage_officers: boolean;
}

interface AuthContextType {
  session: Session | null;
  userRole: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    username: string,
    age: number,
    addressLine1: string,
    addressLine2: string,
    phoneNumber: string,
    postalCode: string,
    district: string,
    gramaNiladhariDivision?: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  updateUserRole: (
    userId: string,
    newRole: "admin" | "agri_officer" | "farmer" | "viewer",
  ) => Promise<void>;
  updateProfile: (updates: Partial<UserRole>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  // Fetch Logic
  const fetchUserRole = async (userId: string) => {
    try {
      const response = await middlewareSelect("users", "*", { id: userId });

      if (
        response.status !== "success" ||
        !response.data ||
        response.data.length === 0
      ) {
        console.error("Error fetching user role:", response.error);
        return;
      }

      const data = response.data[0];
      const role = (data as any)?.role || "viewer";
      setUserRole({
        ...(data as any),
        can_manage_farmers: role === "admin" || role === "agri_officer",
        can_manage_officers: role === "admin",
      });
    } catch (error) {
      console.error("Error fetching user role:", error);
    }
  };

  // Callback to fetch role when session is valid
  const handleSessionValid = async (session: Session) => {
    await fetchUserRole(session.user.id);
  };

  // Callback to clear role when session is cleared
  const handleSessionClear = () => {
    setUserRole(null);
  };

  const { session, setSession, loading } = useSessionManager({
    onSessionValid: handleSessionValid,
    onSessionClear: handleSessionClear,
  });

  const signIn = async (email: string, password: string) => {
    try {
      const response = await middlewareAuthSignIn(email, password);
      if (response.status !== "success") {
        throw response.error || new Error("Failed to sign in");
      }

      // Explicitly set session to ensure state updates immediately
      if (response.data?.session) {
        console.log("✅ Explicitly setting session from signIn");
        setSession(response.data.session);
        await fetchUserRole(response.data.session.user.id);
      }
    } catch (error: any) {
      throw new Error(error.message || "Failed to sign in");
    }
  };

  const signUp = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    username: string,
    age: number,
    addressLine1: string,
    addressLine2: string,
    phoneNumber: string,
    postalCode: string,
    district: string,
    gramaNiladhariDivision?: string,
  ) => {
    try {
      // Create auth user
      const signUpResponse = await middlewareAuthSignUp(email, password);

      if (signUpResponse.status !== "success" || !signUpResponse.data?.user) {
        throw signUpResponse.error || new Error("Failed to create user");
      }

      const user = signUpResponse.data.user;

      // Create user profile with default role 'viewer'
      const profileResponse = await middlewareInsert("users", {
        id: user.id,
        email,
        username,
        first_name: firstName,
        last_name: lastName,
        age,
        address_line_1: addressLine1,
        address_line_2: addressLine2,
        phone_number: phoneNumber,
        postal_code: postalCode,
        district,
        grama_niladhari_division: gramaNiladhariDivision || null,
        role: "viewer", // All new users start as viewers
      });

      if (profileResponse.status !== "success") {
        throw (
          profileResponse.error || new Error("Failed to create user profile")
        );
      }

      // Explicitly set session if returned (auto-confirm)
      if (signUpResponse.data?.session) {
        console.log("✅ Explicitly setting session from signUp");
        setSession(signUpResponse.data.session);
        await fetchUserRole(user.id);
      }
    } catch (error: any) {
      throw new Error(error.message || "Failed to create account");
    }
  };

  const signOut = async () => {
    try {
      const response = await middlewareAuthSignOut();
      if (response.status !== "success") {
        throw response.error || new Error("Failed to sign out");
      }
      setSession(null);
      setUserRole(null);
    } catch (error: any) {
      throw new Error(error.message || "Failed to sign out");
    }
  };

  const updateUserRole = async (
    userId: string,
    newRole: "admin" | "agri_officer" | "farmer" | "viewer",
  ) => {
    try {
      // Only admin can assign agri_officer, and agri_officer or admin can assign farmer
      if (userRole?.role === "admin") {
        const response = await middlewareUpdate(
          "users",
          { role: newRole },
          { id: userId },
        );
        if (response.status !== "success") {
          throw response.error || new Error("Failed to update user role");
        }
      } else if (userRole?.role === "agri_officer" && newRole === "farmer") {
        const response = await middlewareUpdate(
          "users",
          { role: newRole },
          { id: userId },
        );
        if (response.status !== "success") {
          throw response.error || new Error("Failed to update user role");
        }
      } else {
        throw new Error("You do not have permission to change user roles");
      }
    } catch (error: any) {
      throw new Error(error.message || "Failed to update user role");
    }
  };

  const updateProfile = async (updates: Partial<UserRole>) => {
    try {
      if (!session?.user?.id) throw new Error("No authenticated user");

      // Prevent username from being changed - it's immutable
      if (updates.username && updates.username !== userRole?.username) {
        throw new Error("Username cannot be changed after account creation");
      }

      // Validate email uniqueness if email is being changed
      if (updates.email && updates.email !== userRole?.email) {
        const emailCheckResponse = await middlewareSelect("users", "id", {
          email: updates.email,
        });

        if (
          emailCheckResponse.status === "success" &&
          emailCheckResponse.data &&
          emailCheckResponse.data.length > 0
        ) {
          const existingUser = (emailCheckResponse.data as any)?.find(
            (u: any) => u.id !== session.user.id,
          );
          if (existingUser) {
            throw new Error("Email is already in use");
          }
        }
      }

      // Prepare update object with only allowed fields (excluding username)
      const updateData: any = {};
      const allowedFields = [
        "email",
        "phone_number",
        "address_line_1",
        "address_line_2",
        "postal_code",
        "district",
        "grama_niladhari_division",
      ];

      for (const field of allowedFields) {
        if (field in updates) {
          updateData[field] = updates[field as keyof UserRole];
        }
      }

      // Update user profile in database
      const updateResponse = await middlewareUpdate("users", updateData, {
        id: session.user.id,
      });

      if (updateResponse.status !== "success") {
        throw updateResponse.error || new Error("Failed to update profile");
      }

      // Update local state
      setUserRole({
        ...userRole!,
        ...updateData,
      });
    } catch (error: any) {
      throw new Error(error.message || "Failed to update profile");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        userRole,
        loading,
        signIn,
        signUp,
        signOut,
        updateUserRole,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
