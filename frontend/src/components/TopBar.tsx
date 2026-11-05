import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { LayoutDashboardIcon } from "lucide-react";
import { Link } from "react-router-dom";
import SignInOAuthButton from "./SignInOAuthButton.tsx";
import { useAuthStore } from "@/stores/useAuthStore.ts";
import { cn } from "@/lib/utils.ts";
import { buttonVariants } from "./ui/button.tsx";
import SearchBar from "./SearchBar.tsx";
import FavoritesButton from "./FavoritesButton.tsx";

const TopBar = () => {
  const { isAdmin } = useAuthStore();

  return (
    <div className="rounded-lg sticky top-0 z-10 bg-zinc-900/90 backdrop-blur-md p-2.5 sm:p-4 mb-0 shrink-0">
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img
            src="/glossy-blue-play-icon.png"
            className="size-8 sm:size-10 rounded-lg object-cover shadow-[0_0_14px_rgba(56,189,248,0.55)]"
            alt="MelodyPlay"
          />
          <span className="font-bold tracking-tight text-sm sm:text-base hidden xs:inline sm:inline">
            MelodyPlay
          </span>
        </Link>

        <div className="flex-1 min-w-0 max-w-xl mx-1 sm:mx-2">
          <SearchBar />
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <div className="hidden sm:block">
            <FavoritesButton />
          </div>
          {isAdmin && (
            <Link
              to="/admin"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "hidden md:inline-flex",
              )}
            >
              <LayoutDashboardIcon className="size-4" />
              <span>Admin</span>
            </Link>
          )}
          <SignedIn>
            <Link
              to="/profile"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "hidden sm:inline-flex text-zinc-300 hover:text-white",
              )}
            >
              Profile
            </Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <SignInOAuthButton />
          </SignedOut>
        </div>
      </div>
    </div>
  );
};

export default TopBar;
