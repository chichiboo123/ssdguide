import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AchievementFilterPanel } from "@/components/achievement-filter-panel"
import { useBasket } from "@/hooks/use-basket"
import { useToast } from "@/hooks/use-toast"
import { useLessonAI } from "@/hooks/use-lesson-ai"
import { suggestLessonContent, getStoredAiPassword, setStoredAiPassword, clearStoredAiPassword } from "@/lib/groq-client"
import { formatStandard, cn } from "@/lib/utils"
import { AiPasswordDialog } from "@/components/ai-password-dialog"
import type {
  LessonDesign,
  LessonProcessStep,
  EvaluationEntry,
  MaterialEntry,
  BasketItem,
} from "@/lib/types"

const EVAL_METHODS = [
  "논술형", "서술형", "정의적 능력 평가", "협력적 문제해결력 평가",
  "구술", "발표", "실기", "토의･토론", "실험･실습",
  "보고서법", "프로젝트", "포트폴리오", "자기평가", "동료평가",
]

/** Convert old-format evaluation entries to new format (migration fallback) */
function migrateEval(raw: Record<string, unknown>): EvaluationEntry {
  return {
    id: (raw.id as string) || genId(),
    standards: Array.isArray(raw.standards) ? (raw.standards as string[]) : [],
    domain: (raw.domain as string) || (raw.subject as string) || "",
    element: (raw.element as string) || (raw.content as string) || "",
    methods: Array.isArray(raw.methods) ? (raw.methods as string[]) : [],
  }
}

function genId() {
  return Math.random().toString(36).slice(2, 9)
}


function SectionBadge({ number }: { number: number }) {
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
      {number}
    </span>
  )
}

// ─── Cloudinary image upload ─────────────────────────────────────────────────
// Configure via environment variables (create .env.local from .env.example):
//   VITE_CLOUDINARY_CLOUD_NAME   — your Cloudinary cloud name
//   VITE_CLOUDINARY_UPLOAD_PRESET — unsigned upload preset name
const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined
const cloudinaryEnabled = !!(CLOUDINARY_CLOUD && CLOUDINARY_PRESET)

/** Compress + resize an image data URL to JPEG ≤ maxWidth px, returning a Blob */
async function compressImage(dataUrl: string, maxWidth = 1600, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) return reject(new Error("Canvas unavailable"))
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Compression failed"))),
        "image/jpeg",
        quality
      )
    }
    img.onerror = () => reject(new Error("Image load failed"))
    img.src = dataUrl
  })
}

/** Upload a base64 data URL to Cloudinary and return the public secure_url */
async function uploadToCloudinary(dataUrl: string, fileName: string): Promise<string> {
  if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET) throw new Error("Cloudinary not configured")
  const blob = await compressImage(dataUrl)
  const safeName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`
  const form = new FormData()
  form.append("file", blob, safeName)
  form.append("upload_preset", CLOUDINARY_PRESET)
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
    { method: "POST", body: form }
  )
  if (!res.ok) throw new Error(`Cloudinary HTTP ${res.status}`)
  const json = await res.json()
  return json.secure_url as string
}

// ─── Link sharing helpers ─────────────────────────────────────────────────────

function encodeDesign(design: LessonDesign): string {
  // Strip local binary data — sharedImageUrl (Cloudinary URL) is preserved
  const exportable: LessonDesign = {
    ...design,
    materials: design.materials.map((m) =>
      m.type === "image" ? { ...m, fileData: undefined } : m
    ),
  }
  return btoa(encodeURIComponent(JSON.stringify(exportable)))
}

function decodeDesign(encoded: string): LessonDesign | null {
  try {
    return JSON.parse(decodeURIComponent(atob(encoded)))
  } catch {
    return null
  }
}

function getShareParam(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get("share")
}

function buildShareUrl(design: LessonDesign): string {
  const encoded = encodeDesign(design)
  // Use the app's actual deployment base (e.g. /ssdguide/ on GitHub Pages).
  // window.location.origin alone omits the repo sub-path, causing a 404.
  const base = window.location.origin + import.meta.env.BASE_URL
  const url = new URL(base)
  // Use URLSearchParams.set() so base64's '+' chars are percent-encoded,
  // preventing URLSearchParams.get() from silently converting them to spaces.
  const params = new URLSearchParams()
  params.set("share", encoded)
  url.search = params.toString()
  // Hash routing: #/design routes to LessonDesignPage without an HTTP request
  url.hash = "#/design"
  return url.toString()
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function LessonDesignPage() {
  const { items: basketItems, addItem } = useBasket()
  const { toast } = useToast()
  const { suggest, isLoading: aiLoading, error: aiError, suggestion: aiSuggestion, clearSuggestion } = useLessonAI()

  const [isGeneratingAll, setIsGeneratingAll] = useState(false)
  const [generatingStep, setGeneratingStep] = useState("")
  const [aiEvalParsed, setAiEvalParsed] = useState<Array<{ domain: string; element: string; methods: string[] }> | null>(null)

  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [standards, setStandards] = useState<BasketItem[]>([...basketItems])
  const [intent, setIntent] = useState("")
  const [objective, setObjective] = useState("")
  const [process, setProcess] = useState("")
  const [useTableMode, setUseTableMode] = useState(false)
  const [processSteps, setProcessSteps] = useState<LessonProcessStep[]>([
    { id: genId(), period: "", topic: "", content: "", note: "" },
  ])
  const [evaluations, setEvaluations] = useState<EvaluationEntry[]>([
    { id: genId(), standards: [], domain: "", element: "", methods: [] },
  ])
  const [materials, setMaterials] = useState<MaterialEntry[]>([
    { id: genId(), type: "text", content: "" },
  ])

  const [showSearchDialog, setShowSearchDialog] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [shareUrl, setShareUrl] = useState("")
  const [urlCopied, setUrlCopied] = useState(false)
  const [isUploadingImages, setIsUploadingImages] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const [pwDialog, setPwDialog] = useState<{ open: boolean; error: string | null }>({ open: false, error: null })
  const pendingAiRef = useRef<(() => Promise<void>) | null>(null)

  // ── Load shared design from URL on first mount ──────────────────────────
  useEffect(() => {
    const shareParam = getShareParam()
    if (!shareParam) return
    const data = decodeDesign(shareParam)
    if (!data) {
      toast({ title: "공유 링크를 불러올 수 없습니다.", variant: "destructive", duration: 2000 })
      return
    }
    setTitle(data.title || "")
    setAuthor(data.author || "")
    setStandards(data.standards || [])
    setIntent(data.intent || "")
    setObjective(data.objective || "")
    setProcess(data.process || "")
    setUseTableMode(data.useTableMode || false)
    setProcessSteps(data.processSteps?.length ? data.processSteps : [{ id: genId(), period: "", topic: "", content: "", note: "" }])
    const rawEvals = data.evaluations as unknown as Record<string, unknown>[]
    setEvaluations(rawEvals?.length ? rawEvals.map(migrateEval) : [{ id: genId(), standards: [], domain: "", element: "", methods: [] }])
    setMaterials(data.materials?.length ? data.materials : [{ id: genId(), type: "text", content: "" }])
    toast({ title: "공유된 수업 디자인을 불러왔습니다.", duration: 2000 })
    // Remove the share param from URL without page reload
    const cleanUrl = new URL(window.location.href)
    cleanUrl.search = ""
    window.history.replaceState(null, "", cleanUrl.toString())
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Standards section ───────────────────────────────────────────────────
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
    const text = standards.map(formatStandard).join("\n")
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "성취기준 복사 완료", duration: 1500 })
    } catch {
      toast({ title: "복사 실패", variant: "destructive", duration: 1500 })
    }
  }, [standards, toast])

  const standardCodes = useMemo(() => new Set(standards.map((s) => s.코드)), [standards])

  const handleAddStandard = useCallback((item: BasketItem) => {
    if (standardCodes.has(item.코드)) {
      toast({ title: "이미 추가된 성취기준입니다.", duration: 1500 })
      return
    }
    setStandards((prev) => [...prev, item])
    addItem(item)
    toast({ title: "성취기준 추가됨", description: item.코드, duration: 1500 })
  }, [standardCodes, addItem, toast])

  // ── Process steps ────────────────────────────────────────────────────────
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

  // ── Evaluations ──────────────────────────────────────────────────────────
  const addEval = () => setEvaluations((p) => [...p, { id: genId(), standards: [], domain: "", element: "", methods: [] }])
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
  const updateEval = (id: string, field: keyof Omit<EvaluationEntry, "id" | "methods" | "standards">, value: string) => {
    setEvaluations((p) => p.map((e) => e.id === id ? { ...e, [field]: value } : e))
  }
  const toggleEvalStandard = (id: string, code: string) => {
    setEvaluations((p) => p.map((e) => {
      if (e.id !== id) return e
      const standards = e.standards.includes(code)
        ? e.standards.filter((c) => c !== code)
        : [...e.standards, code]
      return { ...e, standards }
    }))
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

  // ── Materials ────────────────────────────────────────────────────────────
  const addMaterial = (type: MaterialEntry["type"]) => {
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

  const anyAiLoading = aiLoading || isGeneratingAll

  // ── withAuth helper ──────────────────────────────────────────────────────
  const withAuth = useCallback((action: () => Promise<void>) => {
    if (!getStoredAiPassword()) {
      pendingAiRef.current = action
      setPwDialog({ open: true, error: null })
      return
    }
    action().catch((e: unknown) => {
      if (e instanceof Error && e.message === 'WRONG_PASSWORD') {
        pendingAiRef.current = action
        setPwDialog({ open: true, error: '비밀번호가 틀립니다. 다시 입력하세요.' })
      }
    })
  }, [])

  const handlePwSubmit = useCallback(async (pw: string) => {
    setStoredAiPassword(pw)
    setPwDialog({ open: false, error: null })
    const action = pendingAiRef.current
    if (action) {
      pendingAiRef.current = null
      action().catch((e: unknown) => {
        if (e instanceof Error && e.message === 'WRONG_PASSWORD') {
          clearStoredAiPassword()
          pendingAiRef.current = action
          setPwDialog({ open: true, error: '비밀번호가 틀립니다. 다시 입력하세요.' })
        }
      })
    }
  }, [])

  const handlePwCancel = useCallback(() => {
    pendingAiRef.current = null
    setPwDialog({ open: false, error: null })
  }, [])

  // ── AI suggestion handlers ───────────────────────────────────────────────
  const handlePolishIntent = useCallback(() => {
    if (!intent.trim()) { toast({ title: "수업자 의도를 먼저 작성해주세요.", duration: 2000 }); return }
    withAuth(async () => {
      await suggest({ intent, requestType: "suggest_intent_edit" }, "intent")
    })
  }, [intent, suggest, toast, withAuth])

  const handleSuggestObjective = useCallback(() => {
    if (standards.length === 0) { toast({ title: "성취기준을 먼저 추가해주세요.", duration: 2000 }); return }
    withAuth(async () => {
      await suggest({ standards, intent, process, requestType: "suggest_objective" }, "objective")
    })
  }, [standards, intent, process, suggest, toast, withAuth])

  const handleSuggestProcess = useCallback(() => {
    if (standards.length === 0) { toast({ title: "성취기준을 먼저 추가해주세요.", duration: 2000 }); return }
    withAuth(async () => {
      await suggest({ standards, intent, objective, process, requestType: "suggest_process" }, "process")
    })
  }, [standards, intent, objective, process, suggest, toast, withAuth])

  const handleSuggestEvaluation = useCallback(() => {
    if (standards.length === 0) { toast({ title: "성취기준을 먼저 추가해주세요.", duration: 2000 }); return }
    withAuth(async () => {
      const text = await suggest({ standards, intent, objective, process, requestType: "suggest_evaluation" }, "evaluation")
      if (text) {
        const parsed = parseEvalSuggestions(text)
        if (parsed) setAiEvalParsed(parsed)
      }
    })
  }, [standards, intent, objective, process, suggest, toast, withAuth])

  const applyAiSuggestion = useCallback(() => {
    if (!aiSuggestion) return
    if (aiSuggestion.section === "intent") setIntent(aiSuggestion.text)
    if (aiSuggestion.section === "objective") setObjective(aiSuggestion.text)
    if (aiSuggestion.section === "process") setProcess(aiSuggestion.text)
    clearSuggestion()
  }, [aiSuggestion, clearSuggestion])

  const applyAiEvalSuggestions = useCallback(() => {
    if (!aiEvalParsed) return
    setEvaluations(aiEvalParsed.map((e) => ({ id: genId(), standards: [], domain: e.domain, element: e.element, methods: e.methods })))
    setAiEvalParsed(null)
    clearSuggestion()
  }, [aiEvalParsed, clearSuggestion])

  // ── Generate all (sequential: objective → process → evaluation) ──────────
  const doGenerateAll = useCallback(async () => {
    setIsGeneratingAll(true)
    clearSuggestion()
    setAiEvalParsed(null)
    let newObj = objective
    let newProc = process

    try {
      setGeneratingStep("수업 목표")
      try {
        const r = await suggestLessonContent({ standards, intent, process, requestType: "suggest_objective" })
        newObj = r.content
        setObjective(newObj)
      } catch (e) {
        if (e instanceof Error && e.message === 'WRONG_PASSWORD') throw e
        toast({ title: "수업 목표 생성 실패", variant: "destructive", duration: 2000 })
      }

      setGeneratingStep("수업 과정")
      try {
        const r = await suggestLessonContent({ standards, intent, objective: newObj, process, requestType: "suggest_process" })
        newProc = r.content
        setProcess(newProc)
      } catch (e) {
        if (e instanceof Error && e.message === 'WRONG_PASSWORD') throw e
        toast({ title: "수업 과정 생성 실패", variant: "destructive", duration: 2000 })
      }

      setGeneratingStep("평가 계획")
      try {
        const r = await suggestLessonContent({ standards, intent, objective: newObj, process: newProc, requestType: "suggest_evaluation" })
        const parsed = parseEvalSuggestions(r.content)
        if (parsed) setEvaluations(parsed.map((e) => ({ id: genId(), standards: [], domain: e.domain, element: e.element, methods: e.methods })))
      } catch (e) {
        if (e instanceof Error && e.message === 'WRONG_PASSWORD') throw e
        toast({ title: "평가 계획 생성 실패", variant: "destructive", duration: 2000 })
      }

      toast({ title: "AI 일괄 생성 완료", duration: 2000 })
    } finally {
      setIsGeneratingAll(false)
      setGeneratingStep("")
    }
  }, [standards, intent, objective, process, clearSuggestion, toast])

  const handleGenerateAll = useCallback(() => {
    if (standards.length === 0) { toast({ title: "성취기준을 먼저 추가해주세요.", duration: 2000 }); return }
    withAuth(doGenerateAll)
  }, [standards, toast, withAuth, doGenerateAll])

  useEffect(() => {
    if (aiError) toast({ title: aiError, variant: "destructive", duration: 3000 })
  }, [aiError]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Export / Import ──────────────────────────────────────────────────────
  const buildDesign = useCallback((): LessonDesign => ({
    title, author, standards, intent, objective, process, useTableMode, processSteps, evaluations, materials,
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
    setShowExportMenu(false)
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
        setProcessSteps(data.processSteps || [{ id: genId(), period: "", topic: "", content: "", note: "" }])
        const rawEvals2 = (data.evaluations || []) as unknown as Record<string, unknown>[]
        setEvaluations(rawEvals2.length ? rawEvals2.map(migrateEval) : [{ id: genId(), standards: [], domain: "", element: "", methods: [] }])
        setMaterials(data.materials || [{ id: genId(), type: "text", content: "" }])
        toast({ title: "불러오기 완료", duration: 1500 })
      } catch {
        toast({ title: "파일 형식 오류", variant: "destructive", duration: 1500 })
      }
    }
    reader.readAsText(file)
    e.target.value = ""
    setShowExportMenu(false)
  }

  const handleTxtDownload = () => {
    const lines: string[] = []
    lines.push(`수업 디자인: ${title}`)
    if (author) lines.push(`수업자: ${author}`)
    lines.push("")
    lines.push("■ 관련 성취기준")
    standards.forEach((s) => lines.push(`  ${formatStandard(s)}`))
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
      lines.push(`  ${i + 1}. 평가영역: ${e.domain || "(미작성)"}`)
      lines.push(`     평가요소: ${e.element || "(미작성)"}`)
      if (e.standards.length) lines.push(`     성취기준: ${e.standards.join(", ")}`)
      if (e.methods.length) lines.push(`     평가방법: ${e.methods.join(", ")}`)
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
    setShowExportMenu(false)
  }

  const handleMdDownload = () => {
    const lines: string[] = []
    lines.push(`# ${title || "수업 디자인"}`)
    if (author) lines.push(`> 수업자: ${author}`)
    lines.push("")
    lines.push("## 1. 관련 성취기준")
    standards.forEach((s) => {
      const meta = [s.교육과정, s.학년군, s.과목, s.영역].filter(Boolean).join(" / ")
      lines.push(`- **[${s.코드}]** ${s.내용}  *(${meta})*`)
    })
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
      lines.push("| :---: | --- | --- | --- |")
      processSteps.forEach((s) => lines.push(`| ${s.period} | ${s.topic} | ${s.content} | ${s.note} |`))
    } else {
      lines.push(process || "")
    }
    lines.push("")
    lines.push("## 5. 평가 계획")
    evaluations.forEach((e, i) => {
      lines.push(`### 평가 ${i + 1}`)
      if (e.standards.length) lines.push(`- **성취기준**: ${e.standards.join(", ")}`)
      if (e.domain) lines.push(`- **평가영역**: ${e.domain}`)
      if (e.element) lines.push(`- **평가요소**: ${e.element}`)
      if (e.methods.length) lines.push(`- **평가방법**: ${e.methods.join(", ")}`)
      lines.push("")
    })
    lines.push("## 6. 수업 자료 및 아이디어")
    materials.forEach((m) => {
      if (m.type === "text") lines.push(`- ${m.content}`)
      else if (m.type === "link") lines.push(`- [${m.title || m.url}](${m.url})`)
      else if (m.type === "image") lines.push(`- 📷 ${m.fileName || "이미지"}`)
    })
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `수업디자인_${title || "제목없음"}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: "Markdown 파일 저장 완료", duration: 1500 })
    setShowExportMenu(false)
  }

  const handleCopyAll = async () => {
    const lines: string[] = []
    lines.push(`# ${title || "제목 없음"}`)
    if (author) lines.push(`> 수업자: ${author}`)
    lines.push("")
    lines.push("## 1. 관련 성취기준")
    standards.forEach((s) => lines.push(`- [${s.코드}] ${s.내용}`))
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
      lines.push(`### ${i + 1}.`)
      if (e.standards.length) lines.push(`- **성취기준**: ${e.standards.join(", ")}`)
      if (e.domain) lines.push(`- **평가영역**: ${e.domain}`)
      if (e.element) lines.push(`- **평가요소**: ${e.element}`)
      if (e.methods.length) lines.push(`- **평가방법**: ${e.methods.join(", ")}`)
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
    setShowExportMenu(false)
  }

  const handleShareLink = async () => {
    setShowExportMenu(false)

    // Work with a mutable copy of materials so we can apply upload results
    // without depending on stale React state after async operations.
    let updatedMaterials = [...materials]

    // Upload local images that haven't been shared yet
    if (cloudinaryEnabled) {
      const toUpload = updatedMaterials.filter(
        (m) => m.type === "image" && m.fileData && !m.sharedImageUrl
      )
      if (toUpload.length > 0) {
        setIsUploadingImages(true)
        const results = await Promise.allSettled(
          toUpload.map((m) => uploadToCloudinary(m.fileData!, m.fileName || "image.jpg"))
        )
        const failures: string[] = []
        results.forEach((result, i) => {
          if (result.status === "fulfilled") {
            updatedMaterials = updatedMaterials.map((m) =>
              m.id === toUpload[i].id ? { ...m, sharedImageUrl: result.value } : m
            )
          } else {
            failures.push(toUpload[i].fileName || `이미지 ${i + 1}`)
          }
        })
        setMaterials(updatedMaterials)
        setIsUploadingImages(false)
        if (failures.length > 0) {
          toast({
            title: `이미지 ${failures.length}개 업로드 실패`,
            description: `${failures.join(", ")} — 해당 이미지는 공유 링크에 포함되지 않습니다.`,
            variant: "destructive",
            duration: 4000,
          })
        }
      }
    } else {
      // Cloudinary not configured: warn if local images would be lost
      const hasUnsharedImages = updatedMaterials.some(
        (m) => m.type === "image" && m.fileData && !m.sharedImageUrl
      )
      if (hasUnsharedImages) {
        toast({
          title: "이미지는 공유 링크에 포함되지 않습니다.",
          description: "이미지 공유를 원하면 .env.local에 Cloudinary 설정을 추가하세요.",
          duration: 4000,
        })
      }
    }

    // Build the design with the (possibly updated) materials
    const design: LessonDesign = {
      title, author, standards, intent, objective, process,
      useTableMode, processSteps, evaluations,
      materials: updatedMaterials,
    }
    const url = buildShareUrl(design)
    setShareUrl(url)
    setUrlCopied(false)
    setShowShareDialog(true)
  }

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setUrlCopied(true)
      setTimeout(() => setUrlCopied(false), 2000)
    } catch {
      toast({ title: "복사 실패", variant: "destructive", duration: 1500 })
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 lg:p-6 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <span className="material-icons-outlined text-primary">edit_note</span>
          수업 디자인
        </h1>
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
          className="text-sm"
          data-testid="lesson-title"
        />
        <Input
          placeholder="수업자 이름 (선택 사항)"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          className="text-sm"
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
          <button
            onClick={() => setShowSearchDialog(true)}
            className="w-full border-2 border-dashed border-border rounded-lg py-8 flex flex-col items-center text-muted-foreground hover:border-primary/40 hover:text-primary/70 transition-colors"
          >
            <span className="material-icons-outlined text-3xl mb-1.5 opacity-50">add_circle_outline</span>
            <span className="text-sm">추가 버튼을 눌러 성취기준을 추가하세요</span>
          </button>
        ) : (
          <div className="space-y-1.5">
            {standards.map((s, index) => (
              <div key={s.코드} className="group flex items-start gap-2 bg-muted/40 border border-border/60 rounded-lg p-3 text-sm hover:border-primary/30 transition-colors">
                <div className="flex flex-col gap-0.5 shrink-0 mt-0.5">
                  <button
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-background rounded disabled:opacity-20 transition-all"
                    onClick={() => handleMoveStandard(index, -1)}
                    disabled={index === 0}
                  >
                    <span className="material-icons-outlined text-[13px] text-muted-foreground">keyboard_arrow_up</span>
                  </button>
                  <button
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-background rounded disabled:opacity-20 transition-all"
                    onClick={() => handleMoveStandard(index, 1)}
                    disabled={index === standards.length - 1}
                  >
                    <span className="material-icons-outlined text-[13px] text-muted-foreground">keyboard_arrow_down</span>
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <span className="font-mono font-bold text-primary text-[11px] bg-primary/10 px-1.5 py-0.5 rounded">{s.코드}</span>
                    <span className="text-[11px] text-muted-foreground">{s.교육과정}</span>
                    <span className="text-[11px] text-muted-foreground">·</span>
                    <span className="text-[11px] text-muted-foreground">{s.학년군}</span>
                    <span className="text-[11px] text-muted-foreground">·</span>
                    <span className="text-[11px] text-muted-foreground">{s.과목}</span>
                    {s.영역 && (
                      <>
                        <span className="text-[11px] text-muted-foreground">·</span>
                        <span className="text-[11px] text-muted-foreground">{s.영역}</span>
                      </>
                    )}
                  </div>
                  <p className="text-foreground/90 leading-relaxed">{s.내용}</p>
                </div>
                <button
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/10 hover:text-destructive rounded shrink-0 transition-all"
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
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <SectionBadge number={3} />
            <h2 className="font-semibold">수업자 의도</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePolishIntent}
            disabled={anyAiLoading}
            className="h-7 text-xs gap-1 border-violet-300 text-violet-700 hover:bg-violet-50"
          >
            <span className={cn("material-icons-outlined text-[14px]", aiLoading && !aiSuggestion && "animate-spin")}>
              {aiLoading && !aiSuggestion ? "autorenew" : "auto_fix_high"}
            </span>
            {aiLoading && !aiSuggestion ? "AI 첨삭 중…" : "AI 첨삭"}
          </Button>
        </div>
        <Textarea
          autoResize
          placeholder="이 수업을 통해 학생들이 무엇을 경험하고 배우기를 바라는지 서술하세요."
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          className="min-h-[100px] text-sm"
          data-testid="lesson-intent"
        />
        {aiSuggestion?.section === "intent" && (
          <AiSuggestionPanel
            suggestion={aiSuggestion.text}
            model={aiSuggestion.model}
            onApply={applyAiSuggestion}
            onClose={clearSuggestion}
          />
        )}
      </section>

      {/* ── AI 일괄 생성 ── */}
      {standards.length > 0 && (
        <section className="border border-violet-200 rounded-xl p-4 bg-gradient-to-r from-violet-50/70 to-indigo-50/70 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <span className="material-icons-outlined text-violet-600 text-[22px] mt-0.5">auto_awesome</span>
            <div>
              <p className="font-semibold text-sm">AI 일괄 생성</p>
              <p className="text-xs text-muted-foreground mt-0.5">수업 목표 · 수업 과정 · 평가 계획을 순서대로 한 번에 생성합니다. 성취기준과 수업자 의도를 참고합니다.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              size="sm"
              onClick={handleGenerateAll}
              disabled={anyAiLoading}
              className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5 h-8"
            >
              <span className={cn("material-icons-outlined text-[16px]", isGeneratingAll && "animate-spin")}>
                {isGeneratingAll ? "autorenew" : "auto_awesome"}
              </span>
              {isGeneratingAll ? `${generatingStep} 생성 중…` : "전체 AI 생성"}
            </Button>
            <p className="text-xs text-muted-foreground">각 섹션의 AI 제안 버튼으로 개별 재생성도 가능합니다.</p>
          </div>
        </section>
      )}

      {/* Step 4: Objective */}
      <section className="border rounded-xl p-5 space-y-3 bg-card shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <SectionBadge number={4} />
            <h2 className="font-semibold">수업 목표</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSuggestObjective}
            disabled={anyAiLoading}
            className="h-7 text-xs gap-1 border-violet-300 text-violet-700 hover:bg-violet-50"
          >
            <span className={cn("material-icons-outlined text-[14px]", aiLoading && !aiSuggestion && "animate-spin")}>
              {aiLoading && !aiSuggestion ? "autorenew" : "auto_awesome"}
            </span>
            {aiLoading && !aiSuggestion ? "AI 생성 중…" : "AI 재생성"}
          </Button>
        </div>
        <Textarea
          autoResize
          placeholder="수업이 끝난 후 학생들이 할 수 있게 되는 것을 구체적으로 작성하세요."
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          className="min-h-[100px] text-sm"
          data-testid="lesson-objective"
        />
        {aiSuggestion?.section === "objective" && (
          <AiSuggestionPanel
            suggestion={aiSuggestion.text}
            model={aiSuggestion.model}
            onApply={applyAiSuggestion}
            onClose={clearSuggestion}
          />
        )}
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
              <span className="material-icons-outlined text-[14px]">notes</span>
              자유 작성
            </Button>
          </div>
        </div>

        {useTableMode ? (
          <div className="space-y-2">
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/60">
                    <th className="border-b border-border/60 p-2.5 text-left font-semibold text-muted-foreground w-16">차시</th>
                    <th className="border-b border-border/60 p-2.5 text-left font-semibold text-muted-foreground w-28">수업 주제</th>
                    <th className="border-b border-border/60 p-2.5 text-left font-semibold text-muted-foreground">내용</th>
                    <th className="border-b border-border/60 p-2.5 text-left font-semibold text-muted-foreground w-20">비고</th>
                    <th className="border-b border-border/60 p-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {processSteps.map((step, idx) => (
                    <tr key={step.id} className={`group ${idx % 2 === 1 ? "bg-muted/20" : ""}`}>
                      <td className="border-b border-border/40 p-1">
                        <Input
                          value={step.period}
                          onChange={(e) => updateStep(step.id, "period", e.target.value)}
                          className="h-7 text-xs border-0 bg-transparent p-1 focus-visible:ring-1"
                          placeholder="1-2"
                        />
                      </td>
                      <td className="border-b border-border/40 p-1">
                        <Input
                          value={step.topic}
                          onChange={(e) => updateStep(step.id, "topic", e.target.value)}
                          className="h-7 text-xs border-0 bg-transparent p-1 focus-visible:ring-1"
                        />
                      </td>
                      <td className="border-b border-border/40 p-1">
                        <Textarea
                          value={step.content}
                          onChange={(e) => updateStep(step.id, "content", e.target.value)}
                          autoResize
                          className="min-h-[52px] text-xs border-0 bg-transparent p-1 focus-visible:ring-1"
                        />
                      </td>
                      <td className="border-b border-border/40 p-1">
                        <Input
                          value={step.note}
                          onChange={(e) => updateStep(step.id, "note", e.target.value)}
                          className="h-7 text-xs border-0 bg-transparent p-1 focus-visible:ring-1"
                        />
                      </td>
                      <td className="border-b border-border/40 p-1">
                        <button
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/10 hover:text-destructive rounded disabled:opacity-0 transition-all"
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
              <Button variant="outline" size="sm" onClick={addStep} className="h-7 text-xs gap-1">
                <span className="material-icons-outlined text-[14px]">add</span>
                행 추가
              </Button>
              <Button variant="outline" size="sm" onClick={copyProcessTable} className="h-7 text-xs gap-1">
                <span className="material-icons-outlined text-[14px]">content_copy</span>
                마크다운 복사
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSuggestProcess}
                disabled={anyAiLoading}
                className="h-7 text-xs gap-1 border-violet-300 text-violet-700 hover:bg-violet-50"
              >
                <span className={cn("material-icons-outlined text-[14px]", aiLoading && "animate-spin")}>
                  {aiLoading ? "autorenew" : "auto_awesome"}
                </span>
                {aiLoading ? "AI 생성 중…" : "AI 재생성"}
              </Button>
            </div>
            <Textarea
              autoResize
              placeholder="수업 과정을 자유롭게 서술하세요. (활동 내용, 흐름, 시간 배분 등)"
              value={process}
              onChange={(e) => setProcess(e.target.value)}
              className="min-h-[120px] text-sm"
              data-testid="lesson-process"
            />
            {aiSuggestion?.section === "process" && (
              <AiSuggestionPanel
                suggestion={aiSuggestion.text}
                model={aiSuggestion.model}
                onApply={applyAiSuggestion}
                onClose={clearSuggestion}
              />
            )}
          </>
        )}
      </section>

      {/* Step 6: Evaluation */}
      <section className="border rounded-xl p-5 space-y-3 bg-card shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <SectionBadge number={6} />
            <h2 className="font-semibold">평가 계획</h2>
            {evaluations.length > 0 && <Badge variant="secondary">{evaluations.length}</Badge>}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSuggestEvaluation}
              disabled={anyAiLoading}
              className="h-7 text-xs gap-1 border-violet-300 text-violet-700 hover:bg-violet-50"
            >
              <span className={cn("material-icons-outlined text-[14px]", aiLoading && aiSuggestion?.section === "evaluation" && "animate-spin")}>
                {aiLoading && aiSuggestion?.section === "evaluation" ? "autorenew" : "auto_awesome"}
              </span>
              AI 재생성
            </Button>
            <Button variant="outline" size="sm" onClick={addEval}>
              <span className="material-icons-outlined text-[16px]">add</span>
              평가 추가
            </Button>
          </div>
        </div>

        {/* AI evaluation suggestion panel */}
        {aiEvalParsed && (
          <AiEvalSuggestionPanel
            suggestions={aiEvalParsed}
            onApply={applyAiEvalSuggestions}
            onClose={() => { setAiEvalParsed(null); clearSuggestion() }}
          />
        )}

        <div className="space-y-4">
          {evaluations.map((ev, index) => (
            <div key={ev.id} className="group border rounded-xl overflow-hidden">
              {/* Card header */}
              <div className="flex items-center justify-between bg-muted/50 px-3 py-2 border-b">
                <span className="text-xs font-semibold text-muted-foreground">평가 {index + 1}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className="p-1 hover:bg-accent rounded disabled:opacity-30 transition-colors"
                    onClick={() => moveEval(index, -1)}
                    disabled={index === 0}
                    title="위로"
                  >
                    <span className="material-icons-outlined text-[14px]">keyboard_arrow_up</span>
                  </button>
                  <button
                    className="p-1 hover:bg-accent rounded disabled:opacity-30 transition-colors"
                    onClick={() => moveEval(index, 1)}
                    disabled={index === evaluations.length - 1}
                    title="아래로"
                  >
                    <span className="material-icons-outlined text-[14px]">keyboard_arrow_down</span>
                  </button>
                  <button
                    className="p-1 hover:bg-destructive/10 hover:text-destructive rounded disabled:opacity-30 transition-colors"
                    onClick={() => removeEval(ev.id)}
                    disabled={evaluations.length === 1}
                    title="삭제"
                  >
                    <span className="material-icons-outlined text-[14px]">delete_outline</span>
                  </button>
                </div>
              </div>

              <div className="p-3 space-y-4">
                {/* ① 성취기준 */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">① 성취기준</p>
                  {standards.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">2단계에서 성취기준을 먼저 추가하세요.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {standards.map((s) => (
                        <button
                          key={s.코드}
                          onClick={() => toggleEvalStandard(ev.id, s.코드)}
                          title={s.내용}
                          className={`text-xs px-2 py-1 rounded-lg border font-mono transition-colors whitespace-nowrap ${
                            ev.standards.includes(s.코드)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background border-border hover:bg-accent"
                          }`}
                        >
                          {s.코드}
                        </button>
                      ))}
                    </div>
                  )}
                  {ev.standards.length > 0 && (
                    <div className="mt-2 space-y-1 pl-1">
                      {ev.standards.map((code) => {
                        const std = standards.find((s) => s.코드 === code)
                        return std ? (
                          <p key={code} className="text-xs text-muted-foreground leading-relaxed">
                            <span className="font-mono font-semibold text-primary">[{code}]</span> {std.내용}
                          </p>
                        ) : null
                      })}
                    </div>
                  )}
                </div>

                {/* ② 평가영역 + ③ 평가요소 */}
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">② 평가영역</p>
                    <Input
                      placeholder="예: 읽기"
                      value={ev.domain}
                      onChange={(e) => updateEval(ev.id, "domain", e.target.value)}
                      className="text-sm h-8"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">③ 평가요소</p>
                    <Input
                      placeholder="예: 책을 읽고 글의 구조 파악하기"
                      value={ev.element}
                      onChange={(e) => updateEval(ev.id, "element", e.target.value)}
                      className="text-sm h-8"
                    />
                  </div>
                </div>

                {/* ④ 평가방법 */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">④ 평가방법</p>
                  <div className="flex flex-wrap gap-1.5">
                    {EVAL_METHODS.map((method) => (
                      <button
                        key={method}
                        onClick={() => toggleEvalMethod(ev.id, method)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors whitespace-nowrap ${
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
              </div>
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
            <div key={mat.id} className="group bg-muted/30 border border-border/60 rounded-lg p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  mat.type === "text"
                    ? "bg-blue-50 text-blue-600 border border-blue-200"
                    : mat.type === "link"
                    ? "bg-green-50 text-green-600 border border-green-200"
                    : "bg-purple-50 text-purple-600 border border-purple-200"
                }`}>
                  <span className="material-icons-outlined text-[13px]">
                    {mat.type === "text" ? "text_fields" : mat.type === "link" ? "link" : "image"}
                  </span>
                  {mat.type === "text" ? "텍스트" : mat.type === "link" ? "링크" : "이미지"}
                </span>
                <button
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/10 hover:text-destructive rounded disabled:opacity-0 transition-all text-muted-foreground"
                  onClick={() => removeMaterial(mat.id)}
                  disabled={materials.length === 1}
                >
                  <span className="material-icons-outlined text-[14px]">close</span>
                </button>
              </div>

              {mat.type === "text" && (
                <Textarea
                  autoResize
                  placeholder="텍스트 내용을 입력하세요"
                  value={mat.content}
                  onChange={(e) => updateMaterial(mat.id, { content: e.target.value })}
                  className="min-h-[80px] text-sm"
                />
              )}
              {mat.type === "link" && (
                <div className="space-y-2">
                  <Input
                    placeholder="제목 (선택)"
                    value={mat.title || ""}
                    onChange={(e) => updateMaterial(mat.id, { title: e.target.value })}
                    className="text-sm"
                  />
                  <Input
                    placeholder="URL"
                    value={mat.url || ""}
                    onChange={(e) => updateMaterial(mat.id, { url: e.target.value })}
                    type="url"
                    className="text-sm"
                  />
                </div>
              )}
              {mat.type === "image" && (
                <>
                  {(mat.fileData || mat.sharedImageUrl) ? (
                    <div>
                      <img
                        src={mat.fileData || mat.sharedImageUrl}
                        alt={mat.fileName}
                        className="max-h-52 rounded-lg object-contain border border-border/60"
                      />
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">{mat.fileName}</p>
                          {mat.sharedImageUrl && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
                              <span className="material-icons-outlined text-[11px]">cloud_done</span>
                              업로드됨
                            </span>
                          )}
                        </div>
                        {mat.fileData && (
                          <button
                            onClick={() => updateMaterial(mat.id, { fileData: undefined, fileName: undefined, sharedImageUrl: undefined })}
                            className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 transition-colors"
                          >
                            <span className="material-icons-outlined text-[14px]">delete</span>
                            삭제
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div
                      className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
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
                      <span className="material-icons-outlined text-4xl text-muted-foreground/40 mb-2 block">upload_file</span>
                      <p className="text-sm text-muted-foreground">클릭하여 이미지를 업로드하세요</p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">PNG, JPG, GIF 지원</p>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Hidden JSON import input */}
      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleJsonImport} />

      {/* ── Standards search dialog (full filter panel) ── */}
      <Dialog open={showSearchDialog} onOpenChange={setShowSearchDialog}>
        <DialogContent className="max-w-4xl h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-4 border-b shrink-0">
            <DialogTitle>성취기준 검색 및 추가</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <AchievementFilterPanel
              onAdd={handleAddStandard}
              addedCodes={standardCodes}
              addLabel="추가"
              addedLabel="추가됨"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Share link dialog ── */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="material-icons-outlined text-primary">link</span>
              링크 공유
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-sm text-muted-foreground">
              아래 링크를 통해 현재 수업 디자인을 공유할 수 있습니다.
              이미지 파일은 공유 링크에 포함되지 않습니다.
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={shareUrl}
                className="text-xs font-mono flex-1"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button onClick={copyShareUrl} variant={urlCopied ? "secondary" : "default"} className="shrink-0">
                <span className="material-icons-outlined text-[16px]">
                  {urlCopied ? "check" : "content_copy"}
                </span>
                {urlCopied ? "복사됨" : "복사"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              링크를 열면 동일한 수업 디자인 내용이 복원됩니다.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Floating Export FAB ── */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
        {/* Export menu */}
        {showExportMenu && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 -z-10"
              onClick={() => setShowExportMenu(false)}
            />
            {/* Menu items */}
            <div className="flex flex-col items-end gap-2 mb-1">
              <FabMenuItem
                icon={isUploadingImages ? "hourglass_empty" : "link"}
                label={isUploadingImages ? "이미지 업로드 중…" : "링크 공유"}
                onClick={handleShareLink}
                disabled={isUploadingImages}
              />
              <FabMenuItem
                icon="content_copy"
                label="전체 복사"
                onClick={handleCopyAll}
              />
              <FabMenuItem
                icon="description"
                label="MD 저장"
                onClick={handleMdDownload}
              />
              <FabMenuItem
                icon="text_snippet"
                label="TXT 저장"
                onClick={handleTxtDownload}
              />
              <FabMenuItem
                icon="upload"
                label="JSON 불러오기"
                onClick={() => {
                  setShowExportMenu(false)
                  fileInputRef.current?.click()
                }}
              />
              <FabMenuItem
                icon="download"
                label="JSON 저장"
                onClick={handleJsonExport}
              />
            </div>
          </>
        )}
        {/* Main FAB button */}
        <button
          onClick={() => setShowExportMenu((v) => !v)}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
            showExportMenu
              ? "bg-muted text-foreground rotate-45"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
          title="내보내기 메뉴"
        >
          <span className="material-icons-outlined text-[24px]">
            {showExportMenu ? "close" : "ios_share"}
          </span>
        </button>
      </div>

      <AiPasswordDialog
        open={pwDialog.open}
        error={pwDialog.error}
        onSubmit={handlePwSubmit}
        onCancel={handlePwCancel}
      />
    </div>
  )
}

// ── FAB menu item sub-component ─────────────────────────────────────────────
function FabMenuItem({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: string
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 bg-background border shadow-md rounded-full px-4 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <span className={`material-icons-outlined text-[18px] ${disabled ? "text-muted-foreground animate-spin" : "text-primary"}`}>
        {icon}
      </span>
      {label}
    </button>
  )
}

// ── AI Suggestion Panel ──────────────────────────────────────────────────────
function AiSuggestionPanel({
  suggestion,
  model,
  onApply,
  onClose,
}: {
  suggestion: string
  model: string
  onApply: () => void
  onClose: () => void
}) {
  const shortModel = model.includes("/") ? model.split("/").pop()! : model
  return (
    <div className="border rounded-lg p-3.5 bg-violet-50/60 border-violet-200 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-violet-700 flex items-center gap-1">
          <span className="material-icons-outlined text-[14px]">auto_awesome</span>
          AI 제안
          <span className="font-mono opacity-70">({shortModel})</span>
        </span>
        <button
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          닫기
        </button>
      </div>
      <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{suggestion}</p>
      <Button size="sm" onClick={onApply} className="h-7 text-xs gap-1">
        <span className="material-icons-outlined text-[14px]">check</span>
        적용하기
      </Button>
    </div>
  )
}

// ── AI Evaluation Suggestion Panel ───────────────────────────────────────────
function AiEvalSuggestionPanel({
  suggestions,
  onApply,
  onClose,
}: {
  suggestions: Array<{ domain: string; element: string; methods: string[] }>
  onApply: () => void
  onClose: () => void
}) {
  return (
    <div className="border rounded-lg p-3.5 bg-violet-50/60 border-violet-200 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-violet-700 flex items-center gap-1">
          <span className="material-icons-outlined text-[14px]">auto_awesome</span>
          AI 평가 계획 제안 ({suggestions.length}개)
        </span>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">닫기</button>
      </div>
      <div className="space-y-2">
        {suggestions.map((s, i) => (
          <div key={i} className="bg-background border rounded-lg p-2.5 text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-muted-foreground">평가영역</span>
              <span className="font-medium">{s.domain}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[10px] font-semibold text-muted-foreground shrink-0">평가요소</span>
              <span className="text-foreground/80">{s.element}</span>
            </div>
            {s.methods.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] font-semibold text-muted-foreground">평가방법</span>
                {s.methods.map((m) => (
                  <span key={m} className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-full text-[10px]">{m}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">적용하면 현재 평가 계획이 모두 교체됩니다. 성취기준 연결은 직접 선택해주세요.</p>
      <Button size="sm" onClick={onApply} className="h-7 text-xs gap-1">
        <span className="material-icons-outlined text-[14px]">check</span>
        적용하기
      </Button>
    </div>
  )
}

// ── parseEvalSuggestions ─────────────────────────────────────────────────────
function parseEvalSuggestions(text: string): Array<{ domain: string; element: string; methods: string[] }> | null {
  try {
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return null
    const parsed: unknown = JSON.parse(match[0])
    if (!Array.isArray(parsed)) return null
    const valid = (parsed as Array<Record<string, unknown>>).filter(
      (e) => typeof e.domain === "string" && typeof e.element === "string"
    )
    if (valid.length === 0) return null
    return valid.map((e) => ({
      domain: e.domain as string,
      element: e.element as string,
      methods: Array.isArray(e.methods) ? (e.methods as string[]) : [],
    }))
  } catch {
    return null
  }
}
