import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wardrobez — Web Companion",
  description: "View and manage your Wardrobez wardrobe on the web.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">👗</span>
            <span className="text-xl font-bold text-indigo-600">Wardrobez</span>
            <span className="text-sm text-gray-400 font-normal">Web Companion</span>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
