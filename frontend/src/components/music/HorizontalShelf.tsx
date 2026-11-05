import {
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  title: string;
  subtitle?: string;
  to?: string;
  children: ReactNode;
}

/** Spotify-style horizontal shelf — hidden native bar, chevrons + drag/swipe */
const HorizontalShelf = ({ title, subtitle, to, children }: Props) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    scrollLeft: number;
    pointerId: number | null;
  }>({
    active: false,
    moved: false,
    startX: 0,
    scrollLeft: 0,
    pointerId: null,
  });

  const scrollByCards = useCallback((dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(240, Math.floor(el.clientWidth * 0.75));
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Don't start drag from interactive controls inside cards
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select")) return;
    const el = scrollerRef.current;
    if (!el) return;
    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      scrollLeft: el.scrollLeft,
      pointerId: e.pointerId,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    const drag = dragRef.current;
    if (!el || !drag.active) return;
    const dx = e.clientX - drag.startX;
    if (!drag.moved && Math.abs(dx) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      el.setPointerCapture(e.pointerId);
      el.dataset.dragging = "1";
    }
    el.scrollLeft = drag.scrollLeft - dx;
  };

  const endDrag = () => {
    const el = scrollerRef.current;
    const drag = dragRef.current;
    if (el && drag.pointerId !== null && drag.moved) {
      try {
        el.releasePointerCapture(drag.pointerId);
      } catch {
        /* ignore */
      }
    }
    if (el) {
      if (drag.moved) {
        window.setTimeout(() => delete el.dataset.dragging, 50);
      } else {
        delete el.dataset.dragging;
      }
    }
    dragRef.current = {
      active: false,
      moved: false,
      startX: 0,
      scrollLeft: 0,
      pointerId: null,
    };
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const handler = (ev: WheelEvent) => {
      const delta =
        Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY;
      if (!delta) return;
      const atStart = el.scrollLeft <= 0 && delta < 0;
      const atEnd =
        el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && delta > 0;
      if (atStart || atEnd) return;
      if (el.scrollWidth <= el.clientWidth) return;
      el.scrollLeft += delta;
      ev.preventDefault();
      ev.stopPropagation();
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  return (
    <section className="space-y-3 group/shelf w-full min-w-0 max-w-full">
      <div className="flex items-end justify-between gap-3 px-0.5">
        <div className="min-w-0">
          {to ? (
            <Link to={to} className="group inline-flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight group-hover:underline underline-offset-4">
                {title}
              </h2>
            </Link>
          ) : (
            <h2 className="text-lg sm:text-xl font-bold tracking-tight">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-xs sm:text-sm text-zinc-400 mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            aria-label="Scroll left"
            className="inline-flex size-8 items-center justify-center rounded-full bg-zinc-800/90 text-zinc-300 hover:text-white hover:bg-zinc-700"
            onClick={() => scrollByCards(-1)}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Scroll right"
            className="inline-flex size-8 items-center justify-center rounded-full bg-zinc-800/90 text-zinc-300 hover:text-white hover:bg-zinc-700"
            onClick={() => scrollByCards(1)}
          >
            <ChevronRight className="size-4" />
          </button>
          {to && (
            <Link
              to={to}
              className="ml-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white"
            >
              Show all
            </Link>
          )}
        </div>
      </div>

      <div
        ref={scrollerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(e) => {
          if (scrollerRef.current?.dataset.dragging === "1") {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        className="w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth touch-pan-x cursor-grab active:cursor-grabbing [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {/* w-max inner row = reliable scrollWidth (cards never collapse) */}
        <div className="flex w-max flex-nowrap gap-3 sm:gap-4 pb-1">
          {children}
        </div>
      </div>
    </section>
  );
};

export default HorizontalShelf;
