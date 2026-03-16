import { Link, useRoute } from "wouter"
import { cn } from "@/lib/utils"

interface AppHeaderProps {
  basketCount: number
}

export function AppHeader({ basketCount }: AppHeaderProps) {
  const [isHome] = useRoute("/")
  const [isDesign] = useRoute("/design")

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold text-foreground hover:text-primary transition-colors">
          <span className="material-icons-outlined text-primary">auto_stories</span>
          <span className="hidden sm:inline">성수동</span>
          <span className="sm:hidden text-xs">성수동</span>
        </Link>

        <nav className="flex items-center gap-1 ml-2">
          <Link
            href="/"
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
              isHome
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            <span className="material-icons-outlined text-[18px]">search</span>
            <span className="hidden sm:inline">성취기준 검색</span>
            <span className="sm:hidden">검색</span>
            {basketCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-primary/20 text-primary px-1.5 py-0.5 text-xs font-medium leading-none">
                {basketCount}
              </span>
            )}
          </Link>
          <Link
            href="/design"
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
              isDesign
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            <span className="material-icons-outlined text-[18px]">edit_note</span>
            <span className="hidden sm:inline">수업 디자인</span>
            <span className="sm:hidden">디자인</span>
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <span className="hidden md:inline">성취기준, 수업을 함께 디자인하는 동료</span>
        </div>
      </div>
    </header>
  )
}
