import { Home, Search, Compass, Library } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/search", label: "Search", icon: Search },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/library/playlists", label: "Your Library", icon: Library },
];

const MobileNav = () => {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      <div className="grid grid-cols-4 h-14 w-full max-w-lg mx-auto px-1">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-0.5 text-[10px] min-h-[44px] min-w-0 touch-manipulation transition-colors",
                isActive ? "text-white" : "text-zinc-500 hover:text-zinc-300",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn("size-5 shrink-0", isActive && "fill-white/15")}
                  strokeWidth={isActive ? 2.4 : 2}
                />
                <span
                  className={cn(
                    "truncate max-w-full px-0.5",
                    isActive && "font-semibold",
                  )}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default MobileNav;
