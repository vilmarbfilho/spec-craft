import { CheckCircle2Icon, InfoIcon, XCircleIcon, XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'

export function Toaster() {
  const toasts = useAppStore((s) => s.toasts)
  const dismiss = useAppStore((s) => s.dismissToast)
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-80 flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((t) => {
        const Icon = t.variant === 'success' ? CheckCircle2Icon : t.variant === 'error' ? XCircleIcon : InfoIcon
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-popover p-3 text-sm shadow-lg animate-in fade-in-0 slide-in-from-bottom-2"
          >
            <Icon
              className={cn(
                'mt-0.5 size-4 shrink-0',
                t.variant === 'success' && 'text-success',
                t.variant === 'error' && 'text-destructive',
                t.variant === 'default' && 'text-muted-foreground'
              )}
            />
            <p className="flex-1 break-words">{t.message}</p>
            <button className="opacity-60 hover:opacity-100" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <XIcon className="size-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
