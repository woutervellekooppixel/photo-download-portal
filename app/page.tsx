import Link from "next/link";
import { Camera } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="flex justify-center">
          <Camera className="h-16 w-16 text-gray-700" />
        </div>
        <div className="space-y-3">
          <h1 className="text-4xl font-bold text-gray-900">
            Download Portal
          </h1>
          <p className="text-gray-600">
            Wouter Vellekoop Photography
          </p>
        </div>
        <div className="pt-6">
          <Link
            href="/admin"
            className="inline-block px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Admin Login
          </Link>
        </div>
        <p className="text-sm text-gray-500">
          Heb je een download link ontvangen? Gebruik de link in je email.
        </p>
      </div>
    </main>
  );
}
