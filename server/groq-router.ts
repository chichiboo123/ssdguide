import { Router, type Request, type Response } from 'express'
import Groq from 'groq-sdk'
import type { LessonAIRequest, LessonAIResponse, StandardItem } from './types.js'

const router = Router()

function createGroqClient() {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY environment variable is not set')
  return new Groq({ apiKey })
}

const MODELS = [
  'openai/gpt-oss-120b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'llama-3.3-70b-versatile',
  'qwen/qwen3-32b',
  'openai/gpt-oss-20b',
] as const

type ModelId = (typeof MODELS)[number]

const blockedUntil: Partial<Record<ModelId, number>> = {}

function isBlocked(model: ModelId): boolean {
  const t = blockedUntil[model]
  return !!t && Date.now() < t
}

function blockModel(model: ModelId, retryAfterHeader?: string) {
  const seconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60
  const cooldownMs = Number.isFinite(seconds) ? seconds * 1_000 : 60_000
  blockedUntil[model] = Date.now() + cooldownMs
  console.warn(`[groq] ${model} rate-limited for ${cooldownMs / 1_000}s`)
}

function permanentlyBlock(model: ModelId, reason: string) {
  blockedUntil[model] = Date.now() + 24 * 60 * 60 * 1_000
  console.error(`[groq] ${model} skipped: ${reason}`)
}

type ChatMessage = { role: 'system' | 'user'; content: string }

async function callWithFallback(messages: ChatMessage[]): Promise<LessonAIResponse> {
  const groq = createGroqClient()
  const available = MODELS.filter((m) => !isBlocked(m))
  if (available.length === 0) throw new Error('ALL_MODELS_RATE_LIMITED')

  for (const model of available) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages,
        max_tokens: 2500,
        temperature: 0.7,
      })
      const content = completion.choices[0]?.message?.content ?? ''
      console.info(`[groq] responded: ${model}`)
      return { content, model }
    } catch (err: unknown) {
      const e = err as { status?: number; headers?: Record<string, string>; message?: string }
      if (e.status === 429) { blockModel(model, e.headers?.['retry-after']); continue }
      if (e.status === 404 || e.status === 403) { permanentlyBlock(model, `HTTP ${e.status}: ${e.message ?? ''}`); continue }
      throw err
    }
  }
  throw new Error('ALL_MODELS_EXHAUSTED')
}

// ── Prompt builders ───────────────────────────────────────────────────────────

const SYSTEM =
  '너는 대한민국 초등교사를 돕는 수업 설계 전문가야. ' +
  '교사의 자율성과 전문성을 존중하며 간결하고 명확하게 제안한다.'

const EVAL_METHODS = '논술형, 서술형, 정의적 능력 평가, 협력적 문제해결력 평가, 구술, 발표, 실기, 토의·토론, 실험·실습, 보고서법, 프로젝트, 포트폴리오, 자기평가, 동료평가'

function formatStds(standards: StandardItem[]) {
  return standards.map((s) => `[${s.코드}] ${s.내용}`).join('\n')
}

function trunc(text: string | undefined, len = 400) {
  if (!text) return null
  return text.length > len ? text.slice(0, len) + '…' : text
}

function buildMessages(body: LessonAIRequest): ChatMessage[] {
  const { standards, intent, requestType, objective, process } = body
  const stdText = formatStds(standards)
  const i = intent?.trim() || '(미작성)'
  const o = objective?.trim()
  const p = process?.trim()

  if (requestType === 'suggest_objective') {
    const procCtx = trunc(p)
    return [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `아래 성취기준과 수업자 의도를 바탕으로 수업 목표를 2~3개 제안해줘.

## 성취기준
${stdText}

## 수업자 의도
${i}${procCtx ? `\n\n## 현재 작성된 수업 과정 (참고)\n${procCtx}` : ''}

**작성 형식:**
- 각 목표는 번호를 붙여 "~할 수 있다." 형식으로 끝낼 것
- 불필요한 설명 없이 목표 목록만 제시`,
      },
    ]
  }

  if (requestType === 'suggest_process') {
    const procCtx = trunc(p, 300)
    return [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `아래 정보를 바탕으로 수업 과정(흐름)을 차시별로 제안해줘.

## 성취기준
${stdText}

## 수업자 의도
${i}

## 수업 목표
${o || '(미작성)'}${procCtx ? `\n\n## 현재 작성된 수업 과정 (참고하되 새롭게 제안하세요)\n${procCtx}` : ''}

**작성 형식 (반드시 지킬 것):**
- 단차시 또는 연차시로 구성 (성취기준과 수업 내용에 맞게 결정)
- 각 차시는 아래 형식으로 작성:

◆ 1차시 (또는 1~2차시 등)
• 수업 주제: (이 차시의 핵심 주제)
• 수업 내용:
  - (도입) 예상 시간 포함, 학생 활동 중심 서술
  - (전개) 예상 시간 포함, 학생 활동 중심 서술
  - (정리) 예상 시간 포함, 학생 활동 중심 서술
• 비고: (특이사항이 있을 경우만 작성 — 없으면 이 항목 생략)

- **표 형식(마크다운 테이블)은 절대 사용하지 말 것**
- **답변을 중간에 자르지 말고 모든 차시를 완결되게 작성할 것**`,
      },
    ]
  }

  if (requestType === 'suggest_evaluation') {
    return [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `아래 성취기준을 바탕으로 평가 계획을 제안해줘.

## 성취기준
${stdText}

## 수업자 의도
${i}

## 수업 목표
${o || '(미작성)'}${trunc(p) ? `\n\n## 수업 과정 (참고)\n${trunc(p)}` : ''}

**중요: 아래 JSON 배열 형식으로만 응답해. 마크다운 코드 블록 없이 순수 JSON 배열만 반환:**
[
  { "domain": "평가영역", "element": "평가요소", "methods": ["평가방법"] }
]

사용 가능한 평가방법: ${EVAL_METHODS}
제안 수: 2~4개 (성취기준 수와 내용에 맞게 조절)`,
      },
    ]
  }

  throw new Error(`Unknown requestType: ${requestType}`)
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.post('/lesson-design', async (req: Request, res: Response) => {
  const body = req.body as LessonAIRequest

  if (!Array.isArray(body.standards) || body.standards.length === 0) {
    res.status(400).json({ error: '성취기준을 하나 이상 선택해주세요.' }); return
  }
  if (!body.requestType) {
    res.status(400).json({ error: 'requestType이 필요합니다.' }); return
  }

  const AI_PASSWORD = process.env.AI_PASSWORD
  if (AI_PASSWORD) {
    const reqPassword = req.headers['x-ai-password'] as string | undefined
    if (reqPassword !== AI_PASSWORD) {
      res.status(401).json({ error: '비밀번호가 틀립니다.' }); return
    }
  }

  try {
    const messages = buildMessages(body)
    const result = await callWithFallback(messages)
    res.json(result)
  } catch (err: unknown) {
    const e = err as Error
    if (e.message === 'ALL_MODELS_RATE_LIMITED' || e.message === 'ALL_MODELS_EXHAUSTED') {
      res.status(429).json({ error: '현재 모든 AI 모델이 사용 제한 중입니다. 잠시 후 다시 시도해주세요.' }); return
    }
    if (e.message === 'GROQ_API_KEY environment variable is not set') {
      res.status(503).json({ error: 'AI 기능이 서버에 설정되지 않았습니다.' }); return
    }
    console.error('[groq] unexpected error:', e)
    res.status(500).json({ error: 'AI 요청 중 오류가 발생했습니다.' })
  }
})

router.get('/status', (_req: Request, res: Response) => {
  const models = MODELS.map((m) => ({
    model: m,
    available: !isBlocked(m),
    unblockAt: blockedUntil[m] ? new Date(blockedUntil[m]!).toISOString() : null,
  }))
  res.json({ models })
})

export default router
