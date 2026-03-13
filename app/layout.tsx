import type { Metadata } from "next";
import "./globals.css";
import Nav from "./nav";

export const metadata: Metadata = {
  title: "Therapist Website Analyzer",
  description: "SEO comparison, SEO hygiene, and HIPAA risk audit for therapist websites",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-brand-bg text-brand-charcoal antialiased min-h-screen pt-[49px]">
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}
