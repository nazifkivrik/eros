"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSetupPage = pathname?.startsWith("/setup");
  const isLoginPage = pathname?.startsWith("/login");

  if (isSetupPage || isLoginPage) {
    // Setup and login pages: no sidebar, full width
    return <main className="min-h-screen">{children}</main>;
  }

  // Normal pages: with sidebar
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">{children}</main>
    </div>
  );
}
