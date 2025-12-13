"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Search,
  Heart,
  Download,
  Settings,
  FileText,
  Briefcase
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Search", href: "/search", icon: Search },
  { name: "Subscriptions", href: "/subscriptions", icon: Heart },
  { name: "Downloads", href: "/downloads", icon: Download },
  { name: "Jobs", href: "/jobs", icon: Briefcase },
  { name: "Logs", href: "/logs", icon: FileText },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-background">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center px-6">
          <Link href="/" className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-lg font-bold">E</span>
            </div>
            <span className="text-xl font-bold">Eros</span>
          </Link>
        </div>

        <Separator />

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Button
                  key={item.name}
                  variant={isActive ? "default" : "ghost"}
                  className="w-full justify-start gap-3"
                  asChild
                >
                  <Link href={item.href}>
                    <Icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </Link>
                </Button>
              );
            })}
          </nav>
        </ScrollArea>

        <Separator />

        {/* Footer */}
        <div className="p-4">
          <div className="flex items-center gap-3 rounded-lg bg-accent px-3 py-2">
            <Avatar>
              <AvatarFallback>A</AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">Admin</p>
              <p className="text-xs text-muted-foreground">admin@eros.local</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
