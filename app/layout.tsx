import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-outfit"
});

export const metadata: Metadata = {
  title: "GrowEasy AI CSV Importer",
  description: "AI-powered CSV importer for GrowEasy CRM leads"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} antialiased`}>
        {children}
        <Toaster 
          position="top-right" 
          toastOptions={{
            style: {
              background: "rgba(21, 26, 38, 0.95)",
              color: "#f3f5f9",
              border: "1px solid rgba(52, 64, 88, 0.5)",
              fontFamily: "var(--font-outfit), sans-serif",
              fontSize: "14.5px"
            }
          }} 
        />
      </body>
    </html>
  );
}
