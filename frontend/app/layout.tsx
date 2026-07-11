import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
git config --local user.name "Saurabh yadav"
git config --local user.email "saurabh7678944135gzp@gmail.com"  # <- Replace with your personal email
