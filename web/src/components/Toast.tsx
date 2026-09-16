import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Info, X, TriangleAlert } from 'lucide-react'

type Kind = 'ok' | 'err' | 'info'
interface Item {
  id: number
  kind: Kind
  title?: string
  text: string
}

const Ctx = createContext<{
  push: (t: { kind?: Kind; title?: string; text: string }) => void
  ok: (text: string, title?: string) => void
  err: (text: string, title?: string) => void
}>({ push: () => {}, ok: () => {}, err: () => {} })

let seq = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([])

  const remove = useCallback((id: number) => setItems((x) => x.filter((i) => i.id !== id)), [])

  const push = useCallback(
    ({ kind = 'info', title, text }: { kind?: Kind; title?: string; text: string }) => {
      const id = seq++
      setItems((x) => [...x, { id, kind, title, text }])
      setTimeout(() => remove(id), kind === 'err' ? 6000 : 3800)
    },
    [remove],
  )

  const value = {
    push,
    ok: (text: string, title?: string) => push({ kind: 'ok', text, title }),
    err: (text: string, title?: string) => push({ kind: 'err', text, title }),
  }

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toast-layer">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className={`toast ${t.kind}`}
            >
              <span className="t-ico">
                {t.kind === 'ok' && <Check />}
                {t.kind === 'err' && <TriangleAlert />}
                {t.kind === 'info' && <Info />}
              </span>
              <div className="t-body">
                {t.title && <div className="t-title">{t.title}</div>}
                <div>{t.text}</div>
              </div>
              <button className="t-close" onClick={() => remove(t.id)} aria-label="Dismiss">
                <X size={15} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
