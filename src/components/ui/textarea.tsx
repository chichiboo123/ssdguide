import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoResize?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, autoResize, value, ...props }, forwardedRef) => {
    const localRef = React.useRef<HTMLTextAreaElement>(null)
    React.useImperativeHandle(forwardedRef, () => localRef.current!)

    React.useEffect(() => {
      if (!autoResize || !localRef.current) return
      const el = localRef.current
      el.style.height = "auto"
      el.style.height = `${el.scrollHeight}px`
    }, [value, autoResize])

    return (
      <textarea
        ref={localRef}
        value={value}
        className={cn(
          "flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          autoResize && "resize-none overflow-hidden",
          className
        )}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
