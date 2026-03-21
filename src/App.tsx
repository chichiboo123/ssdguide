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
    <div className="min-h-screen bg-background">
      <AppHeader basketCount={items.length} />
      <main>
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/design" component={LessonDesignPage} />
          <Route>
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-muted-foreground">
              <span className="material-icons-outlined text-6xl mb-4">error_outline</span>
              <h1 className="text-2xl font-semibold mb-2">페이지를 찾을 수 없습니다</h1>
              <a href="/" className="text-primary hover:underline">홈으로 돌아가기</a>
            </div>
          </Route>
        </Switch>
      </main>
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
