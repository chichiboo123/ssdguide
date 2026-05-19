import Groq from 'groq-sdk'

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
  'openai/gpt-oss-20b',
  'qwen/qwen3-32b',
  'llama-3.3-70b-versatile',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'llama-3.1-8b-instant',
] as const

type ModelId = (typeof MODELS)[number]

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

type Msg = { role: 'system' | 'user'; content: string }

async function callWithFallback(messages: Msg[], maxTokens = 2500): Promise<{ content: string; model: string }> {
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
        max_tokens: maxTokens,
        temperature: 0.7,
      })
      console.info(`[groq] responded: ${model}`)
      return { content: res.choices[0]?.message?.content ?? '', model }
    } catch (err: unknown) {
      const e = err as { status?: number; headers?: Record<string, string> }
      if (e.status === 429) { blockModel(model, e.headers?.['retry-after']); continue }
      if (e.status === 404 || e.status === 403) { blockedUntil[model] = Date.now() + 86_400_000; continue }
      throw err
    }
  }
  throw new Error('ALL_MODELS_EXHAUSTED')
}

// ── Prompt builders ───────────────────────────────────────────────────────────
const SYSTEM = '너는 대한민국 초등교사를 돕는 수업 설계 전문가야. 교사의 자율성과 전문성을 존중하며 간결하고 명확하게 제안한다.'
const EVAL_METHODS = '논술형, 서술형, 정의적 능력 평가, 협력적 문제해결력 평가, 구술, 발표, 실기, 토의·토론, 실험·실습, 보고서법, 프로젝트, 포트폴리오, 자기평가, 동료평가'

function stdText(standards: Array<{ 코드: string; 내용: string }>) {
  return standards.map((s) => `[${s.코드}] ${s.내용}`).join('\n')
}

function trunc(text: string | undefined, len = 400) {
  if (!text?.trim()) return null
  return text.length > len ? text.slice(0, len) + '…' : text
}

function buildMessages(body: Record<string, unknown>): Msg[] {
  const { standards, intent, requestType, objective, process } = body as {
    standards: Array<{ 코드: string; 내용: string }>
    intent?: string
    requestType: string
    objective?: string
    process?: string
  }
  const i = intent?.trim() || '(미작성)'
  const o = objective?.trim()
  const p = process?.trim()

  if (requestType === 'suggest_objective') {
    return [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `아래 성취기준과 수업자 의도를 바탕으로 수업 목표를 2~3개 제안해줘.

## 성취기준
${stdText(standards)}

## 수업자 의도
${i}${trunc(p) ? `\n\n## 현재 작성된 수업 과정 (참고)\n${trunc(p)}` : ''}

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
        content: `아래 정보를 바탕으로 수업 활동을 차시별로 설계해줘.

## 성취기준
${stdText(standards)}

## 수업자 의도
${i}

## 수업 목표
${o || '(미작성)'}${procCtx ? `\n\n## 현재 작성된 내용 (참고하되 새롭게 제안)\n${procCtx}` : ''}

**출력 형식 — 반드시 아래 구조만 사용. 마크다운 표 절대 사용 금지.**

◆ 1차시 (단차시는 "1차시", 연차시는 "1~2차시" 형식)
- 수업 주제: (학생에게 제시할 짧고 감각적인 제목. 예: 안녕, 인공지능? / 우리 반 노래 만들기 / 동물이 살아있다)
- 내용: (핵심 활동을 "~하기" 형태로 1~2문장 서술. 예: 생성형 AI와 대화하며 질문과 답변 방식 체험하기 / 구글 AR로 교실에 동물을 초대하고 관찰하기)
- 비고: (사용 도구·플랫폼·특이사항 한 줄 이내. 없으면 이 항목 자체를 생략)

**작성 기준:**
- 수업 주제는 교사가 칠판에 판서할 수 있는 수준의 짧은 명사형 또는 문장형 제목
- 내용은 학생 활동 중심으로 구체적이고 행동 동사("~하기")로 마무리
- 비고는 꼭 필요한 경우만 작성 (도구명, 플랫폼명, 준비물 등)
- 모든 차시를 끊기지 않고 완결되게 작성할 것
- 답변 중간에 절대 자르지 말 것`,
      },
    ]
  }

  if (requestType === 'suggest_intent_edit') {
    const { intent } = body as { intent?: string }
    if (!intent?.trim()) throw new Error('INTENT_EMPTY')
    return [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `아래는 교사가 직접 작성한 수업자 의도야.
원문의 내용과 교육적 의도를 절대 바꾸지 말고,
어색한 문장·반복 표현·비문만 교정하여 자연스러운 교육적 서술체로 다듬어줘.

**규칙:**
- 내용 추가·삭제·재해석 금지
- 교사의 고유한 관점과 표현 방향 그대로 유지
- 공문서체가 아닌 자연스러운 서술체 유지
- 첨삭된 결과 텍스트만 반환. 설명·비교·코멘트 없이 결과만 출력

## 원문
${intent}`,
      },
    ]
  }

  if (requestType === 'suggest_evaluation') {
    return [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `아래 성취기준과 수업 내용을 바탕으로 2022 개정 교육과정 평가 계획을 작성해줘.

## 성취기준
${stdText(standards)}

## 수업자 의도
${i}

## 수업 목표
${o || '(미작성)'}${trunc(p) ? `\n\n## 수업 과정 (참고)\n${trunc(p)}` : ''}

**평가 설계 원칙 (2026 초등학교 5~6학년 수업-평가 계획 예시자료 기준):**

[평가영역]
교과별 공식 영역명을 사용한다.
- 국어: 듣기·말하기 / 읽기 / 쓰기 / 문법 / 문학 / 매체
- 사회: 지리-지리인식 / 지리-자연환경과 인간생활 / 지리-인문환경과 인간생활 /
        지리-지속가능한 세계 / 역사-한국사 / 일반사회-정치 / 일반사회-법 /
        일반사회-경제 / 일반사회-사회·문화
- 수학: 수와 연산 / 도형과 측정 / 변화와 관계 / 자료와 가능성
- 과학: 운동과 에너지 / 물질 / 생명 / 지구와 우주 / 과학과 사회
- 도덕: 자신과의 관계 / 타인과의 관계 / 사회·공동체와의 관계 / 자연과의 관계
- 체육: 운동 / 스포츠 / 표현
- 음악: 연주 / 감상 / 창작
- 미술: 미적체험 / 표현 / 감상
- 영어: 이해 / 표현
- 실과: 인간 발달과 주도적 삶 / 생활환경과 지속가능한 선택 /
        기술적 문제해결과 혁신 / 지속가능한 기술과 융합 /
        디지털 사회와 인공지능

[평가요소]
성취기준에서 핵심 능력을 추출하여 "~하기" 형태로 서술한다.
예시: "글의 구조를 고려하여 내용 요약하기" / "배려하는 표현을 사용하여 대화하기" /
      "여정·견문·감상이 드러나게 기행문 쓰기" / "비유적 표현의 효과 파악하기"

[평가방법 선택 기준]
수업 활동의 성격에 따라 아래 기준으로 가장 자연스러운 방법을 선택한다:
- 글·보고서·작품 결과물 → 논술형, 서술형, 보고서법, 포트폴리오, 프로젝트
- 말하기·토론·발표 활동 → 구술, 발표, 토의·토론
- 협력·모둠 활동 → 협력적 문제해결력 평가, 동료평가
- 태도·정서·가치관 → 정의적 능력 평가, 자기평가
- 신체·기능·실험 수행 → 실기, 실험·실습
- 지식·개념 확인 → 논술형, 서술형

사용 가능한 평가방법 전체 목록:
${EVAL_METHODS}

[실제 예시 패턴]
- 국어 읽기 단원: 평가요소 "글의 구조 파악하기 / 중심 내용 요약하기" → 방법: [논술형][발표]
- 국어 쓰기 단원: 평가요소 "여정·견문·감상이 드러나게 기행문 쓰기" → 방법: [논술형][동료평가]
- 국어 듣기·말하기: 평가요소 "배려하는 표현으로 대화하기" → 방법: [구술][정의적 능력 평가]
- 사회 지리 단원: 평가요소 "지형 분포 특징 탐구하기" → 방법: [보고서법][서술형]
- 과학 실험 단원: 평가요소 "실험 과정 수행하기 / 결과 설명하기" → 방법: [실험·실습][서술형]
- 음악 창작 단원: 평가요소 "주제에 맞는 음악 창작하기" → 방법: [실기][포트폴리오]
- 프로젝트 학습: 평가요소 "협력하여 문제 해결하기" → 방법: [협력적 문제해결력 평가][발표]

**중요: 아래 JSON 배열 형식으로만 응답. 마크다운 코드블록 없이 순수 JSON 배열만 반환:**
[
  {
    "domain": "평가영역 (교과 공식 영역명)",
    "element": "평가요소 (~하기 형태, 핵심 능력 2~3개를 / 로 구분)",
    "methods": ["평가방법1", "평가방법2"]
  }
]

제안 수: 2~4개 (성취기준 수와 수업 내용에 비례하여 조절)`,
      },
    ]
  }

  throw new Error(`Unknown requestType: ${requestType}`)
}

// ── CORS headers ──────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-ai-password',
}

// ── Handler ───────────────────────────────────────────────────────────────────
export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' }
  }

  const subpath = event.path.replace(/.*\/api\/groq/, '')

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

  if (event.httpMethod === 'POST' && subpath === '/lesson-design') {
    let body: Record<string, unknown>
    try {
      body = JSON.parse(event.body ?? '{}')
    } catch {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: '잘못된 요청 형식입니다.' }) }
    }

    const { standards, requestType } = body
    if (!requestType) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'requestType이 필요합니다.' }) }
    }
    if (requestType !== 'suggest_intent_edit') {
      if (!Array.isArray(standards) || standards.length === 0) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: '성취기준을 하나 이상 선택해주세요.' }) }
      }
    }

    const AI_PASSWORD = process.env.AI_PASSWORD
    if (AI_PASSWORD) {
      const reqPassword = event.headers['x-ai-password']
      if (reqPassword !== AI_PASSWORD) {
        return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: '비밀번호가 틀립니다.' }) }
      }
    }

    try {
      const messages = buildMessages(body)
      const maxTokens = requestType === 'suggest_intent_edit' ? 800 : 2500
      const result = await callWithFallback(messages, maxTokens)
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
      if (e.message === 'INTENT_EMPTY') {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: '수업자 의도를 입력해주세요.' }) }
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
