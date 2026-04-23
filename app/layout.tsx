import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "CivicWatch",
  description:
    "Evidence-first civic transparency dashboard for comparing politician statements, voting records, donors, and disclosures."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="grid-overlay min-h-screen">{children}</div>
      </body>
    </html>
  );
}
