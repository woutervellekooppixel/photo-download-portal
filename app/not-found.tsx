"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NotFound() {
  const [countdown, setCountdown] = useState(30);
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = "https://wouter.photo";
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center">
            <svg
              className="w-12 h-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        {/* Main Message */}
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-gray-900">
            Transfer verlopen
          </h1>
          <p className="text-lg text-gray-600 max-w-lg mx-auto">
            Deze download link is niet (meer) beschikbaar. De bestanden zijn mogelijk verlopen of verwijderd.
          </p>
        </div>

        {/* Contact Info */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-3">
          <p className="text-sm text-gray-600">
            Heb je hulp nodig of wil je een nieuwe link aanvragen?
          </p>
          <a
            href="mailto:info@woutervellekoop.nl"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            info@woutervellekoop.nl
          </a>
        </div>

        {/* Countdown */}
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Je wordt automatisch doorgestuurd naar de homepage in
          </p>
          <div className="text-6xl font-bold text-gray-300">
            {countdown}
          </div>
          <p className="text-xs text-gray-400">seconden</p>
        </div>

        {/* Manual Link */}
        <div>
          <a
            href="https://wouter.photo"
            className="text-sm text-gray-500 hover:text-gray-700 underline transition-colors"
          >
            Of klik hier om direct te gaan
          </a>
        </div>

        {/* Footer */}
        <div className="pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-400">
            © Wouter.Photo
          </p>
        </div>
      </div>
    </div>
  );
}
