import { Link, useRoute } from "wouter"
import { cn } from "@/lib/utils"

interface AppHeaderProps {
  basketCount: number
}

export function AppHeader({ basketCount }: AppHeaderProps) {
  const [isHome] = useRoute("/")
  const [isDesign] = useRoute("/design")

  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border/70 shadow-sm">
      <div className="flex h-14 items-center gap-4 px-4 max-w-screen-2xl mx-auto">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground shadow-sm group-hover:bg-primary/90 transition-colors">
            <span className="material-icons-outlined text-[18px]">auto_stories</span>
          </div>
          <div className="hidden sm:flex flex-col leading-none">
            <span className="font-bold text-sm text-foreground tracking-tight">성수동</span>
            <span className="text-[10px] text-muted-foreground font-medium tracking-wide">Seongsu-dong</span>
          </div>
        </Link>

        <div className="w-px h-5 bg-border hidden sm:block" />

        {/* Nav */}
        <nav className="flex items-center gap-1">
          <Link
            href="/"
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
              isHome
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <span className="material-icons-outlined text-[18px]">search</span>
            <span className="hidden sm:inline">성취기준 검색</span>
            <span className="sm:hidden">검색</span>
            {basketCount > 0 && (
              <span className="inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none">
                {basketCount}
              </span>
            )}
          </Link>
          <Link
            href="/design"
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
              isDesign
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <span className="material-icons-outlined text-[18px]">edit_note</span>
            <span className="hidden sm:inline">수업 디자인</span>
            <span className="sm:hidden">디자인</span>
          </Link>
        </nav>

        <div className="ml-auto text-xs text-muted-foreground hidden lg:block">
          성취기준, 수업을 함께 디자인하는 동료
        </div>
      </div>
    </header>
  )
}
