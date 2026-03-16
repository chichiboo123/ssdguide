import { useState, useEffect, useMemo, useCallback } from "react"
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

  const { data: allData = [], isLoading } = useQuery<AchievementStandard[]>({
    queryKey: ["achievements"],
    queryFn: async () => {
      const res = await fetch("/data/achievements-simple.json")
      if (!res.ok) throw new Error("데이터를 불러올 수 없습니다.")
      return res.json()
    },
  })

  // Derived filter options
  const curriculumOptions = useMemo(() => {
    const set = new Set(allData.map((d) => d.교육과정))
    const arr = Array.from(set)
    // 2022 개정 우선
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

  // Reset child filters when parent changes
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

  // Filtered results
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

  const hasActiveFilter = selectedCurriculum !== ALL_VALUE || selectedGrade !== ALL_VALUE || selectedSubject !== ALL_VALUE || selectedArea !== ALL_VALUE || keyword

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-56px)]">
      {/* Main content */}
      <div className="flex-1 p-4 lg:p-6 overflow-auto">
        {/* Search & Filters */}
        <div className="mb-4 space-y-3">
          <div className="relative">
            <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[18px]">search</span>
            <Input
              placeholder="키워드 검색 (성취기준 코드, 내용, 과목, 영역)"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="pl-9"
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

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Select value={selectedCurriculum} onValueChange={setSelectedCurriculum}>
              <SelectTrigger data-testid="filter-curriculum">
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
              <SelectTrigger data-testid="filter-grade">
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
              <SelectTrigger data-testid="filter-subject">
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
              <SelectTrigger data-testid="filter-area">
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
                <Badge variant="secondary" className="cursor-pointer" onClick={() => setSelectedCurriculum(ALL_VALUE)}>
                  {selectedCurriculum} ✕
                </Badge>
              )}
              {selectedGrade !== ALL_VALUE && (
                <Badge variant="secondary" className="cursor-pointer" onClick={() => setSelectedGrade(ALL_VALUE)}>
                  {selectedGrade} ✕
                </Badge>
              )}
              {selectedSubject !== ALL_VALUE && (
                <Badge variant="secondary" className="cursor-pointer" onClick={() => setSelectedSubject(ALL_VALUE)}>
                  {selectedSubject} ✕
                </Badge>
              )}
              {selectedArea !== ALL_VALUE && (
                <Badge variant="secondary" className="cursor-pointer" onClick={() => setSelectedArea(ALL_VALUE)}>
                  {selectedArea} ✕
                </Badge>
              )}
              {keyword && (
                <Badge variant="secondary" className="cursor-pointer" onClick={() => setKeyword("")}>
                  "{keyword}" ✕
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedCurriculum(ALL_VALUE)
                  setSelectedGrade(ALL_VALUE)
                  setSelectedSubject(ALL_VALUE)
                  setSelectedArea(ALL_VALUE)
                  setKeyword("")
                }}
              >
                <span className="material-icons-outlined text-[16px]">filter_alt_off</span>
                필터 초기화
              </Button>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="text-sm text-muted-foreground mb-2">
          {isLoading ? "데이터 로딩 중..." : `${filteredData.length.toLocaleString()}개 성취기준`}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <span className="material-icons-outlined animate-spin text-primary mr-2">refresh</span>
            데이터를 불러오는 중...
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <span className="material-icons-outlined text-4xl mb-2">search_off</span>
            <p>검색 결과가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredData.map((item) => {
              const inBasket = isInBasket(item.코드)
              return (
                <div
                  key={item.코드}
                  className="group border rounded-lg p-3 bg-card hover:bg-accent/30 transition-colors"
                  data-testid="achievement-item"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-xs font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          {item.코드}
                        </span>
                        <span className="text-xs text-muted-foreground">{item.교육과정}</span>
                        <span className="text-xs text-muted-foreground">{item.학년군}</span>
                        <span className="text-xs text-muted-foreground">{item.과목}</span>
                        <span className="text-xs text-muted-foreground">{item.영역}</span>
                      </div>
                      <p className="text-sm leading-relaxed">{item.내용}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="복사"
                        onClick={() => handleCopy(item)}
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
      <aside className="hidden lg:flex flex-col w-72 border-l bg-muted/20">
        <BasketSidebar
          items={basketItems}
          onRemove={handleRemoveFromBasket}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          onClear={() => setShowClearDialog(true)}
        />
      </aside>

      {/* Basket button - mobile */}
      <div className="lg:hidden fixed bottom-4 right-4 z-30">
        <Button onClick={() => setBasketOpen(true)} className="rounded-full shadow-lg h-14 w-14" size="icon">
          <span className="material-icons-outlined">shopping_basket</span>
          {basketItems.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {basketItems.length}
            </span>
          )}
        </Button>
      </div>

      {/* Basket dialog - mobile */}
      <Dialog open={basketOpen} onOpenChange={setBasketOpen}>
        <DialogContent className="max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="material-icons-outlined">shopping_basket</span>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>바구니 비우기</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            바구니의 모든 항목({basketItems.length}개)을 삭제하시겠습니까?
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
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <span className="material-icons-outlined text-[18px]">shopping_basket</span>
          <span className="font-medium text-sm">수업 바구니</span>
          {items.length > 0 && (
            <Badge variant="secondary" className="text-xs">{items.length}</Badge>
          )}
        </div>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear} className="text-destructive hover:text-destructive">
            <span className="material-icons-outlined text-[16px]">delete_sweep</span>
            <span className="ml-1 text-xs">비우기</span>
          </Button>
        )}
      </div>

      <div className={compact ? "space-y-1 p-2" : "flex-1 overflow-auto space-y-1 p-2"}>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm">
            <span className="material-icons-outlined text-3xl mb-2 opacity-40">shopping_basket</span>
            <p>바구니가 비어있습니다.</p>
            <p className="text-xs mt-1">성취기준을 추가해보세요.</p>
          </div>
        ) : (
          items.map((item, index) => (
            <div key={item.코드} className="group border rounded p-2 bg-background text-xs flex items-start gap-1">
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-accent rounded"
                  onClick={() => onMoveUp(index)}
                  disabled={index === 0}
                >
                  <span className="material-icons-outlined text-[14px]">keyboard_arrow_up</span>
                </button>
                <button
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-accent rounded"
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
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/10 hover:text-destructive rounded shrink-0"
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
            className="flex items-center justify-center gap-2 w-full rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <span className="material-icons-outlined text-[18px]">edit_note</span>
            수업 디자인하기
          </a>
        </div>
      )}
    </div>
  )
}
