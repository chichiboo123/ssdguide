export interface StandardItem {
  코드: string
  내용: string
  교육과정: string
  학년군: string
  과목: string
  영역?: string
}

export type RequestType = 'suggest_objective' | 'suggest_process'

export interface LessonAIRequest {
  standards: StandardItem[]
  intent: string
  requestType: RequestType
  objective?: string
}

export interface LessonAIResponse {
  content: string
  model: string
}
