import { Search, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Input } from "./ui/input";
import { useExternalMusicStore } from "@/stores/useExternalMusicStore";

const SearchBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const focusedRef = useRef(false);

  const searchQuery = useExternalMusicStore((s) => s.searchQuery);
  const setSearchQuery = useExternalMusicStore((s) => s.setSearchQuery);
  const clearSearch = useExternalMusicStore((s) => s.clearSearch);
  const onSearchPage = location.pathname.startsWith("/search");

  // Hydrate from URL only when input is NOT focused (back/forward / shared link)
  useEffect(() => {
    if (focusedRef.current) return;
    if (!onSearchPage) return;
    const q = new URLSearchParams(location.search).get("q") || "";
    if (q !== searchQuery) {
      setSearchQuery(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  const clearToBrowse = () => {
    setSearchQuery("");
    clearSearch();
    navigate("/search", { replace: true });
    inputRef.current?.focus();
  };

  return (
    <div className="relative w-full max-w-none sm:w-64 md:w-80">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400 pointer-events-none" />
      <Input
        ref={inputRef}
        type="text"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="What do you want to play?"
        value={searchQuery}
        onFocus={() => {
          focusedRef.current = true;
          if (!onSearchPage) {
            navigate(searchQuery.trim() ? `/search?q=${encodeURIComponent(searchQuery.trim())}` : "/search");
          }
        }}
        onBlur={() => {
          focusedRef.current = false;
        }}
        onChange={(e) => {
          // Free typing — never trim / never rewrite value from URL mid-keystroke
          const value = e.target.value;
          setSearchQuery(value);
          if (!onSearchPage) {
            navigate("/search");
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            clearToBrowse();
          }
        }}
        className="pl-10 pr-9 h-10 sm:h-9 bg-zinc-800 border-zinc-700 focus:border-zinc-500 focus-visible:ring-0 text-white placeholder:text-zinc-500 rounded-full"
      />
      {searchQuery && (
        <button
          type="button"
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1"
          onClick={clearToBrowse}
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
};

export default SearchBar;
