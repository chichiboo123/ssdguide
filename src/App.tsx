import { Component, type ReactNode } from "react"
import { Route, Switch, Router } from "wouter"
import { useHashLocation } from "wouter/use-hash-location"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "@/lib/queryClient"
import { AppHeader } from "@/components/app-header"
import { Toaster } from "@/components/ui/toaster"
import { useBasket } from "@/hooks/use-basket"
import HomePage from "@/pages/home"
import LessonDesignPage from "@/pages/lesson-design"

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 text-center">
          <span className="material-icons-outlined text-destructive text-[48px]">error_outline</span>
          <h1 className="text-xl font-semibold">페이지를 불러오는 중 오류가 발생했습니다</h1>
          <p className="text-sm text-muted-foreground max-w-md">{this.state.error.message}</p>
          <button
            className="mt-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
            onClick={() => window.location.reload()}
          >
            새로고침
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

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
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router hook={useHashLocation}>
          <AppContent />
        </Router>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
