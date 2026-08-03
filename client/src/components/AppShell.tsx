import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NICHE_NAVIGATION } from "@/lib/nicheNavigation";
import { Bookmark, ChevronDown, Database, Landmark, LogOut, Search, Sparkles } from "lucide-react";
import { Link, useLocation } from "wouter";

const NAV = [
  { href: "/catalogue", label: "Catalogue", icon: Database },
  { href: "/agent-picks", label: "Agent Picks", icon: Sparkles },
  { href: "/watchlist", label: "Watchlist", icon: Bookmark },
];

// Live search kept available but demoted — it costs API credits per search,
// so the catalogue (pre-built, free to browse) is the primary destination.
// Live search is admin-only — it burns RealtyAPI + NSW Planning API credits per search.
const ADMIN_NAV = [{ href: "/research", label: "Live search", icon: Search }];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="container flex h-14 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
            <Landmark className="h-5 w-5 text-primary" />
            <span className="hidden sm:inline">Investor Scout</span>
            <span className="sm:hidden">Scout</span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map(item => {
              const Icon = item.icon;
              const active = location.startsWith(item.href);
              return (
                <Button key={item.href} asChild variant={active ? "secondary" : "ghost"} size="sm" className="gap-1.5">
                  <Link href={item.href}>
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                </Button>
              );
            })}
            {user?.role === "admin" && ADMIN_NAV.map(item => {
              const Icon = item.icon;
              const active = location.startsWith(item.href);
              return (
                <Button
                  key={item.href}
                  asChild
                    variant={active ? "secondary" : "ghost"}
                    size="sm"
                    className={`gap-1.5 ${active ? "" : "text-muted-foreground"}`}
                  >
                  <Link href={item.href}>
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline text-xs">{item.label}</span>
                  </Link>
                </Button>
              );
            })}
            {/* Niche dropdown — visible to all authenticated users */}
            {isAuthenticated && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={location.startsWith("/niche") ? "secondary" : "ghost"}
                    size="sm"
                    className="gap-1.5"
                  >
                    <span className="hidden sm:inline text-xs">Niches</span>
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {NICHE_NAVIGATION.map((item) => (
                    <Link key={item.href} href={item.href}>
                      <DropdownMenuItem className="cursor-pointer">
                        {item.label}
                      </DropdownMenuItem>
                    </Link>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {isAuthenticated && (
              <div className="flex items-center gap-2 ml-2 pl-2 border-l">
                <span className="text-sm text-muted-foreground hidden md:inline">
                  {user?.name ?? user?.email}
                </span>
                <Button variant="ghost" size="sm" onClick={() => logout()} title="Sign out" aria-label="Sign out">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t py-4">
        <div className="container text-xs text-muted-foreground">
          Planning data uses the NSW Planning Portal plus validated Queensland state and council spatial services.
          QLD council-rule coverage is partial and unknown fields remain marked for manual review. Indicative research only — always verify with council and a town planner before purchase.
        </div>
      </footer>
    </div>
  );
}
