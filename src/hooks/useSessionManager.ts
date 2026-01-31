import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import { middlewareSelect, middlewareAuthSignOut } from "@/lib/middleware";

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
        // We can optimize here by just setting session if we trust the event,
        // but re-validating role is safer.
        // For now, let's just update the session and trigger callback.
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
    if (onSessionClear) onSessionClear();
  };

  const handleSignOut = async () => {
    await middlewareAuthSignOut();
    handleClearSession();
    setLoading(false);
  };

  const validateAndSetSession = async (session: Session) => {
    try {
      // Verify user actually exists in our database
      const userResponse = await middlewareSelect("users", "id, email", {
        id: session.user.id,
      });

      if (
        userResponse.status !== "success" ||
        !userResponse.data ||
        userResponse.data.length === 0
      ) {
        console.log("User not found in database, signing out");
        await handleSignOut();
        return;
      }

      console.log("Valid session and user found for:", session.user.email);
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
