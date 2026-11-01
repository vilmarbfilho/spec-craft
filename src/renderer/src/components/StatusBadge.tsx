import { useTranslation } from 'react-i18next'
import type { SpecStatus } from '@shared/types'
import { Badge } from '@/components/ui/badge'

const VARIANT = { draft: 'draft', 'in-progress': 'progress', completed: 'done' } as const

export function StatusBadge({ status, className }: { status: SpecStatus; className?: string }) {
  const { t } = useTranslation()
  return (
    <Badge variant={VARIANT[status]} className={className}>
      {t(`status.${status}`)}
    </Badge>
  )
}
