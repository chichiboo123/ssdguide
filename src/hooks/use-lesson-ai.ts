import { useState, useCallback } from 'react'
import { suggestLessonContent, type LessonAIRequest } from '@/lib/groq-client'

export interface AISuggestion {
  section: 'objective' | 'process'
  text: string
  model: string
}

export function useLessonAI() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null)

  const suggest = useCallback(
    async (req: LessonAIRequest, section: AISuggestion['section']) => {
      setIsLoading(true)
      setError(null)
      setSuggestion(null)
      try {
        const result = await suggestLessonContent(req)
        setSuggestion({ section, text: result.content, model: result.model })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'AI 요청 실패'
        setError(msg)
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const clearSuggestion = useCallback(() => setSuggestion(null), [])

  return { suggest, isLoading, error, suggestion, clearSuggestion }
}
