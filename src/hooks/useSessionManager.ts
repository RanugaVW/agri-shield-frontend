import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import { middlewareAuthSignOut } from "@/lib/middleware";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

interface UseSessionManagerProps {
  onSessionValid?: (session: Session) => Promise<void>;
  onSessionClear?: () => void;
}

export function useSessionManager({
  onSessionValid,
  onSessionClear,
}: UseSessionManagerProps = {}) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check initial session
    const checkSession = async () => {
      try {
        const sessionResponse = await supabase.auth.getSession();
        const {
          data: { session },
          error,
        } = sessionResponse;

        if (error) {
          console.error("Error getting session:", error);
          await handleSignOut();
          return;
        }

        console.log(
          "Session check result:",
          session?.user?.email || "No session",
        );

        // Only set session if it's valid and user exists AND user is in database
        if (session?.user && session.user.email) {
          await validateAndSetSession(session);
        } else {
          console.log("No valid session, showing login");
          handleClearSession();
        }
      } catch (error) {
        console.error("Error checking session:", error);
        handleClearSession();
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(
        "Auth state changed:",
        event,
        session?.user?.email || "No user",
      );
      if (session?.user && session.user.email) {
        console.log("Setting session from auth change:", session.user.email);
        // Set cookie for Next.js middleware route protection
        document.cookie = `agrishield-session=${session.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
        setSession(session);
        if (onSessionValid) await onSessionValid(session);
      } else {
        console.log("Clearing session from auth change");
        handleClearSession();
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const handleClearSession = () => {
    setSession(null);
    // Clear auth cookie
    document.cookie = "agrishield-session=; path=/; max-age=0; SameSite=Lax";
    if (onSessionClear) onSessionClear();
  };

  const handleSignOut = async () => {
    try {
      const currentSession = session;
      await middlewareAuthSignOut(currentSession?.access_token);
    } catch (e) {
      // Continue even if sign out fails
    }
    handleClearSession();
    setLoading(false);
  };

  const validateAndSetSession = async (session: Session) => {
    try {
      // Verify user exists in our database via backend API
      console.log("[SESSION] Validating user via backend API...");
      const response = await fetch(`${API_URL}/auth/me`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();

      if (!response.ok || result.status !== "success" || !result.data) {
        console.log("User not found in database, signing out");
        await handleSignOut();
        return;
      }

      console.log("Valid session and user found for:", session.user.email);
      // Set cookie for Next.js middleware route protection
      document.cookie = `agrishield-session=${session.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      setSession(session);
      if (onSessionValid) await onSessionValid(session);
    } catch (verifyError) {
      console.error("Error verifying user in database:", verifyError);
      await handleSignOut();
    }
  };

  return {
    session,
    setSession,
    loading,
    setLoading,
  };
}
