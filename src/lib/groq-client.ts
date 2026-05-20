const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

const PW_KEY = 'ssdguide-ai-pw'
export const getStoredAiPassword = (): string | null => sessionStorage.getItem(PW_KEY)
export const setStoredAiPassword = (pw: string): void => { sessionStorage.setItem(PW_KEY, pw) }
export const clearStoredAiPassword = (): void => { sessionStorage.removeItem(PW_KEY) }

export interface StandardItem {
  코드: string
  내용: string
  교육과정: string
  학년군: string
  과목: string
  영역?: string
}

export type RequestType = 'suggest_objective' | 'suggest_process' | 'suggest_evaluation' | 'suggest_intent_edit'

export interface LessonAIOptions {
  /** 대상 학년 (예: "5학년") */
  grade?: string
  /** 차시 규모 (예: "4~6차시") */
  lessonScale?: string
  /** 사용할 디지털 도구 (예: "ChatGPT, Canva") */
  tools?: string
  /** 프로젝트 결과물 형태 */
  outputForm?: string
}

export interface LessonAIRequest extends LessonAIOptions {
  standards?: StandardItem[]
  intent: string
  requestType: RequestType
  /** 평가 추천에서 평가영역을 제한할 교과 목록 */
  subjects?: string[]
  /** Current objective — passed as context for process/evaluation generation */
  objective?: string
  /** Current process — passed as context for evaluation generation */
  process?: string
}

export interface LessonAIResponse {
  content: string
  model: string
}

export async function suggestLessonContent(req: LessonAIRequest): Promise<LessonAIResponse> {
  const pw = getStoredAiPassword()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (pw) headers['x-ai-password'] = pw

  const res = await fetch(`${API_BASE}/api/groq/lesson-design`, {
    method: 'POST',
    headers,
    body: JSON.stringify(req),
  })

  if (res.status === 401) {
    clearStoredAiPassword()
    throw new Error('WRONG_PASSWORD')
  }

  const data: { content?: string; model?: string; error?: string } = await res.json()

  if (!res.ok) {
    throw new Error(data.error ?? `AI 요청 실패 (HTTP ${res.status})`)
  }

  return data as LessonAIResponse
}
