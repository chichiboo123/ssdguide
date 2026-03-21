import { Link, useRoute } from "wouter"
import { cn } from "@/lib/utils"

interface AppHeaderProps {
  basketCount: number
}

export function AppHeader({ basketCount }: AppHeaderProps) {
  const [isHome] = useRoute("/")
  const [isDesign] = useRoute("/design")

  return (
    <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur-lg supports-[backdrop-filter]:bg-white/60">
      <div className="max-w-6xl mx-auto flex h-14 items-center gap-4 px-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-foreground hover:text-primary transition-colors"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <span className="material-icons-outlined text-primary text-[28px]">auto_stories</span>
          <span className="text-base tracking-tight">성수동</span>
        </Link>

        <nav className="flex items-center gap-1 ml-4">
          <Link
            href="/"
            className={cn(
              "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all",
              isHome
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <span className="material-icons-outlined text-[18px]">search</span>
            <span className="hidden sm:inline">성취기준</span>
            {basketCount > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-primary text-white min-w-[18px] h-[18px] px-1 text-[11px] font-bold leading-none">
                {basketCount}
              </span>
            )}
          </Link>
          <Link
            href="/design"
            className={cn(
              "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all",
              isDesign
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <span className="material-icons-outlined text-[18px]">edit_note</span>
            <span className="hidden sm:inline">수업 디자인</span>
          </Link>
        </nav>

        <div className="ml-auto" />
      </div>
    </header>
  )
}
