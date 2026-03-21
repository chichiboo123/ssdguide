import { useState, useEffect, useMemo, useCallback } from "react"
import { Link } from "wouter"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useBasket } from "@/hooks/use-basket"
import { useToast } from "@/hooks/use-toast"
import type { AchievementStandard, BasketItem } from "@/lib/types"

const ALL_VALUE = "__all__"

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export default function HomePage() {
  const { items: basketItems, addItem, removeItem, reorderItems, clearBasket, isInBasket } = useBasket()
  const { toast } = useToast()

  const [selectedCurriculum, setSelectedCurriculum] = useState<string>(ALL_VALUE)
  const [selectedGrade, setSelectedGrade] = useState<string>(ALL_VALUE)
  const [selectedSubject, setSelectedSubject] = useState<string>(ALL_VALUE)
  const [selectedArea, setSelectedArea] = useState<string>(ALL_VALUE)
  const [keyword, setKeyword] = useState("")
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [basketOpen, setBasketOpen] = useState(false)

  const debouncedKeyword = useDebounce(keyword, 300)

  const { data: allData = [], isLoading, isError } = useQuery<AchievementStandard[]>({
    queryKey: ["achievements"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}achievements-simple.json`)
      if (!res.ok) throw new Error("데이터를 불러올 수 없습니다.")
      return res.json()
    },
  })

  const curriculumOptions = useMemo(() => {
    const set = new Set(allData.map((d) => d.교육과정))
    const arr = Array.from(set)
    arr.sort((a, b) => {
      if (a.includes("2022 개정") && !b.includes("2022 개정")) return -1
      if (!a.includes("2022 개정") && b.includes("2022 개정")) return 1
      return a.localeCompare(b)
    })
    return arr
  }, [allData])

  const gradeOptions = useMemo(() => {
    const filtered = selectedCurriculum === ALL_VALUE
      ? allData
      : allData.filter((d) => d.교육과정 === selectedCurriculum)
    return Array.from(new Set(filtered.map((d) => d.학년군))).sort()
  }, [allData, selectedCurriculum])

  const subjectOptions = useMemo(() => {
    const filtered = allData.filter((d) => {
      if (selectedCurriculum !== ALL_VALUE && d.교육과정 !== selectedCurriculum) return false
      if (selectedGrade !== ALL_VALUE && d.학년군 !== selectedGrade) return false
      return true
    })
    return Array.from(new Set(filtered.map((d) => d.과목))).sort()
  }, [allData, selectedCurriculum, selectedGrade])

  const areaOptions = useMemo(() => {
    const filtered = allData.filter((d) => {
      if (selectedCurriculum !== ALL_VALUE && d.교육과정 !== selectedCurriculum) return false
      if (selectedGrade !== ALL_VALUE && d.학년군 !== selectedGrade) return false
      if (selectedSubject !== ALL_VALUE && d.과목 !== selectedSubject) return false
      return true
    })
    return Array.from(new Set(filtered.map((d) => d.영역))).sort()
  }, [allData, selectedCurriculum, selectedGrade, selectedSubject])

  useEffect(() => {
    setSelectedGrade(ALL_VALUE)
    setSelectedSubject(ALL_VALUE)
    setSelectedArea(ALL_VALUE)
  }, [selectedCurriculum])

  useEffect(() => {
    setSelectedSubject(ALL_VALUE)
    setSelectedArea(ALL_VALUE)
  }, [selectedGrade])

  useEffect(() => {
    setSelectedArea(ALL_VALUE)
  }, [selectedSubject])

  const filteredData = useMemo(() => {
    return allData.filter((d) => {
      if (selectedCurriculum !== ALL_VALUE && d.교육과정 !== selectedCurriculum) return false
      if (selectedGrade !== ALL_VALUE && d.학년군 !== selectedGrade) return false
      if (selectedSubject !== ALL_VALUE && d.과목 !== selectedSubject) return false
      if (selectedArea !== ALL_VALUE && d.영역 !== selectedArea) return false
      if (debouncedKeyword) {
        const kw = debouncedKeyword.toLowerCase()
        return (
          d.내용.toLowerCase().includes(kw) ||
          d.코드.toLowerCase().includes(kw) ||
          d.과목.toLowerCase().includes(kw) ||
          d.영역.toLowerCase().includes(kw)
        )
      }
      return true
    })
  }, [allData, selectedCurriculum, selectedGrade, selectedSubject, selectedArea, debouncedKeyword])

  const handleCopy = useCallback(async (item: AchievementStandard) => {
    const text = `${item.코드} ${item.내용}`
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "복사 완료", description: `${item.코드}`, duration: 1500 })
    } catch {
      toast({ title: "복사 실패", variant: "destructive", duration: 1500 })
    }
  }, [toast])

  const handleAddToBasket = useCallback((item: AchievementStandard) => {
    addItem(item as BasketItem)
    toast({ title: "바구니에 추가됨", description: item.코드, duration: 1500 })
  }, [addItem, toast])

  const handleRemoveFromBasket = useCallback((code: string) => {
    removeItem(code)
    toast({ title: "바구니에서 제거됨", duration: 1500 })
  }, [removeItem, toast])

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return
    const newItems = [...basketItems]
    ;[newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]]
    reorderItems(newItems)
  }, [basketItems, reorderItems])

  const handleMoveDown = useCallback((index: number) => {
    if (index === basketItems.length - 1) return
    const newItems = [...basketItems]
    ;[newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]]
    reorderItems(newItems)
  }, [basketItems, reorderItems])

  const hasActiveFilter = selectedCurriculum !== ALL_VALUE || selectedGrade !== ALL_VALUE || selectedSubject !== ALL_VALUE || selectedArea !== ALL_VALUE || keyword

  const resetFilters = () => {
    setSelectedCurriculum(ALL_VALUE)
    setSelectedGrade(ALL_VALUE)
    setSelectedSubject(ALL_VALUE)
    setSelectedArea(ALL_VALUE)
    setKeyword("")
  }

  return (
    <div className="flex min-h-[calc(100vh-56px)]">
      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Search bar area */}
        <div className="bg-card border-b border-border/60 px-4 py-3 space-y-2.5">
          {/* Keyword search */}
          <div className="relative">
            <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[20px]">search</span>
            <Input
              placeholder="키워드 검색 (성취기준 코드, 내용, 과목, 영역...)"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="pl-10 pr-9 h-10 bg-muted/50 border-border/60 focus-visible:bg-background rounded-lg"
              data-testid="keyword-search"
            />
            {keyword && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setKeyword("")}
              >
                <span className="material-icons-outlined text-[18px]">close</span>
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Select value={selectedCurriculum} onValueChange={setSelectedCurriculum}>
              <SelectTrigger className="h-8 text-xs" data-testid="filter-curriculum">
                <SelectValue placeholder="교육과정" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>전체 교육과정</SelectItem>
                {curriculumOptions.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedGrade} onValueChange={setSelectedGrade} disabled={gradeOptions.length === 0}>
              <SelectTrigger className="h-8 text-xs" data-testid="filter-grade">
                <SelectValue placeholder="학년군" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>전체 학년군</SelectItem>
                {gradeOptions.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedSubject} onValueChange={setSelectedSubject} disabled={subjectOptions.length === 0}>
              <SelectTrigger className="h-8 text-xs" data-testid="filter-subject">
                <SelectValue placeholder="과목" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>전체 과목</SelectItem>
                {subjectOptions.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedArea} onValueChange={setSelectedArea} disabled={areaOptions.length === 0}>
              <SelectTrigger className="h-8 text-xs" data-testid="filter-area">
                <SelectValue placeholder="영역" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>전체 영역</SelectItem>
                {areaOptions.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Active filter chips */}
          {hasActiveFilter && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {selectedCurriculum !== ALL_VALUE && (
                <button
                  onClick={() => setSelectedCurriculum(ALL_VALUE)}
                  className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full hover:bg-primary/20 transition-colors"
                >
                  {selectedCurriculum}
                  <span className="material-icons-outlined text-[12px]">close</span>
                </button>
              )}
              {selectedGrade !== ALL_VALUE && (
                <button
                  onClick={() => setSelectedGrade(ALL_VALUE)}
                  className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full hover:bg-primary/20 transition-colors"
                >
                  {selectedGrade}
                  <span className="material-icons-outlined text-[12px]">close</span>
                </button>
              )}
              {selectedSubject !== ALL_VALUE && (
                <button
                  onClick={() => setSelectedSubject(ALL_VALUE)}
                  className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full hover:bg-primary/20 transition-colors"
                >
                  {selectedSubject}
                  <span className="material-icons-outlined text-[12px]">close</span>
                </button>
              )}
              {selectedArea !== ALL_VALUE && (
                <button
                  onClick={() => setSelectedArea(ALL_VALUE)}
                  className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full hover:bg-primary/20 transition-colors"
                >
                  {selectedArea}
                  <span className="material-icons-outlined text-[12px]">close</span>
                </button>
              )}
              {keyword && (
                <button
                  onClick={() => setKeyword("")}
                  className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full hover:bg-primary/20 transition-colors"
                >
                  "{keyword}"
                  <span className="material-icons-outlined text-[12px]">close</span>
                </button>
              )}
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-full hover:bg-muted transition-colors"
              >
                <span className="material-icons-outlined text-[12px]">filter_alt_off</span>
                전체 초기화
              </button>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto p-4">
          {/* Result count */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground">
              {isLoading
                ? "데이터 불러오는 중..."
                : isError
                ? "데이터를 불러오지 못했습니다."
                : `총 ${filteredData.length.toLocaleString()}개 성취기준`}
            </p>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
              <div className="relative">
                <span className="material-icons-outlined text-5xl text-primary/30">auto_stories</span>
                <span className="material-icons-outlined text-2xl text-primary animate-spin absolute -bottom-1 -right-1">refresh</span>
              </div>
              <p className="text-sm font-medium">교육과정 데이터를 불러오는 중입니다...</p>
              <p className="text-xs">데이터 크기가 크므로 잠시 기다려 주세요.</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-2">
              <span className="material-icons-outlined text-5xl text-destructive/40">error_outline</span>
              <p className="text-sm font-medium">데이터를 불러오지 못했습니다.</p>
              <p className="text-xs">네트워크 상태를 확인해 주세요.</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-2">
              <span className="material-icons-outlined text-5xl opacity-30">search_off</span>
              <p className="text-sm font-medium">검색 결과가 없습니다.</p>
              <p className="text-xs">다른 키워드나 필터를 시도해 보세요.</p>
              {hasActiveFilter && (
                <button
                  onClick={resetFilters}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  필터 초기화하기
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredData.map((item) => {
                const inBasket = isInBasket(item.코드)
                return (
                  <div
                    key={item.코드}
                    className="group bg-card border border-border/60 rounded-xl p-3.5 hover:border-primary/30 hover:shadow-sm transition-all"
                    data-testid="achievement-item"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Meta row */}
                        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                          <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">
                            {item.코드}
                          </span>
                          <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">{item.교육과정}</span>
                          <span className="text-[11px] text-muted-foreground">{item.학년군}</span>
                          <span className="text-[11px] text-muted-foreground">·</span>
                          <span className="text-[11px] text-muted-foreground">{item.과목}</span>
                          {item.영역 && (
                            <>
                              <span className="text-[11px] text-muted-foreground">·</span>
                              <span className="text-[11px] text-muted-foreground">{item.영역}</span>
                            </>
                          )}
                        </div>
                        {/* Content */}
                        <p className="text-sm leading-relaxed text-foreground/90">{item.내용}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          title="코드+내용 복사"
                          onClick={() => handleCopy(item)}
                          className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          data-testid="btn-copy"
                        >
                          <span className="material-icons-outlined text-[16px]">content_copy</span>
                        </button>
                        <button
                          title={inBasket ? "바구니에 담긴 항목" : "바구니에 추가"}
                          disabled={inBasket}
                          onClick={() => handleAddToBasket(item)}
                          className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
                            inBasket
                              ? "text-primary bg-primary/10 cursor-default"
                              : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                          }`}
                          data-testid="btn-add-basket"
                        >
                          <span className="material-icons-outlined text-[16px]">
                            {inBasket ? "shopping_basket" : "add_shopping_cart"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Basket sidebar - desktop */}
      <aside className="hidden lg:flex flex-col w-72 border-l border-border/60 bg-card">
        <BasketSidebar
          items={basketItems}
          onRemove={handleRemoveFromBasket}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          onClear={() => setShowClearDialog(true)}
        />
      </aside>

      {/* Basket FAB - mobile */}
      <div className="lg:hidden fixed bottom-5 right-5 z-30">
        <button
          onClick={() => setBasketOpen(true)}
          className="relative flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
        >
          <span className="material-icons-outlined">shopping_basket</span>
          {basketItems.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-sm">
              {basketItems.length}
            </span>
          )}
        </button>
      </div>

      {/* Basket dialog - mobile */}
      <Dialog open={basketOpen} onOpenChange={setBasketOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-4 pt-4 pb-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="material-icons-outlined text-primary text-[20px]">shopping_basket</span>
              수업 바구니
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <BasketSidebar
              items={basketItems}
              onRemove={handleRemoveFromBasket}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onClear={() => setShowClearDialog(true)}
              compact
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Clear basket confirmation */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="material-icons-outlined text-destructive text-[20px]">delete_sweep</span>
              바구니 비우기
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-1">
            바구니의 모든 항목 <strong className="text-foreground">{basketItems.length}개</strong>를 삭제하시겠습니까?
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowClearDialog(false)}>취소</Button>
            <Button
              variant="destructive"
              onClick={() => {
                clearBasket()
                setShowClearDialog(false)
                toast({ title: "바구니를 비웠습니다.", duration: 1500 })
              }}
            >
              비우기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface BasketSidebarProps {
  items: BasketItem[]
  onRemove: (code: string) => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  onClear: () => void
  compact?: boolean
}

function BasketSidebar({ items, onRemove, onMoveUp, onMoveDown, onClear, compact }: BasketSidebarProps) {
  return (
    <div className={compact ? "" : "flex flex-col h-full"}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <span className="material-icons-outlined text-primary text-[18px]">shopping_basket</span>
          <span className="font-semibold text-sm">수업 바구니</span>
          {items.length > 0 && (
            <span className="inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {items.length}
            </span>
          )}
        </div>
        {items.length > 0 && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <span className="material-icons-outlined text-[14px]">delete_sweep</span>
            비우기
          </button>
        )}
      </div>

      {/* Items */}
      <div className={compact ? "space-y-1.5 p-3" : "flex-1 overflow-auto space-y-1.5 p-3"}>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <span className="material-icons-outlined text-4xl opacity-20 mb-2">shopping_basket</span>
            <p className="text-xs font-medium">바구니가 비어있습니다</p>
            <p className="text-xs opacity-70 mt-0.5">성취기준을 추가해 보세요</p>
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={item.코드}
              className="group relative bg-background border border-border/60 rounded-lg p-2.5 hover:border-primary/30 transition-colors text-xs"
            >
              <div className="flex items-start gap-1.5">
                {/* Reorder buttons */}
                <div className="flex flex-col gap-0.5 shrink-0 mt-0.5">
                  <button
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground disabled:opacity-20 transition-all"
                    onClick={() => onMoveUp(index)}
                    disabled={index === 0}
                  >
                    <span className="material-icons-outlined text-[13px]">keyboard_arrow_up</span>
                  </button>
                  <button
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground disabled:opacity-20 transition-all"
                    onClick={() => onMoveDown(index)}
                    disabled={index === items.length - 1}
                  >
                    <span className="material-icons-outlined text-[13px]">keyboard_arrow_down</span>
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="font-mono font-bold text-primary text-[11px]">{item.코드}</span>
                  </div>
                  <p className="text-muted-foreground leading-snug line-clamp-2">{item.내용}</p>
                </div>

                {/* Remove */}
                <button
                  className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 hover:bg-destructive/10 hover:text-destructive rounded transition-all"
                  onClick={() => onRemove(item.코드)}
                >
                  <span className="material-icons-outlined text-[14px]">close</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer CTA */}
      {items.length > 0 && (
        <div className="p-3 border-t border-border/60">
          <Link
            href="/design"
            className="flex items-center justify-center gap-2 w-full rounded-lg bg-primary text-primary-foreground px-3 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
          >
            <span className="material-icons-outlined text-[18px]">edit_note</span>
            수업 디자인하기
          </Link>
        </div>
      )}
    </div>
  )
}
