import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ChatPanel } from "@/components/ai/chat-panel";
import { ChangePreview } from "@/components/shared/change-preview";
import { ResourceNavigator } from "@/components/shared/resource-navigator";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OpenShift Security Dashboard",
  description: "Visual security posture management for OpenShift and Kubernetes clusters",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <TooltipProvider>
          <Sidebar />
          <div className="ml-64 min-h-screen">
            <Header />
            <main className="p-6">{children}</main>
          </div>
          <ChangePreview />
          <ChatPanel />
          <ResourceNavigator />
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
