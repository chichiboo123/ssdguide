import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import type {
  LessonDesign,
  LessonProcessStep,
  EvaluationEntry,
  MaterialEntry,
  BasketItem,
} from "@/lib/types"

const EVAL_METHODS = [
  "관찰 평가", "포트폴리오", "자기평가", "동료평가",
  "수행 평가", "서술형 평가", "지필 평가", "프로젝트 평가", "토론 평가",
]

const LESSON_STORAGE_KEY = "seongsu-lesson-design"

function genId() {
  return Math.random().toString(36).slice(2, 9)
}

function loadLessonDesign(): Partial<LessonDesign> | null {
  try {
    const stored = localStorage.getItem(LESSON_STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

function saveLessonDesign(data: LessonDesign) {
  try {
    localStorage.setItem(LESSON_STORAGE_KEY, JSON.stringify(data))
  } catch { /* ignore */ }
}

function SectionBadge({ number }: { number: number }) {
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
      {number}
    </span>
  )
}

export default function LessonDesignPage() {
  const { items: basketItems, addItem } = useBasket()
  const { toast } = useToast()

  const savedDesign = useRef(loadLessonDesign())

  const [title, setTitle] = useState(savedDesign.current?.title || "")
  const [author, setAuthor] = useState(savedDesign.current?.author || "")
  const [standards, setStandards] = useState<BasketItem[]>(
    savedDesign.current?.standards?.length ? savedDesign.current.standards : [...basketItems]
  )
  const [intent, setIntent] = useState(savedDesign.current?.intent || "")
  const [objective, setObjective] = useState(savedDesign.current?.objective || "")
  const [process, setProcess] = useState(savedDesign.current?.process || "")
  const [useTableMode, setUseTableMode] = useState(savedDesign.current?.useTableMode || false)
  const [processSteps, setProcessSteps] = useState<LessonProcessStep[]>(
    savedDesign.current?.processSteps?.length ? savedDesign.current.processSteps : [{ id: genId(), period: "", topic: "", content: "", note: "" }]
  )
  const [evaluations, setEvaluations] = useState<EvaluationEntry[]>(
    savedDesign.current?.evaluations?.length ? savedDesign.current.evaluations : [{ id: genId(), subject: "", methods: [], content: "" }]
  )
  const [materials, setMaterials] = useState<MaterialEntry[]>(
    savedDesign.current?.materials?.length ? savedDesign.current.materials : [{ id: genId(), type: "text", content: "" }]
  )
  const [showSearchDialog, setShowSearchDialog] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-save to localStorage (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveLessonDesign({ title, author, standards, intent, objective, process, useTableMode, processSteps, evaluations, materials })
    }, 500)
    return () => clearTimeout(timer)
  }, [title, author, standards, intent, objective, process, useTableMode, processSteps, evaluations, materials])

  // --- Standards section ---
  const handleSortStandards = useCallback((asc: boolean) => {
    setStandards((prev) => [...prev].sort((a, b) => asc ? a.코드.localeCompare(b.코드) : b.코드.localeCompare(a.코드)))
  }, [])

  const handleRemoveStandard = useCallback((code: string) => {
    setStandards((prev) => prev.filter((s) => s.코드 !== code))
  }, [])

  const handleMoveStandard = useCallback((index: number, dir: -1 | 1) => {
    setStandards((prev) => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }, [])

  const handleCopyStandards = useCallback(async () => {
    const text = standards.map((s) => `${s.코드} ${s.내용}`).join("\n")
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "성취기준 복사 완료", duration: 1500 })
    } catch {
      toast({ title: "복사 실패", variant: "destructive", duration: 1500 })
    }
  }, [standards, toast])

  // --- Process steps ---
  const addStep = () => setProcessSteps((p) => [...p, { id: genId(), period: "", topic: "", content: "", note: "" }])
  const removeStep = (id: string) => setProcessSteps((p) => p.filter((s) => s.id !== id))
  const updateStep = (id: string, field: keyof LessonProcessStep, value: string) => {
    setProcessSteps((p) => p.map((s) => s.id === id ? { ...s, [field]: value } : s))
  }

  const copyProcessTable = useCallback(async () => {
    const header = "| 차시 | 수업 주제 | 내용 | 비고 |"
    const divider = "| --- | --- | --- | --- |"
    const rows = processSteps.map((s) => `| ${s.period} | ${s.topic} | ${s.content} | ${s.note} |`)
    const text = [header, divider, ...rows].join("\n")
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "수업 과정 표 복사 완료", duration: 1500 })
    } catch {
      toast({ title: "복사 실패", variant: "destructive", duration: 1500 })
    }
  }, [processSteps, toast])

  // --- Evaluations ---
  const addEval = () => setEvaluations((p) => [...p, { id: genId(), subject: "", methods: [], content: "" }])
  const removeEval = (id: string) => setEvaluations((p) => p.filter((e) => e.id !== id))
  const moveEval = (index: number, dir: -1 | 1) => {
    setEvaluations((prev) => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }
  const updateEval = (id: string, field: keyof Omit<EvaluationEntry, 'id' | 'methods'>, value: string) => {
    setEvaluations((p) => p.map((e) => e.id === id ? { ...e, [field]: value } : e))
  }
  const toggleEvalMethod = (id: string, method: string) => {
    setEvaluations((p) => p.map((e) => {
      if (e.id !== id) return e
      const methods = e.methods.includes(method)
        ? e.methods.filter((m) => m !== method)
        : [...e.methods, method]
      return { ...e, methods }
    }))
  }

  // --- Materials ---
  const addMaterial = (type: MaterialEntry['type']) => {
    setMaterials((p) => [...p, { id: genId(), type, content: "" }])
  }
  const removeMaterial = (id: string) => setMaterials((p) => p.filter((m) => m.id !== id))
  const updateMaterial = (id: string, data: Partial<MaterialEntry>) => {
    setMaterials((p) => p.map((m) => m.id === id ? { ...m, ...data } : m))
  }
  const handleImageUpload = useCallback((id: string, file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      updateMaterial(id, { fileData: e.target?.result as string, fileName: file.name })
    }
    reader.readAsDataURL(file)
  }, [])

  // --- Export / Import ---
  const buildDesign = useCallback((): LessonDesign => ({
    title, author, standards, intent, objective, process, useTableMode, processSteps, evaluations, materials
  }), [title, author, standards, intent, objective, process, useTableMode, processSteps, evaluations, materials])

  const handleJsonExport = () => {
    const data = buildDesign()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `수업디자인_${title || "제목없음"}_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: "JSON 파일 저장 완료", duration: 1500 })
  }

  const handleJsonImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data: LessonDesign = JSON.parse(ev.target?.result as string)
        setTitle(data.title || "")
        setAuthor(data.author || "")
        setStandards(data.standards || [])
        setIntent(data.intent || "")
        setObjective(data.objective || "")
        setProcess(data.process || "")
        setUseTableMode(data.useTableMode || false)
        setProcessSteps(data.processSteps || [])
        setEvaluations(data.evaluations || [])
        setMaterials(data.materials || [])
        toast({ title: "불러오기 완료", duration: 1500 })
      } catch {
        toast({ title: "파일 형식 오류", variant: "destructive", duration: 1500 })
      }
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  const handleTxtDownload = () => {
    const lines: string[] = []
    lines.push(`수업 디자인: ${title}`)
    if (author) lines.push(`수업자: ${author}`)
    lines.push("")
    lines.push("■ 관련 성취기준")
    standards.forEach((s) => lines.push(`  ${s.코드} ${s.내용}`))
    lines.push("")
    lines.push("■ 수업자 의도")
    lines.push(intent || "(미작성)")
    lines.push("")
    lines.push("■ 수업 목표")
    lines.push(objective || "(미작성)")
    lines.push("")
    lines.push("■ 수업 과정")
    if (useTableMode) {
      processSteps.forEach((s) => {
        lines.push(`  [${s.period}차시] ${s.topic}: ${s.content}`)
      })
    } else {
      lines.push(process || "(미작성)")
    }
    lines.push("")
    lines.push("■ 평가 계획")
    evaluations.forEach((e, i) => {
      lines.push(`  ${i + 1}. ${e.subject} | ${e.methods.join(", ")} | ${e.content}`)
    })
    lines.push("")
    lines.push("■ 수업 자료 및 아이디어")
    materials.forEach((m) => {
      if (m.type === "text") lines.push(`  - ${m.content}`)
      else if (m.type === "link") lines.push(`  - [${m.title || m.url}] ${m.url}`)
      else if (m.type === "image") lines.push(`  - [이미지] ${m.fileName || ""}`)
    })

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `수업디자인_${title || "제목없음"}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: "TXT 파일 저장 완료", duration: 1500 })
  }

  const handleCopyAll = async () => {
    const lines: string[] = []
    lines.push(`# ${title || "제목 없음"}`)
    if (author) lines.push(`> 수업자: ${author}`)
    lines.push("")
    lines.push("## 1. 관련 성취기준")
    standards.forEach((s) => lines.push(`- **${s.코드}** ${s.내용}`))
    lines.push("")
    lines.push("## 2. 수업자 의도")
    lines.push(intent || "")
    lines.push("")
    lines.push("## 3. 수업 목표")
    lines.push(objective || "")
    lines.push("")
    lines.push("## 4. 수업 과정")
    if (useTableMode) {
      lines.push("| 차시 | 수업 주제 | 내용 | 비고 |")
      lines.push("| --- | --- | --- | --- |")
      processSteps.forEach((s) => lines.push(`| ${s.period} | ${s.topic} | ${s.content} | ${s.note} |`))
    } else {
      lines.push(process || "")
    }
    lines.push("")
    lines.push("## 5. 평가 계획")
    evaluations.forEach((e, i) => {
      lines.push(`### ${i + 1}. ${e.subject}`)
      lines.push(`- 평가 방법: ${e.methods.join(", ")}`)
      lines.push(`- 평가 내용: ${e.content}`)
    })
    lines.push("")
    lines.push("## 6. 수업 자료")
    materials.forEach((m) => {
      if (m.type === "text") lines.push(`- ${m.content}`)
      else if (m.type === "link") lines.push(`- [${m.title || m.url}](${m.url})`)
      else if (m.type === "image") lines.push(`- 이미지: ${m.fileName}`)
    })

    try {
      await navigator.clipboard.writeText(lines.join("\n"))
      toast({ title: "클립보드에 복사 완료", duration: 1500 })
    } catch {
      toast({ title: "복사 실패", variant: "destructive", duration: 1500 })
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 lg:p-8 space-y-6 pb-16">
      {/* Header actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span className="material-icons-outlined text-primary text-[28px]">edit_note</span>
          수업 디자인
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleJsonExport} className="rounded-xl">
            <span className="material-icons-outlined text-[16px]">download</span>
            JSON 저장
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="rounded-xl">
            <span className="material-icons-outlined text-[16px]">upload</span>
            JSON 불러오기
          </Button>
          <Button variant="outline" size="sm" onClick={handleTxtDownload} className="rounded-xl">
            <span className="material-icons-outlined text-[16px]">text_snippet</span>
            TXT
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyAll} className="rounded-xl">
            <span className="material-icons-outlined text-[16px]">content_copy</span>
            전체 복사
          </Button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleJsonImport} />
        </div>
      </div>

      {/* Step 1: Title */}
      <section className="border rounded-xl p-5 space-y-3 bg-card shadow-sm">
        <div className="flex items-center gap-2">
          <SectionBadge number={1} />
          <h2 className="font-semibold">수업(프로젝트) 주제명</h2>
        </div>
        <Input
          placeholder="수업 주제를 입력하세요"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          data-testid="lesson-title"
        />
        <Input
          placeholder="수업자 이름 (선택)"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          data-testid="lesson-author"
        />
      </section>

      {/* Step 2: Standards */}
      <section className="border rounded-xl p-5 space-y-3 bg-card shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <SectionBadge number={2} />
            <h2 className="font-semibold">관련 성취기준</h2>
            {standards.length > 0 && <Badge variant="secondary">{standards.length}</Badge>}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setShowSearchDialog(true)}>
              <span className="material-icons-outlined text-[16px]">add</span>
              추가
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleSortStandards(true)}>
              <span className="material-icons-outlined text-[16px]">sort</span>
              오름차순
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleSortStandards(false)}>
              <span className="material-icons-outlined text-[16px]">sort</span>
              내림차순
            </Button>
            {standards.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleCopyStandards}>
                <span className="material-icons-outlined text-[16px]">content_copy</span>
                복사
              </Button>
            )}
          </div>
        </div>
        {standards.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
            <span className="material-icons-outlined block text-3xl mb-1 opacity-40">add_circle</span>
            추가 버튼을 눌러 성취기준을 추가하세요
          </div>
        ) : (
          <div className="space-y-1.5">
            {standards.map((s, index) => (
              <div key={s.코드} className="group flex items-start gap-1.5 border rounded p-2.5 text-sm bg-card">
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-accent rounded disabled:opacity-20"
                    onClick={() => handleMoveStandard(index, -1)}
                    disabled={index === 0}
                  >
                    <span className="material-icons-outlined text-[14px]">keyboard_arrow_up</span>
                  </button>
                  <button
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-accent rounded disabled:opacity-20"
                    onClick={() => handleMoveStandard(index, 1)}
                    disabled={index === standards.length - 1}
                  >
                    <span className="material-icons-outlined text-[14px]">keyboard_arrow_down</span>
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-mono font-semibold text-primary text-xs">{s.코드}</span>
                  <span className="ml-2 text-muted-foreground text-xs">{s.교육과정} · {s.학년군} · {s.과목} · {s.영역}</span>
                  <p className="mt-0.5">{s.내용}</p>
                </div>
                <button
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/10 hover:text-destructive rounded shrink-0"
                  onClick={() => handleRemoveStandard(s.코드)}
                >
                  <span className="material-icons-outlined text-[14px]">close</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Step 3: Intent */}
      <section className="border rounded-xl p-5 space-y-3 bg-card shadow-sm">
        <div className="flex items-center gap-2">
          <SectionBadge number={3} />
          <h2 className="font-semibold">수업자 의도</h2>
        </div>
        <Textarea
          placeholder="이 수업을 통해 학생들이 무엇을 경험하고 배우기를 바라는지 서술하세요."
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          className="min-h-[100px]"
          data-testid="lesson-intent"
        />
      </section>

      {/* Step 4: Objective */}
      <section className="border rounded-xl p-5 space-y-3 bg-card shadow-sm">
        <div className="flex items-center gap-2">
          <SectionBadge number={4} />
          <h2 className="font-semibold">수업 목표</h2>
        </div>
        <Textarea
          placeholder="수업이 끝난 후 학생들이 할 수 있게 되는 것을 구체적으로 작성하세요."
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          className="min-h-[100px]"
          data-testid="lesson-objective"
        />
      </section>

      {/* Step 5: Process */}
      <section className="border rounded-xl p-5 space-y-3 bg-card shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <SectionBadge number={5} />
            <h2 className="font-semibold">수업 과정</h2>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={useTableMode ? "default" : "outline"}
              size="sm"
              onClick={() => setUseTableMode(true)}
            >
              <span className="material-icons-outlined text-[16px]">table_chart</span>
              표 형식
            </Button>
            <Button
              variant={!useTableMode ? "default" : "outline"}
              size="sm"
              onClick={() => setUseTableMode(false)}
            >
              <span className="material-icons-outlined text-[16px]">notes</span>
              자유 작성
            </Button>
          </div>
        </div>

        {useTableMode ? (
          <div className="space-y-2">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted">
                    <th className="border p-2 text-left w-16">차시</th>
                    <th className="border p-2 text-left w-32">수업 주제</th>
                    <th className="border p-2 text-left">내용</th>
                    <th className="border p-2 text-left w-24">비고</th>
                    <th className="border p-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {processSteps.map((step) => (
                    <tr key={step.id} className="group">
                      <td className="border p-1">
                        <Input value={step.period} onChange={(e) => updateStep(step.id, "period", e.target.value)} className="h-7 text-xs border-0 p-1" placeholder="1-2" />
                      </td>
                      <td className="border p-1">
                        <Input value={step.topic} onChange={(e) => updateStep(step.id, "topic", e.target.value)} className="h-7 text-xs border-0 p-1" />
                      </td>
                      <td className="border p-1">
                        <Textarea value={step.content} onChange={(e) => updateStep(step.id, "content", e.target.value)} className="min-h-[60px] text-xs border-0 p-1 resize-none" />
                      </td>
                      <td className="border p-1">
                        <Input value={step.note} onChange={(e) => updateStep(step.id, "note", e.target.value)} className="h-7 text-xs border-0 p-1" />
                      </td>
                      <td className="border p-1">
                        <button
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/10 hover:text-destructive rounded"
                          onClick={() => removeStep(step.id)}
                          disabled={processSteps.length === 1}
                        >
                          <span className="material-icons-outlined text-[14px]">close</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={addStep}>
                <span className="material-icons-outlined text-[16px]">add</span>
                행 추가
              </Button>
              <Button variant="outline" size="sm" onClick={copyProcessTable}>
                <span className="material-icons-outlined text-[16px]">content_copy</span>
                마크다운 복사
              </Button>
            </div>
          </div>
        ) : (
          <Textarea
            placeholder="수업 과정을 자유롭게 서술하세요. (활동 내용, 흐름, 시간 배분 등)"
            value={process}
            onChange={(e) => setProcess(e.target.value)}
            className="min-h-[160px]"
            data-testid="lesson-process"
          />
        )}
      </section>

      {/* Step 6: Evaluation */}
      <section className="border rounded-xl p-5 space-y-3 bg-card shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SectionBadge number={6} />
            <h2 className="font-semibold">평가 계획</h2>
          </div>
          <Button variant="outline" size="sm" onClick={addEval}>
            <span className="material-icons-outlined text-[16px]">add</span>
            추가
          </Button>
        </div>
        <div className="space-y-3">
          {evaluations.map((ev, index) => (
            <div key={ev.id} className="group border rounded-lg p-3 space-y-2 bg-card">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">#{index + 1}</span>
                <Input
                  placeholder="평가 대상 / 제목"
                  value={ev.subject}
                  onChange={(e) => updateEval(ev.id, "subject", e.target.value)}
                  className="flex-1"
                />
                <button
                  className="p-0.5 hover:bg-accent rounded opacity-0 group-hover:opacity-100"
                  onClick={() => moveEval(index, -1)}
                  disabled={index === 0}
                >
                  <span className="material-icons-outlined text-[14px]">keyboard_arrow_up</span>
                </button>
                <button
                  className="p-0.5 hover:bg-accent rounded opacity-0 group-hover:opacity-100"
                  onClick={() => moveEval(index, 1)}
                  disabled={index === evaluations.length - 1}
                >
                  <span className="material-icons-outlined text-[14px]">keyboard_arrow_down</span>
                </button>
                <button
                  className="p-0.5 hover:bg-destructive/10 hover:text-destructive rounded opacity-0 group-hover:opacity-100"
                  onClick={() => removeEval(ev.id)}
                  disabled={evaluations.length === 1}
                >
                  <span className="material-icons-outlined text-[14px]">close</span>
                </button>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">평가 방법</p>
                <div className="flex flex-wrap gap-1.5">
                  {EVAL_METHODS.map((method) => (
                    <button
                      key={method}
                      onClick={() => toggleEvalMethod(ev.id, method)}
                      className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                        ev.methods.includes(method)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:bg-accent"
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>
              <Textarea
                placeholder="평가 내용을 입력하세요"
                value={ev.content}
                onChange={(e) => updateEval(ev.id, "content", e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Step 7: Materials */}
      <section className="border rounded-xl p-5 space-y-3 bg-card shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <SectionBadge number={7} />
            <h2 className="font-semibold">수업자료 및 아이디어 기록</h2>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => addMaterial("text")}>
              <span className="material-icons-outlined text-[16px]">text_fields</span>
              텍스트
            </Button>
            <Button variant="outline" size="sm" onClick={() => addMaterial("link")}>
              <span className="material-icons-outlined text-[16px]">link</span>
              링크
            </Button>
            <Button variant="outline" size="sm" onClick={() => addMaterial("image")}>
              <span className="material-icons-outlined text-[16px]">image</span>
              이미지
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          {materials.map((mat) => (
            <div key={mat.id} className="group border rounded-lg p-3 space-y-2 bg-card">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">
                  {mat.type === "text" ? "텍스트" : mat.type === "link" ? "링크" : "이미지"}
                </Badge>
                <button
                  className="p-0.5 hover:bg-destructive/10 hover:text-destructive rounded opacity-0 group-hover:opacity-100"
                  onClick={() => removeMaterial(mat.id)}
                  disabled={materials.length === 1}
                >
                  <span className="material-icons-outlined text-[14px]">close</span>
                </button>
              </div>
              {mat.type === "text" && (
                <Textarea
                  placeholder="텍스트 내용을 입력하세요"
                  value={mat.content}
                  onChange={(e) => updateMaterial(mat.id, { content: e.target.value })}
                  className="min-h-[80px]"
                />
              )}
              {mat.type === "link" && (
                <>
                  <Input
                    placeholder="제목 (선택)"
                    value={mat.title || ""}
                    onChange={(e) => updateMaterial(mat.id, { title: e.target.value })}
                  />
                  <Input
                    placeholder="URL"
                    value={mat.url || ""}
                    onChange={(e) => updateMaterial(mat.id, { url: e.target.value })}
                    type="url"
                  />
                </>
              )}
              {mat.type === "image" && (
                <>
                  {mat.fileData ? (
                    <div className="relative">
                      <img src={mat.fileData} alt={mat.fileName} className="max-h-48 rounded object-contain" />
                      <p className="text-xs text-muted-foreground mt-1">{mat.fileName}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1"
                        onClick={() => updateMaterial(mat.id, { fileData: undefined, fileName: undefined })}
                      >
                        <span className="material-icons-outlined text-[16px]">delete</span>
                        이미지 삭제
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-accent/30 transition-colors"
                      onClick={() => {
                        const input = document.createElement("input")
                        input.type = "file"
                        input.accept = "image/*"
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0]
                          if (file) handleImageUpload(mat.id, file)
                        }
                        input.click()
                      }}
                    >
                      <span className="material-icons-outlined text-3xl text-muted-foreground mb-2">upload_file</span>
                      <p className="text-sm text-muted-foreground">클릭하여 이미지를 업로드하세요</p>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Standards search dialog */}
      <Dialog open={showSearchDialog} onOpenChange={setShowSearchDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>성취기준 검색 및 추가</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <SearchInDialog
              currentStandards={standards}
              onAdd={(item) => {
                const exists = standards.some((s) => s.코드 === item.코드)
                if (!exists) {
                  setStandards((prev) => [...prev, item])
                  addItem(item)
                  toast({ title: "성취기준 추가됨", description: item.코드, duration: 1500 })
                } else {
                  toast({ title: "이미 추가된 성취기준입니다.", duration: 1500 })
                }
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Embedded search in dialog
function SearchInDialog({
  currentStandards,
  onAdd,
}: {
  currentStandards: BasketItem[]
  onAdd: (item: BasketItem) => void
}) {
  const [keyword, setKeyword] = useState("")
  const [selectedSubject, setSelectedSubject] = useState("__all__")
  const debouncedKw = useDebounce(keyword, 300)
  const { data: allData = [], isLoading } = useQuery<BasketItem[]>({
    queryKey: ["achievements"],
    queryFn: async () => {
      const res = await fetch("/achievements-simple.json")
      return res.json()
    },
  })

  const subjects = useMemo(() => Array.from(new Set(allData.map((d) => d.과목))).sort(), [allData])

  const filtered = useMemo(() => {
    return allData.filter((d) => {
      if (selectedSubject !== "__all__" && d.과목 !== selectedSubject) return false
      if (debouncedKw) {
        const kw = debouncedKw.toLowerCase()
        return d.내용.toLowerCase().includes(kw) || d.코드.toLowerCase().includes(kw)
      }
      return true
    }).slice(0, 100)
  }, [allData, selectedSubject, debouncedKw])

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b space-y-2">
        <Input placeholder="키워드 검색" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
          <SelectTrigger>
            <SelectValue placeholder="과목 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">전체 과목</SelectItem>
            {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex-1 overflow-auto p-2 space-y-1.5">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">로딩 중...</div>
        ) : filtered.map((item) => {
          const isAdded = currentStandards.some((s) => s.코드 === item.코드)
          return (
            <div key={item.코드} className="flex items-start gap-2 border rounded p-2.5 text-sm hover:bg-accent/30 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  <span className="font-mono text-xs font-semibold text-primary">{item.코드}</span>
                  <span className="text-xs text-muted-foreground">{item.교육과정}</span>
                  <span className="text-xs text-muted-foreground">{item.학년군}</span>
                  <span className="text-xs text-muted-foreground">{item.과목}</span>
                  <span className="text-xs text-muted-foreground">{item.영역}</span>
                </div>
                <p>{item.내용}</p>
              </div>
              <Button
                size="sm"
                variant={isAdded ? "secondary" : "default"}
                disabled={isAdded}
                onClick={() => onAdd(item)}
                className="shrink-0"
              >
                {isAdded ? "추가됨" : "추가"}
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
