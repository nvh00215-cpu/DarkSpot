import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GapSense — AI-Assisted Information Gap Detection",
  description: "Find what your sources don't tell you. Structured information gap and conflict analysis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Lora:ital,wght@0,400..700;1,400..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased bg-[#F6EFE6] text-[#3B2A20] font-sans">
        {children}
      </body>
    </html>
  );
}
