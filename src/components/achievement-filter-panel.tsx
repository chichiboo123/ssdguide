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

export interface AchievementFilterPanelProps {
  /** Called when user clicks "추가" for an item */
  onAdd: (item: BasketItem) => void
  /** Set of codes already added (to show "added" state) */
  addedCodes: Set<string>
  /** Label for the add button (default: "추가") */
  addLabel?: string
  /** Label when already added (default: "추가됨") */
  addedLabel?: string
  /** Max results to show (default: unlimited) */
  maxResults?: number
}

export function AchievementFilterPanel({
  onAdd,
  addedCodes,
  addLabel = "추가",
  addedLabel = "추가됨",
  maxResults,
}: AchievementFilterPanelProps) {
  const [selectedCurriculum, setSelectedCurriculum] = useState<string>(ALL_VALUE)
  const [selectedGrade, setSelectedGrade] = useState<string>(ALL_VALUE)
  const [selectedSubject, setSelectedSubject] = useState<string>(ALL_VALUE)
  const [selectedArea, setSelectedArea] = useState<string>(ALL_VALUE)
  const [keyword, setKeyword] = useState("")

  const debouncedKeyword = useDebounce(keyword, 300)

  const { data: allData = [], isLoading } = useQuery<AchievementStandard[]>({
    queryKey: ["achievements"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}achievements-simple.json`)
      if (!res.ok) throw new Error("데이터를 불러올 수 없습니다.")
      return res.json()
    },
  })

  // Derived filter options – filter out empty/falsy values
  const curriculumOptions = useMemo(() => {
    const set = new Set(allData.map((d) => d.교육과정).filter(Boolean))
    const arr = Array.from(set)
    arr.sort((a, b) => {
      if (a.includes("2022 개정") && !b.includes("2022 개정")) return -1
      if (!a.includes("2022 개정") && b.includes("2022 개정")) return 1
      return a.localeCompare(b)
    })
    return arr
  }, [allData])

  const gradeOptions = useMemo(() => {
    const filtered =
      selectedCurriculum === ALL_VALUE
        ? allData
        : allData.filter((d) => d.교육과정 === selectedCurriculum)
    return Array.from(new Set(filtered.map((d) => d.학년군).filter(Boolean))).sort()
  }, [allData, selectedCurriculum])

  const subjectOptions = useMemo(() => {
    const filtered = allData.filter((d) => {
      if (selectedCurriculum !== ALL_VALUE && d.교육과정 !== selectedCurriculum) return false
      if (selectedGrade !== ALL_VALUE && d.학년군 !== selectedGrade) return false
      return true
    })
    return Array.from(new Set(filtered.map((d) => d.과목).filter(Boolean))).sort()
  }, [allData, selectedCurriculum, selectedGrade])

  const areaOptions = useMemo(() => {
    const filtered = allData.filter((d) => {
      if (selectedCurriculum !== ALL_VALUE && d.교육과정 !== selectedCurriculum) return false
      if (selectedGrade !== ALL_VALUE && d.학년군 !== selectedGrade) return false
      if (selectedSubject !== ALL_VALUE && d.과목 !== selectedSubject) return false
      return true
    })
    return Array.from(new Set(filtered.map((d) => d.영역).filter(Boolean))).sort()
  }, [allData, selectedCurriculum, selectedGrade, selectedSubject])

  // Cascade reset child filters when parent changes
  // Use a single handler per level to avoid stale closure issues
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
    const results = allData.filter((d) => {
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
    return maxResults ? results.slice(0, maxResults) : results
  }, [allData, selectedCurriculum, selectedGrade, selectedSubject, selectedArea, debouncedKeyword, maxResults])

  const hasActiveFilter =
    selectedCurriculum !== ALL_VALUE ||
    selectedGrade !== ALL_VALUE ||
    selectedSubject !== ALL_VALUE ||
    selectedArea !== ALL_VALUE ||
    keyword

  const resetAll = () => {
    setSelectedCurriculum(ALL_VALUE)
    setSelectedGrade(ALL_VALUE)
    setSelectedSubject(ALL_VALUE)
    setSelectedArea(ALL_VALUE)
    setKeyword("")
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="p-3 border-b space-y-2 shrink-0">
        {/* Keyword search */}
        <div className="relative">
          <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[18px]">search</span>
          <Input
            placeholder="키워드 검색 (성취기준 코드, 내용, 과목, 영역)"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="pl-9"
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

        {/* 4-level filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* 교육과정 */}
          <Select key={`curriculum-${selectedCurriculum}`} value={selectedCurriculum} onValueChange={handleCurriculumChange}>
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

          {/* 학년군 – key forces remount when curriculum changes */}
          <Select
            key={`grade-${selectedCurriculum}`}
            value={selectedGrade}
            onValueChange={handleGradeChange}
            disabled={gradeOptions.length === 0}
          >
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

          {/* 과목 – key forces remount when grade changes */}
          <Select
            key={`subject-${selectedCurriculum}-${selectedGrade}`}
            value={selectedSubject}
            onValueChange={handleSubjectChange}
            disabled={subjectOptions.length === 0}
          >
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

          {/* 영역 – key forces remount when subject changes */}
          <Select
            key={`area-${selectedCurriculum}-${selectedGrade}-${selectedSubject}`}
            value={selectedArea}
            onValueChange={setSelectedArea}
            disabled={areaOptions.length === 0}
          >
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

        {/* Active filter badges + reset */}
        {hasActiveFilter && (
          <div className="flex items-center gap-2 flex-wrap">
            {selectedCurriculum !== ALL_VALUE && (
              <Badge
                variant="secondary"
                className="cursor-pointer"
                onClick={() => handleCurriculumChange(ALL_VALUE)}
              >
                {selectedCurriculum} ✕
              </Badge>
            )}
            {selectedGrade !== ALL_VALUE && (
              <Badge
                variant="secondary"
                className="cursor-pointer"
                onClick={() => handleGradeChange(ALL_VALUE)}
              >
                {selectedGrade} ✕
              </Badge>
            )}
            {selectedSubject !== ALL_VALUE && (
              <Badge
                variant="secondary"
                className="cursor-pointer"
                onClick={() => handleSubjectChange(ALL_VALUE)}
              >
                {selectedSubject} ✕
              </Badge>
            )}
            {selectedArea !== ALL_VALUE && (
              <Badge
                variant="secondary"
                className="cursor-pointer"
                onClick={() => setSelectedArea(ALL_VALUE)}
              >
                {selectedArea} ✕
              </Badge>
            )}
            {keyword && (
              <Badge
                variant="secondary"
                className="cursor-pointer"
                onClick={() => setKeyword("")}
              >
                "{keyword}" ✕
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={resetAll}>
              <span className="material-icons-outlined text-[16px]">filter_alt_off</span>
              필터 초기화
            </Button>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          {isLoading ? "데이터 로딩 중..." : `${filteredData.length.toLocaleString()}개 성취기준`}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto p-2 space-y-1.5">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <span className="material-icons-outlined animate-spin text-primary mr-2">refresh</span>
            데이터를 불러오는 중...
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <span className="material-icons-outlined text-4xl mb-2">search_off</span>
            <p>검색 결과가 없습니다.</p>
          </div>
        ) : (
          filteredData.map((item, idx) => {
            const isAdded = addedCodes.has(item.코드)
            return (
              <div
                key={`${item.코드}-${idx}`}
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
                  <Button
                    size="sm"
                    variant={isAdded ? "secondary" : "default"}
                    disabled={isAdded}
                    onClick={() => onAdd(item as BasketItem)}
                    className="shrink-0"
                  >
                    {isAdded ? addedLabel : addLabel}
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
