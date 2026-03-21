import { Route, Switch, Router } from "wouter"
import { useHashLocation } from "wouter/use-hash-location"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "@/lib/queryClient"
import { AppHeader } from "@/components/app-header"
import { Toaster } from "@/components/ui/toaster"
import { useBasket } from "@/hooks/use-basket"
import HomePage from "@/pages/home"
import LessonDesignPage from "@/pages/lesson-design"

function AppContent() {
  const { items } = useBasket()
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader basketCount={items.length} />
      <main className="flex-1">
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/design" component={LessonDesignPage} />
          <Route>
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-muted-foreground">
              <span className="material-icons-outlined text-[64px] mb-4 opacity-30">error_outline</span>
              <h1 className="text-2xl font-semibold mb-2">페이지를 찾을 수 없습니다</h1>
              <a href="/" className="text-primary hover:underline mt-2">홈으로 돌아가기</a>
            </div>
          </Route>
        </Switch>
      </main>
      <footer className="border-t border-border/60 bg-card py-4 text-center">
        <a
          href="https://litt.ly/chichiboo"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          Created by. 교육뮤지컬 꿈꾸는 치수쌤
        </a>
      </footer>
      <Toaster />
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <AppContent />
      </Router>
    </QueryClientProvider>
  )
}
