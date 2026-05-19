import { Router, type Request, type Response } from 'express'
import Groq from 'groq-sdk'
import type { LessonAIRequest, LessonAIResponse, StandardItem } from './types.js'

const router = Router()

function createGroqClient() {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY environment variable is not set')
  return new Groq({ apiKey })
}

// Priority-ordered model list
const MODELS = [
  'openai/gpt-oss-120b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'llama-3.3-70b-versatile',
  'qwen/qwen3-32b',
  'openai/gpt-oss-20b',
] as const

type ModelId = (typeof MODELS)[number]

// Per-model cooldown timestamps (in-memory; resets on server restart)
const blockedUntil: Partial<Record<ModelId, number>> = {}

function isBlocked(model: ModelId): boolean {
  const t = blockedUntil[model]
  return !!t && Date.now() < t
}

function blockModel(model: ModelId, retryAfterHeader?: string) {
  // Honour Retry-After header; default to 60 s if absent
  const seconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60
  const cooldownMs = Number.isFinite(seconds) ? seconds * 1_000 : 60_000
  blockedUntil[model] = Date.now() + cooldownMs
  console.warn(`[groq] ${model} rate-limited — blocked for ${cooldownMs / 1_000}s`)
}

function permanentlyBlock(model: ModelId, reason: string) {
  // Skip unavailable/misconfigured models for the rest of this process lifetime
  blockedUntil[model] = Date.now() + 24 * 60 * 60 * 1_000
  console.error(`[groq] ${model} skipped permanently: ${reason}`)
}

type ChatMessage = { role: 'system' | 'user'; content: string }

async function callWithFallback(messages: ChatMessage[]): Promise<LessonAIResponse> {
  const groq = createGroqClient()
  const available = MODELS.filter((m) => !isBlocked(m))

  if (available.length === 0) {
    throw new Error('ALL_MODELS_RATE_LIMITED')
  }

  for (const model of available) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        messages,
        max_tokens: 1024,
        temperature: 0.7,
      })
      const content = completion.choices[0]?.message?.content ?? ''
      console.info(`[groq] responded: ${model}`)
      return { content, model }
    } catch (err: unknown) {
      const e = err as { status?: number; headers?: Record<string, string>; message?: string }

      if (e.status === 429) {
        blockModel(model, e.headers?.['retry-after'])
        continue
      }

      // Model not found or access denied — skip for session
      if (e.status === 404 || e.status === 403) {
        permanentlyBlock(model, `HTTP ${e.status}: ${e.message ?? ''}`)
        continue
      }

      // Unexpected error — propagate immediately (don't silently skip)
      throw err
    }
  }

  throw new Error('ALL_MODELS_EXHAUSTED')
}

// ── Prompt builders ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT =
  '너는 대한민국 초등교사를 돕는 수업 설계 전문가야. ' +
  '교육과정 이해도가 높고 실천적인 수업 설계를 안내한다. ' +
  '교사의 자율성과 전문성을 존중하며 간결하고 명확하게 제안한다.'

function formatStandards(standards: StandardItem[]): string {
  return standards.map((s) => `[${s.코드}] ${s.내용}`).join('\n')
}

function buildMessages(body: LessonAIRequest): ChatMessage[] {
  const { standards, intent, requestType, objective } = body
  const stdText = formatStandards(standards)
  const intentText = intent?.trim() || '(미작성)'

  if (requestType === 'suggest_objective') {
    return [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `아래 성취기준과 수업자 의도를 바탕으로 수업 목표를 2~3개 제안해줘.

## 성취기준
${stdText}

## 수업자 의도
${intentText}

**작성 형식:**
- 각 목표는 번호를 붙여 "~할 수 있다." 형식으로 끝낼 것
- 성취기준에 직접 연결된 구체적인 행동 목표로 작성
- 불필요한 설명 없이 목표 목록만 제시`,
      },
    ]
  }

  if (requestType === 'suggest_process') {
    return [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `아래 정보를 바탕으로 수업 과정(흐름)을 제안해줘.

## 성취기준
${stdText}

## 수업자 의도
${intentText}

## 수업 목표
${objective?.trim() || '(미작성)'}

**작성 형식:**
- 도입 → 전개 → 정리 흐름으로 구성
- 각 단계의 주요 활동과 예상 소요 시간 포함
- 학생 활동 중심으로 구체적으로 서술`,
      },
    ]
  }

  throw new Error(`Unknown requestType: ${requestType}`)
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.post('/lesson-design', async (req: Request, res: Response) => {
  const body = req.body as LessonAIRequest

  if (!Array.isArray(body.standards) || body.standards.length === 0) {
    res.status(400).json({ error: '성취기준을 하나 이상 선택해주세요.' })
    return
  }
  if (!body.requestType) {
    res.status(400).json({ error: 'requestType이 필요합니다.' })
    return
  }

  try {
    const messages = buildMessages(body)
    const result = await callWithFallback(messages)
    res.json(result)
  } catch (err: unknown) {
    const e = err as Error
    if (e.message === 'ALL_MODELS_RATE_LIMITED' || e.message === 'ALL_MODELS_EXHAUSTED') {
      res.status(429).json({ error: '현재 모든 AI 모델이 사용 제한 중입니다. 잠시 후 다시 시도해주세요.' })
      return
    }
    if (e.message === 'GROQ_API_KEY environment variable is not set') {
      res.status(503).json({ error: 'AI 기능이 서버에 설정되지 않았습니다.' })
      return
    }
    console.error('[groq] unexpected error:', e)
    res.status(500).json({ error: 'AI 요청 중 오류가 발생했습니다.' })
  }
})

// Model availability status (useful for monitoring)
router.get('/status', (_req: Request, res: Response) => {
  const models = MODELS.map((m) => ({
    model: m,
    available: !isBlocked(m),
    unblockAt: blockedUntil[m] ? new Date(blockedUntil[m]!).toISOString() : null,
  }))
  res.json({ models })
})

export default router
