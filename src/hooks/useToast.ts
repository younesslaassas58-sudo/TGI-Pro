import { create } from 'zustand'

type ToastKind = 'success' | 'error'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

interface ToastState {
  items: ToastItem[]
  show: (kind: ToastKind, message: string) => void
  dismiss: (id: number) => void
}

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  show: (kind, message) => {
    const id = Date.now() + Math.random()
    set((state) => ({ items: [...state.items, { id, kind, message }] }))
    window.setTimeout(() => {
      set((state) => ({ items: state.items.filter((item) => item.id !== id) }))
    }, 5000)
  },
  dismiss: (id) =>
    set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
}))

export function useToast() {
  const show = useToastStore((state) => state.show)
  return {
    success: (message: string) => show('success', message),
    error: (message: string) => show('error', message),
  }
}
