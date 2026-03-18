import type { Metadata } from "next";
import "./globals.css";
import Nav from "./nav";

export const metadata: Metadata = {
  title: "Practice Persona",
  description: "SEO, HIPAA compliance, and local search analysis for therapy practices",
  icons: {
    icon: '/favicon.svg',
  },
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
