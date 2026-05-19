import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface AiPasswordDialogProps {
  open: boolean
  error?: string | null
  onSubmit: (password: string) => void
  onCancel: () => void
}

export function AiPasswordDialog({ open, error, onSubmit, onCancel }: AiPasswordDialogProps) {
  const [pw, setPw] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pw.trim()) { onSubmit(pw.trim()); setPw("") }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setPw(""); onCancel() } }}>
      <DialogContent className="sm:max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="material-icons-outlined text-primary text-[22px]">lock</span>
            AI 기능 잠금 해제
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <p className="text-sm text-muted-foreground">
            AI 기능을 사용하려면 비밀번호를 입력하세요.
          </p>
          <Input
            type="password"
            placeholder="비밀번호"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoFocus
            className="rounded-xl"
          />
          {error && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <span className="material-icons-outlined text-[16px]">error_outline</span>
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => { setPw(""); onCancel() }}>
              취소
            </Button>
            <Button type="submit" className="rounded-xl" disabled={!pw.trim()}>
              확인
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
