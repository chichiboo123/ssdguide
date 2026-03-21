import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
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
import type { BasketItem } from "@/lib/types"

export default function HomePage() {
  const { items: basketItems, addItem, removeItem, reorderItems, clearBasket, isInBasket } = useBasket()
  const { toast } = useToast()

  const [showClearDialog, setShowClearDialog] = useState(false)
  const [basketOpen, setBasketOpen] = useState(false)

  const addedCodes = new Set(basketItems.map((b) => b.코드))

  const handleAddToBasket = useCallback((item: BasketItem) => {
    if (isInBasket(item.코드)) {
      toast({ title: "이미 바구니에 있습니다.", duration: 1500 })
      return
    }
    addItem(item)
    toast({ title: "바구니에 추가됨", description: item.코드, duration: 1500 })
  }, [addItem, isInBasket, toast])

  const handleRemoveFromBasket = useCallback((code: string) => {
    removeItem(code)
    toast({ title: "바구니에서 제거됨", duration: 1500 })
  }, [removeItem, toast])

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return
    const newItems = [...basketItems]
    ;[newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]]
    reorderItems(newItems)
  }, [basketItems, reorderItems])

  const handleMoveDown = useCallback((index: number) => {
    if (index === basketItems.length - 1) return
    const newItems = [...basketItems]
    ;[newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]]
    reorderItems(newItems)
  }, [basketItems, reorderItems])

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-56px)]">
      {/* Main content: filter + results */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <AchievementFilterPanel
          onAdd={handleAddToBasket}
          addedCodes={addedCodes}
          addLabel="바구니 추가"
          addedLabel="추가됨"
        />
      </div>

      {/* Basket sidebar – desktop */}
      <aside className="hidden lg:flex flex-col w-72 border-l bg-muted/20">
        <BasketSidebar
          items={basketItems}
          onRemove={handleRemoveFromBasket}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          onClear={() => setShowClearDialog(true)}
        />
      </aside>

      {/* Basket FAB – mobile */}
      <div className="lg:hidden fixed bottom-4 right-4 z-30">
        <Button
          onClick={() => setBasketOpen(true)}
          className="rounded-full shadow-lg h-14 w-14 relative"
          size="icon"
        >
          <span className="material-icons-outlined">shopping_basket</span>
          {basketItems.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {basketItems.length}
            </span>
          )}
        </Button>
      </div>

      {/* Basket dialog – mobile */}
      <Dialog open={basketOpen} onOpenChange={setBasketOpen}>
        <DialogContent className="max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="material-icons-outlined">shopping_basket</span>
              수업 바구니
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <BasketSidebar
              items={basketItems}
              onRemove={handleRemoveFromBasket}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onClear={() => setShowClearDialog(true)}
              compact
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Clear basket confirmation */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>바구니 비우기</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            바구니의 모든 항목({basketItems.length}개)을 삭제하시겠습니까?
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowClearDialog(false)}>취소</Button>
            <Button
              variant="destructive"
              onClick={() => {
                clearBasket()
                setShowClearDialog(false)
                toast({ title: "바구니를 비웠습니다.", duration: 1500 })
              }}
            >
              비우기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface BasketSidebarProps {
  items: BasketItem[]
  onRemove: (code: string) => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  onClear: () => void
  compact?: boolean
}

function BasketSidebar({ items, onRemove, onMoveUp, onMoveDown, onClear, compact }: BasketSidebarProps) {
  return (
    <div className={compact ? "" : "flex flex-col h-full"}>
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <span className="material-icons-outlined text-[18px]">shopping_basket</span>
          <span className="font-medium text-sm">수업 바구니</span>
          {items.length > 0 && (
            <Badge variant="secondary" className="text-xs">{items.length}</Badge>
          )}
        </div>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear} className="text-destructive hover:text-destructive">
            <span className="material-icons-outlined text-[16px]">delete_sweep</span>
            <span className="ml-1 text-xs">비우기</span>
          </Button>
        )}
      </div>

      <div className={compact ? "space-y-1 p-2" : "flex-1 overflow-auto space-y-1 p-2"}>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm">
            <span className="material-icons-outlined text-3xl mb-2 opacity-40">shopping_basket</span>
            <p>바구니가 비어있습니다.</p>
            <p className="text-xs mt-1">성취기준을 추가해보세요.</p>
          </div>
        ) : (
          items.map((item, index) => (
            <div key={item.코드} className="group border rounded p-2 bg-background text-xs flex items-start gap-1">
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-accent rounded"
                  onClick={() => onMoveUp(index)}
                  disabled={index === 0}
                >
                  <span className="material-icons-outlined text-[14px]">keyboard_arrow_up</span>
                </button>
                <button
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-accent rounded"
                  onClick={() => onMoveDown(index)}
                  disabled={index === items.length - 1}
                >
                  <span className="material-icons-outlined text-[14px]">keyboard_arrow_down</span>
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-mono font-semibold text-primary">{item.코드}</div>
                <div className="text-muted-foreground leading-tight mt-0.5 line-clamp-2">{item.내용}</div>
              </div>
              <button
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/10 hover:text-destructive rounded shrink-0"
                onClick={() => onRemove(item.코드)}
              >
                <span className="material-icons-outlined text-[14px]">close</span>
              </button>
            </div>
          ))
        )}
      </div>

      {items.length > 0 && (
        <div className="p-3 border-t">
          <a
            href="/design"
            className="flex items-center justify-center gap-2 w-full rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <span className="material-icons-outlined text-[18px]">edit_note</span>
            수업 디자인하기
          </a>
        </div>
      )}
    </div>
  )
}
