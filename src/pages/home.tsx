import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
const FILTER_STORAGE_KEY = "seongsu-filter-state"

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function loadFilterState() {
  try {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

function saveFilterState(state: Record<string, string>) {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state))
  } catch { /* ignore */ }
}

export default function HomePage() {
  const { items: basketItems, addItem, removeItem, reorderItems, clearBasket, isInBasket } = useBasket()
  const { toast } = useToast()

  const savedFilters = useRef(loadFilterState())

  const [selectedCurriculum, setSelectedCurriculum] = useState<string>(savedFilters.current?.curriculum || ALL_VALUE)
  const [selectedGrade, setSelectedGrade] = useState<string>(savedFilters.current?.grade || ALL_VALUE)
  const [selectedSubject, setSelectedSubject] = useState<string>(savedFilters.current?.subject || ALL_VALUE)
  const [selectedArea, setSelectedArea] = useState<string>(savedFilters.current?.area || ALL_VALUE)
  const [keyword, setKeyword] = useState(savedFilters.current?.keyword || "")
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [basketOpen, setBasketOpen] = useState(false)

  const debouncedKeyword = useDebounce(keyword, 300)
  const searchSectionRef = useRef<HTMLDivElement>(null)

  // Persist filters to localStorage
  useEffect(() => {
    saveFilterState({
      curriculum: selectedCurriculum,
      grade: selectedGrade,
      subject: selectedSubject,
      area: selectedArea,
      keyword,
    })
  }, [selectedCurriculum, selectedGrade, selectedSubject, selectedArea, keyword])

  const { data: allData = [], isLoading } = useQuery<AchievementStandard[]>({
    queryKey: ["achievements"],
    queryFn: async () => {
      const res = await fetch("/achievements-simple.json")
      if (!res.ok) throw new Error("데이터를 불러올 수 없습니다.")
      return res.json()
    },
  })

  // Derived filter options
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

  // Validate selected values against available options (fixes 누리과정 filter bug)
  const validGrade = gradeOptions.includes(selectedGrade) ? selectedGrade : ALL_VALUE
  const validSubject = subjectOptions.includes(selectedSubject) ? selectedSubject : ALL_VALUE
  const validArea = areaOptions.includes(selectedArea) ? selectedArea : ALL_VALUE

  // Sync validated values back to state when they differ
  useEffect(() => {
    if (validGrade !== selectedGrade) setSelectedGrade(validGrade)
  }, [validGrade, selectedGrade])
  useEffect(() => {
    if (validSubject !== selectedSubject) setSelectedSubject(validSubject)
  }, [validSubject, selectedSubject])
  useEffect(() => {
    if (validArea !== selectedArea) setSelectedArea(validArea)
  }, [validArea, selectedArea])

  // Direct handlers — reset children immediately (no useEffect cascade)
  const handleCurriculumChange = useCallback((value: string) => {
    setSelectedCurriculum(value)
    setSelectedGrade(ALL_VALUE)
    setSelectedSubject(ALL_VALUE)
    setSelectedArea(ALL_VALUE)
  }, [])

  const handleGradeChange = useCallback((value: string) => {
    setSelectedGrade(value)
    setSelectedSubject(ALL_VALUE)
    setSelectedArea(ALL_VALUE)
  }, [])

  const handleSubjectChange = useCallback((value: string) => {
    setSelectedSubject(value)
    setSelectedArea(ALL_VALUE)
  }, [])

  // Filtered results
  const filteredData = useMemo(() => {
    return allData.filter((d) => {
      if (selectedCurriculum !== ALL_VALUE && d.교육과정 !== selectedCurriculum) return false
      if (validGrade !== ALL_VALUE && d.학년군 !== validGrade) return false
      if (validSubject !== ALL_VALUE && d.과목 !== validSubject) return false
      if (validArea !== ALL_VALUE && d.영역 !== validArea) return false
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
  }, [allData, selectedCurriculum, validGrade, validSubject, validArea, debouncedKeyword])

  const handleCopy = useCallback(async (item: AchievementStandard) => {
    const text = `${item.코드} ${item.내용}`
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "복사 완료", description: text.slice(0, 40) + "...", duration: 1500 })
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

  const hasActiveFilter = selectedCurriculum !== ALL_VALUE || validGrade !== ALL_VALUE || validSubject !== ALL_VALUE || validArea !== ALL_VALUE || keyword

  const scrollToSearch = () => {
    searchSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const resetAllFilters = useCallback(() => {
    setSelectedCurriculum(ALL_VALUE)
    setSelectedGrade(ALL_VALUE)
    setSelectedSubject(ALL_VALUE)
    setSelectedArea(ALL_VALUE)
    setKeyword("")
  }, [])

  return (
    <div className="min-h-[calc(100vh-56px)]">
      {/* ──── Hero Section ──── */}
      <section className="hero-gradient relative overflow-hidden">
        {/* Decorative shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-[28rem] h-[28rem] bg-white/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] bg-indigo-400/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 pt-16 pb-20 md:pt-24 md:pb-28 text-center">
          <div className="animate-fade-in-up">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-1.5 text-sm text-white/90 mb-6">
              <span className="material-icons-outlined text-[16px]">school</span>
              국가 교육과정 성취기준 검색 도구
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight mb-4 animate-fade-in-up">
            성취기준,
            <br />
            수업을 함께 디자인하는 동료
          </h1>

          <p className="text-base sm:text-lg text-white/75 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up-delay">
            국가 교육과정 성취기준을 검색하고 바구니에 담아 보세요.
            <br />
            7단계 수업 디자인 기능으로 체계적인 수업을 디자인해보세요.
          </p>

          {/* Hero search bar */}
          <div className="max-w-xl mx-auto animate-fade-in-up-delay-2">
            <div className="glass rounded-2xl p-1.5">
              <div className="relative">
                <span className="material-icons-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/60 text-[20px]">search</span>
                <input
                  type="text"
                  placeholder="성취기준 코드, 내용, 과목, 영역으로 검색"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onFocus={scrollToSearch}
                  className="w-full h-12 pl-12 pr-4 rounded-xl bg-white/10 text-white placeholder:text-white/50 border-0 outline-none focus:bg-white/20 transition-colors text-sm sm:text-base"
                />
                {keyword && (
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                    onClick={() => setKeyword("")}
                  >
                    <span className="material-icons-outlined text-[18px]">close</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick stats */}
          {!isLoading && allData.length > 0 && (
            <div className="flex items-center justify-center gap-6 mt-8 animate-fade-in-up-delay-2">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{allData.length.toLocaleString()}</div>
                <div className="text-xs text-white/60">성취기준</div>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{curriculumOptions.length}</div>
                <div className="text-xs text-white/60">교육과정</div>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <div className="text-center">
                <div className="text-2xl font-bold text-white">7</div>
                <div className="text-xs text-white/60">단계 수업 디자인</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ──── Search & Results Section ──── */}
      <div ref={searchSectionRef} className="flex flex-col lg:flex-row max-w-6xl mx-auto">
        {/* Main content */}
        <div className="flex-1 px-4 lg:px-6 py-6 overflow-auto">
          {/* Filters */}
          <div className="mb-6 space-y-4">
            {/* Desktop search (duplicated from hero for when scrolled) */}
            <div className="relative lg:hidden">
              <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[18px]">search</span>
              <Input
                placeholder="키워드 검색"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="pl-9 h-10 rounded-xl"
                data-testid="keyword-search"
              />
              {keyword && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setKeyword("")}
                >
                  <span className="material-icons-outlined text-[18px]">close</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Select value={selectedCurriculum} onValueChange={handleCurriculumChange}>
                <SelectTrigger data-testid="filter-curriculum" className="rounded-xl h-10">
                  <SelectValue placeholder="교육과정" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>전체 교육과정</SelectItem>
                  {curriculumOptions.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={validGrade}
                onValueChange={handleGradeChange}
                disabled={gradeOptions.length === 0}
              >
                <SelectTrigger data-testid="filter-grade" className="rounded-xl h-10">
                  <SelectValue placeholder="학년군" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>전체 학년군</SelectItem>
                  {gradeOptions.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={validSubject}
                onValueChange={handleSubjectChange}
                disabled={subjectOptions.length === 0}
              >
                <SelectTrigger data-testid="filter-subject" className="rounded-xl h-10">
                  <SelectValue placeholder="과목" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>전체 과목</SelectItem>
                  {subjectOptions.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={validArea}
                onValueChange={setSelectedArea}
                disabled={areaOptions.length === 0}
              >
                <SelectTrigger data-testid="filter-area" className="rounded-xl h-10">
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

            {hasActiveFilter && (
              <div className="flex items-center gap-2 flex-wrap">
                {selectedCurriculum !== ALL_VALUE && (
                  <Badge variant="secondary" className="cursor-pointer gap-1 rounded-full pl-3 pr-2 py-1" onClick={() => handleCurriculumChange(ALL_VALUE)}>
                    {selectedCurriculum}
                    <span className="material-icons-outlined text-[14px]">close</span>
                  </Badge>
                )}
                {validGrade !== ALL_VALUE && (
                  <Badge variant="secondary" className="cursor-pointer gap-1 rounded-full pl-3 pr-2 py-1" onClick={() => handleGradeChange(ALL_VALUE)}>
                    {validGrade}
                    <span className="material-icons-outlined text-[14px]">close</span>
                  </Badge>
                )}
                {validSubject !== ALL_VALUE && (
                  <Badge variant="secondary" className="cursor-pointer gap-1 rounded-full pl-3 pr-2 py-1" onClick={() => handleSubjectChange(ALL_VALUE)}>
                    {validSubject}
                    <span className="material-icons-outlined text-[14px]">close</span>
                  </Badge>
                )}
                {validArea !== ALL_VALUE && (
                  <Badge variant="secondary" className="cursor-pointer gap-1 rounded-full pl-3 pr-2 py-1" onClick={() => setSelectedArea(ALL_VALUE)}>
                    {validArea}
                    <span className="material-icons-outlined text-[14px]">close</span>
                  </Badge>
                )}
                {keyword && (
                  <Badge variant="secondary" className="cursor-pointer gap-1 rounded-full pl-3 pr-2 py-1" onClick={() => setKeyword("")}>
                    &ldquo;{keyword}&rdquo;
                    <span className="material-icons-outlined text-[14px]">close</span>
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetAllFilters}
                  className="rounded-full text-muted-foreground"
                >
                  <span className="material-icons-outlined text-[16px]">filter_alt_off</span>
                  초기화
                </Button>
              </div>
            )}
          </div>

          {/* Results count */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {isLoading ? "데이터 로딩 중..." : `검색 결과 ${filteredData.length.toLocaleString()}개`}
            </p>
          </div>

          {/* Results */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <span className="material-icons-outlined animate-spin text-primary text-[32px] mb-3">refresh</span>
              <p className="text-sm">데이터를 불러오는 중...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <span className="material-icons-outlined text-[48px] mb-3 opacity-30">search_off</span>
              <p className="font-medium mb-1">검색 결과가 없습니다</p>
              <p className="text-sm">다른 키워드나 필터를 시도해보세요.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredData.map((item) => {
                const inBasket = isInBasket(item.코드)
                return (
                  <div
                    key={item.코드}
                    className="group bg-card border rounded-xl p-4 hover:shadow-md hover:border-primary/20 transition-all duration-200"
                    data-testid="achievement-item"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="font-mono text-xs font-bold text-primary bg-primary/8 px-2 py-0.5 rounded-md">
                            {item.코드}
                          </span>
                          <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{item.교육과정}</span>
                          <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{item.학년군}</span>
                          <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{item.과목}</span>
                          {item.영역 && <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{item.영역}</span>}
                        </div>
                        <p className="text-sm leading-relaxed text-foreground/90">{item.내용}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="복사"
                          onClick={() => handleCopy(item)}
                          className="rounded-lg"
                          data-testid="btn-copy"
                        >
                          <span className="material-icons-outlined text-[16px]">content_copy</span>
                        </Button>
                        <Button
                          variant={inBasket ? "secondary" : "ghost"}
                          size="icon-sm"
                          title={inBasket ? "바구니에서 제거" : "바구니에 추가"}
                          disabled={inBasket}
                          onClick={() => handleAddToBasket(item)}
                          className="rounded-lg"
                          data-testid="btn-add-basket"
                        >
                          <span className="material-icons-outlined text-[16px]">
                            {inBasket ? "shopping_basket" : "add_shopping_cart"}
                          </span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Basket sidebar - desktop */}
        <aside className="hidden lg:flex flex-col w-72 border-l bg-card/50 sticky top-14 h-[calc(100vh-56px)]">
          <BasketSidebar
            items={basketItems}
            onRemove={handleRemoveFromBasket}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            onClear={() => setShowClearDialog(true)}
          />
        </aside>
      </div>

      {/* Basket button - mobile */}
      <div className="lg:hidden fixed bottom-6 right-4 z-30">
        <Button
          onClick={() => setBasketOpen(true)}
          className="rounded-2xl shadow-xl h-14 w-14 bg-primary hover:bg-primary/90"
          size="icon"
        >
          <span className="material-icons-outlined text-white">shopping_basket</span>
          {basketItems.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[11px] font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-sm">
              {basketItems.length}
            </span>
          )}
        </Button>
      </div>

      {/* Basket dialog - mobile */}
      <Dialog open={basketOpen} onOpenChange={setBasketOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden flex flex-col rounded-t-2xl sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="material-icons-outlined text-primary">shopping_basket</span>
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
        <DialogContent className="sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>바구니 비우기</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            바구니의 모든 항목({basketItems.length}개)을 삭제하시겠습니까?
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowClearDialog(false)} className="rounded-xl">
              취소
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
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
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <span className="material-icons-outlined text-[20px] text-primary">shopping_basket</span>
          <span className="font-semibold text-sm">수업 바구니</span>
          {items.length > 0 && (
            <Badge variant="secondary" className="text-xs rounded-full">{items.length}</Badge>
          )}
        </div>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear} className="text-destructive hover:text-destructive rounded-lg">
            <span className="material-icons-outlined text-[16px]">delete_sweep</span>
            <span className="ml-1 text-xs">비우기</span>
          </Button>
        )}
      </div>

      <div className={`custom-scrollbar ${compact ? "space-y-1.5 p-3" : "flex-1 overflow-auto space-y-1.5 p-3"}`}>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm">
            <span className="material-icons-outlined text-[40px] mb-3 opacity-25">shopping_basket</span>
            <p className="font-medium">바구니가 비어있습니다</p>
            <p className="text-xs mt-1 text-muted-foreground/70">성취기준을 추가해보세요</p>
          </div>
        ) : (
          items.map((item, index) => (
            <div key={item.코드} className="group border rounded-xl p-2.5 bg-background text-xs flex items-start gap-1.5 hover:border-primary/20 transition-colors">
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-accent rounded-md transition-opacity"
                  onClick={() => onMoveUp(index)}
                  disabled={index === 0}
                >
                  <span className="material-icons-outlined text-[14px]">keyboard_arrow_up</span>
                </button>
                <button
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-accent rounded-md transition-opacity"
                  onClick={() => onMoveDown(index)}
                  disabled={index === items.length - 1}
                >
                  <span className="material-icons-outlined text-[14px]">keyboard_arrow_down</span>
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-mono font-semibold text-primary">{item.코드}</div>
                <div className="text-muted-foreground leading-tight mt-0.5 line-clamp-2">{item.내용}</div>
              </div>
              <button
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/10 hover:text-destructive rounded-md shrink-0 transition-opacity"
                onClick={() => onRemove(item.코드)}
              >
                <span className="material-icons-outlined text-[14px]">close</span>
              </button>
            </div>
          ))
        )}
      </div>

      {items.length > 0 && (
        <div className="p-3 border-t">
          <a
            href="/design"
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary text-white px-3 py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
          >
            <span className="material-icons-outlined text-[18px]">edit_note</span>
            수업 디자인하기
          </a>
        </div>
      )}
    </div>
  )
}
