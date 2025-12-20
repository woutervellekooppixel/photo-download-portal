"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface UseAutoLogoutOptions {
  timeout?: number; // in milliseconds
  onLogout?: () => void;
}

export function useAutoLogout({ 
  timeout = 30 * 60 * 1000, // Default: 30 minutes
  onLogout 
}: UseAutoLogoutOptions = {}) {
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const logout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      onLogout?.();
      router.push("/admin");
    } catch (error) {
      console.error("Logout error:", error);
      router.push("/admin");
    }
  };

  const resetTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      logout();
    }, timeout);
  };

  useEffect(() => {
    // Events that indicate user activity
    const events = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"];

    // Set initial timer
    resetTimer();

    // Reset timer on any user activity
    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [timeout]);

  return { logout };
}
