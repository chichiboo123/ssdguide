import Groq from 'groq-sdk'

// Minimal Netlify Function types (avoids @netlify/functions transitive type issues)
interface HandlerEvent {
  httpMethod: string
  path: string
  body: string | null
  headers: Record<string, string | undefined>
}
interface HandlerResponse {
  statusCode: number
  headers?: Record<string, string>
  body: string
}
type Handler = (event: HandlerEvent) => Promise<HandlerResponse>

// ── Model priority list ───────────────────────────────────────────────────────
const MODELS = [
  'openai/gpt-oss-120b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'llama-3.3-70b-versatile',
  'qwen/qwen3-32b',
  'openai/gpt-oss-20b',
] as const

type ModelId = (typeof MODELS)[number]

// Note: this state persists only within a warm Lambda container.
// On cold starts it resets — acceptable for a low-traffic educational tool.
const blockedUntil: Partial<Record<ModelId, number>> = {}

function isBlocked(m: ModelId) {
  const t = blockedUntil[m]
  return !!t && Date.now() < t
}

function blockModel(m: ModelId, retryAfterHeader?: string) {
  const sec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60
  blockedUntil[m] = Date.now() + (Number.isFinite(sec) ? sec * 1_000 : 60_000)
  console.warn(`[groq] ${m} rate-limited for ${sec}s`)
}

// ── Core fallback caller ──────────────────────────────────────────────────────
type Msg = { role: 'system' | 'user'; content: string }

async function callWithFallback(messages: Msg[]): Promise<{ content: string; model: string }> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY_MISSING')

  const groq = new Groq({ apiKey })
  const available = MODELS.filter((m) => !isBlocked(m))
  if (available.length === 0) throw new Error('ALL_MODELS_RATE_LIMITED')

  for (const model of available) {
    try {
      const res = await groq.chat.completions.create({
        model,
        messages,
        max_tokens: 1024,
        temperature: 0.7,
      })
      console.info(`[groq] responded: ${model}`)
      return { content: res.choices[0]?.message?.content ?? '', model }
    } catch (err: unknown) {
      const e = err as { status?: number; headers?: Record<string, string> }
      if (e.status === 429) {
        blockModel(model, e.headers?.['retry-after'])
        continue
      }
      if (e.status === 404 || e.status === 403) {
        blockedUntil[model] = Date.now() + 86_400_000 // skip for 24 h
        continue
      }
      throw err
    }
  }
  throw new Error('ALL_MODELS_EXHAUSTED')
}

// ── Prompt builders ───────────────────────────────────────────────────────────
const SYSTEM = '너는 대한민국 초등교사를 돕는 수업 설계 전문가야. 교사의 자율성과 전문성을 존중하며 간결하고 명확하게 제안한다.'

function stdText(standards: Array<{ 코드: string; 내용: string }>) {
  return standards.map((s) => `[${s.코드}] ${s.내용}`).join('\n')
}

function buildMessages(body: Record<string, unknown>): Msg[] {
  const { standards, intent, requestType, objective } = body as {
    standards: Array<{ 코드: string; 내용: string }>
    intent?: string
    requestType: string
    objective?: string
  }
  const i = intent?.trim() || '(미작성)'
  const o = objective?.trim() || '(미작성)'

  if (requestType === 'suggest_objective') {
    return [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `아래 성취기준과 수업자 의도를 바탕으로 수업 목표를 2~3개 제안해줘.

## 성취기준
${stdText(standards)}

## 수업자 의도
${i}

**작성 형식:**
- 각 목표는 번호를 붙여 "~할 수 있다." 형식으로 끝낼 것
- 불필요한 설명 없이 목표 목록만 제시`,
      },
    ]
  }

  if (requestType === 'suggest_process') {
    return [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `아래 정보를 바탕으로 수업 과정(흐름)을 제안해줘.

## 성취기준
${stdText(standards)}

## 수업자 의도
${i}

## 수업 목표
${o}

**작성 형식:**
- 도입 → 전개 → 정리 흐름으로 구성
- 각 단계의 주요 활동과 예상 소요 시간 포함
- 학생 활동 중심으로 구체적으로 서술`,
      },
    ]
  }

  throw new Error(`Unknown requestType: ${requestType}`)
}

// ── CORS headers ──────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// ── Handler ───────────────────────────────────────────────────────────────────
export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' }
  }

  const subpath = event.path.replace(/.*\/api\/groq/, '') // e.g. "/lesson-design"

  // ── GET /api/groq/status ──────────────────────────────────────────────────
  if (event.httpMethod === 'GET' && subpath === '/status') {
    const models = MODELS.map((m) => ({
      model: m,
      available: !isBlocked(m),
      unblockAt: blockedUntil[m] ? new Date(blockedUntil[m]!).toISOString() : null,
    }))
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ models }),
    }
  }

  // ── POST /api/groq/lesson-design ──────────────────────────────────────────
  if (event.httpMethod === 'POST' && subpath === '/lesson-design') {
    let body: Record<string, unknown>
    try {
      body = JSON.parse(event.body ?? '{}')
    } catch {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: '잘못된 요청 형식입니다.' }) }
    }

    const { standards, requestType } = body
    if (!Array.isArray(standards) || standards.length === 0) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: '성취기준을 하나 이상 선택해주세요.' }) }
    }
    if (!requestType) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'requestType이 필요합니다.' }) }
    }

    try {
      const messages = buildMessages(body)
      const result = await callWithFallback(messages)
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      }
    } catch (err: unknown) {
      const e = err as Error
      if (e.message === 'GROQ_API_KEY_MISSING') {
        return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: 'AI 기능이 서버에 설정되지 않았습니다.' }) }
      }
      if (e.message === 'ALL_MODELS_RATE_LIMITED' || e.message === 'ALL_MODELS_EXHAUSTED') {
        return { statusCode: 429, headers: CORS, body: JSON.stringify({ error: '현재 모든 AI 모델이 사용 제한 중입니다. 잠시 후 다시 시도해주세요.' }) }
      }
      console.error('[groq] unexpected error:', e)
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'AI 요청 중 오류가 발생했습니다.' }) }
    }
  }

  return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Not found' }) }
}
