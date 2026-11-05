import { Link } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Disc3,
  Mic2,
  Podcast,
  Radio,
  Sparkles,
  TrendingUp,
} from "lucide-react";

const tiles = [
  {
    to: "/charts",
    title: "Charts",
    subtitle: "What's trending now",
    icon: TrendingUp,
    tone: "from-emerald-700/80 to-zinc-900",
  },
  {
    to: "/radio",
    title: "Radio",
    subtitle: "Live stations worldwide",
    icon: Radio,
    tone: "from-sky-700/80 to-zinc-900",
  },
  {
    to: "/genres/bollywood",
    title: "Bollywood",
    subtitle: "Hindi hits & moods",
    icon: Disc3,
    tone: "from-rose-700/80 to-zinc-900",
  },
  {
    to: "/genres/lofi",
    title: "Moods",
    subtitle: "Chill, focus, workout",
    icon: Podcast,
    tone: "from-violet-700/80 to-zinc-900",
  },
  {
    to: "/genres/punjabi",
    title: "Punjabi",
    subtitle: "Bhangra & more",
    icon: Mic2,
    tone: "from-amber-700/80 to-zinc-900",
  },
  {
    to: "/search",
    title: "Discover",
    subtitle: "Search any song",
    icon: Sparkles,
    tone: "from-teal-700/80 to-zinc-900",
  },
];

const ExplorePage = () => {
  return (
    <ScrollArea className="h-full w-full min-w-0">
      <div className="p-4 sm:p-6 space-y-5 pb-28 md:pb-8 max-w-full overflow-x-hidden">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Explore
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Charts, radio, genres, and more
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {tiles.map(({ to, title, subtitle, icon: Icon, tone }) => (
            <Link
              key={to}
              to={to}
              className={`rounded-xl bg-linear-to-br ${tone} p-4 min-h-[7.5rem] flex flex-col justify-between border border-white/5 active:scale-[0.98] transition`}
            >
              <Icon className="size-6 text-white/90" />
              <div>
                <div className="font-semibold text-white">{title}</div>
                <div className="text-xs text-white/70 mt-0.5">{subtitle}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
};

export default ExplorePage;
