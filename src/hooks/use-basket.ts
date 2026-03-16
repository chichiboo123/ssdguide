import { useState, useEffect, useCallback } from "react"
import type { BasketItem } from "@/lib/types"

const BASKET_STORAGE_KEY = "seongsu-basket-data"

function loadBasket(): BasketItem[] {
  try {
    const stored = localStorage.getItem(BASKET_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveBasket(items: BasketItem[]) {
  localStorage.setItem(BASKET_STORAGE_KEY, JSON.stringify(items))
  window.dispatchEvent(new CustomEvent("basket-updated"))
}

export function useBasket() {
  const [items, setItems] = useState<BasketItem[]>(loadBasket)

  useEffect(() => {
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === BASKET_STORAGE_KEY) {
        setItems(loadBasket())
      }
    }
    const handleCustomEvent = () => {
      setItems(loadBasket())
    }
    window.addEventListener("storage", handleStorageEvent)
    window.addEventListener("basket-updated", handleCustomEvent)
    return () => {
      window.removeEventListener("storage", handleStorageEvent)
      window.removeEventListener("basket-updated", handleCustomEvent)
    }
  }, [])

  const addItem = useCallback((item: BasketItem) => {
    setItems((prev) => {
      const exists = prev.some((i) => i.코드 === item.코드)
      if (exists) return prev
      const next = [...prev, item]
      saveBasket(next)
      return next
    })
  }, [])

  const removeItem = useCallback((code: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.코드 !== code)
      saveBasket(next)
      return next
    })
  }, [])

  const reorderItems = useCallback((newItems: BasketItem[]) => {
    setItems(newItems)
    saveBasket(newItems)
  }, [])

  const clearBasket = useCallback(() => {
    setItems([])
    saveBasket([])
  }, [])

  const isInBasket = useCallback(
    (code: string) => items.some((i) => i.코드 === code),
    [items]
  )

  return { items, addItem, removeItem, reorderItems, clearBasket, isInBasket }
}
