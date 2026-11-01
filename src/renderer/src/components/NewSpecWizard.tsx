import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2Icon, PlusIcon, XIcon } from 'lucide-react'
import { slugify, validateSlug } from '@shared/slug'
import type { TemplateInfo } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { api, describeError, parseAppError } from '@/lib/api'
import { useAppStore } from '@/store/app-store'

export function NewSpecWizard() {
  const open = useAppStore((s) => s.dialog === 'wizard')
  const setDialog = useAppStore((s) => s.setDialog)
  return (
    <Dialog open={open} onOpenChange={(o) => setDialog(o ? 'wizard' : null)}>
      <DialogContent className="sm:max-w-xl">{open && <WizardForm />}</DialogContent>
    </Dialog>
  )
}

function WizardForm() {
  const { t } = useTranslation()
  const project = useAppStore((s) => s.project)
  const language = useAppStore((s) => s.language)
  const { setDialog, select, setTab, refreshProject, toast } = useAppStore.getState()

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [templates, setTemplates] = useState<TemplateInfo[]>([])
  const [templateId, setTemplateId] = useState('builtin:standard')
  const [requirements, setRequirements] = useState<string[]>([''])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const reqRefs = useRef<(HTMLInputElement | null)[]>([])
  const [focusIndex, setFocusIndex] = useState<number | null>(null)

  // Focus after React has committed the new/removed row (refs are up to date here).
  useEffect(() => {
    if (focusIndex === null) return
    reqRefs.current[focusIndex]?.focus()
    setFocusIndex(null)
  }, [focusIndex, requirements.length])

  useEffect(() => {
    void api.templates.list(language).then((list) => {
      setTemplates(list)
      // Prefer a project template named "standard" (the documented convention), else the built-in.
      const local = list.find((x) => x.id === 'local:standard')
      if (local) setTemplateId(local.id)
    })
  }, [language])

  // Auto-derive the slug from the title until the user edits the slug manually.
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title))
  }, [title, slugTouched])

  const existing = useMemo(() => project?.specs.map((s) => s.slug) ?? [], [project])
  const slugError = validateSlug(slug, existing)
  const titleError = title.trim() ? null : 'titleRequired'
  const showSlugError = slugError && (slugTouched || submitted || slug.length > 0)
  const canSubmit = !slugError && !titleError && !submitting

  const submit = async (): Promise<void> => {
    setSubmitted(true)
    setServerError(null)
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const created = await api.spec.create({
        slug,
        title: title.trim(),
        templateId,
        requirements: requirements.map((r) => r.trim()).filter(Boolean),
        language
      })
      await refreshProject()
      select(created.slug)
      setTab('requirements')
      setDialog(null)
      toast(t('wizard.created', { title: created.title }), 'success')
    } catch (err) {
      const { code } = parseAppError(err)
      setServerError(code === 'MODULE_EXISTS' ? t('wizard.errors.exists') : describeError(err))
      if (code === 'MODULE_EXISTS') await refreshProject()
    } finally {
      setSubmitting(false)
    }
  }

  const updateReq = (i: number, value: string): void =>
    setRequirements((r) => r.map((x, j) => (j === i ? value : x)))
  const addReq = (after: number): void => {
    setRequirements((r) => [...r.slice(0, after + 1), '', ...r.slice(after + 1)])
    setFocusIndex(after + 1)
  }
  const removeReq = (i: number): void => {
    setRequirements((r) => (r.length === 1 ? [''] : r.filter((_, j) => j !== i)))
    setFocusIndex(Math.max(0, i - 1))
  }

  const builtins = templates.filter((x) => x.source === 'builtin')
  const locals = templates.filter((x) => x.source === 'local')
  const selectedTemplate = templates.find((x) => x.id === templateId)

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <DialogHeader>
        <DialogTitle>{t('wizard.title')}</DialogTitle>
        <DialogDescription>{t('wizard.description')}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="spec-title">{t('wizard.titleLabel')}</Label>
        <Input
          id="spec-title"
          autoFocus
          value={title}
          placeholder={t('wizard.titlePlaceholder')}
          aria-invalid={submitted && !!titleError}
          onChange={(e) => setTitle(e.target.value)}
        />
        {submitted && titleError && <p className="text-xs text-destructive">{t('wizard.errors.titleRequired')}</p>}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="spec-slug">{t('wizard.moduleName')}</Label>
        <div className="flex items-center rounded-md border border-input font-mono text-sm shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30 aria-invalid:border-destructive" aria-invalid={!!showSlugError}>
          <span className="pl-3 text-muted-foreground select-none">specs/</span>
          <input
            id="spec-slug"
            value={slug}
            spellCheck={false}
            maxLength={64}
            className="h-9 flex-1 bg-transparent pr-3 outline-none"
            onChange={(e) => {
              setSlugTouched(true)
              // Normalize as the user types: lowercase, spaces/underscores → hyphens.
              setSlug(e.target.value.toLowerCase().replace(/[\s_]+/g, '-'))
            }}
          />
          <span className="pr-3 text-muted-foreground select-none">/</span>
        </div>
        {showSlugError ? (
          <p className="text-xs text-destructive">{t(`wizard.errors.${slugError}`)}</p>
        ) : (
          <p className="text-xs text-muted-foreground">{t('wizard.moduleHint')}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label>{t('wizard.template')}</Label>
        <Select value={templateId} onValueChange={setTemplateId}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {locals.length > 0 && (
              <SelectGroup>
                <SelectLabel>{t('wizard.local')} · specs/.templates/</SelectLabel>
                {locals.map((x) => (
                  <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>
                ))}
              </SelectGroup>
            )}
            <SelectGroup>
              <SelectLabel>{t('wizard.builtin')}</SelectLabel>
              {builtins.map((x) => (
                <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {selectedTemplate?.description && (
          <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label>
          {t('wizard.requirements')} <span className="font-normal text-muted-foreground">({t('common.optional')})</span>
        </Label>
        <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto pr-1">
          {requirements.map((req, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-4 text-center text-muted-foreground">•</span>
              <Input
                ref={(el) => {
                  reqRefs.current[i] = el
                }}
                value={req}
                className="h-8"
                placeholder={i === 0 ? t('wizard.requirementPlaceholder') : ''}
                onChange={(e) => updateReq(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (req.trim()) addReq(i)
                  } else if (e.key === 'Backspace' && req === '' && requirements.length > 1) {
                    e.preventDefault()
                    removeReq(i)
                  }
                }}
              />
              <Button type="button" variant="ghost" size="icon-sm" aria-label={t('wizard.removeRequirement')} onClick={() => removeReq(i)}>
                <XIcon />
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => addReq(requirements.length - 1)}>
          <PlusIcon /> {t('wizard.addRequirement')}
        </Button>
      </div>

      {serverError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>}

      <DialogFooter className="items-center sm:justify-between">
        <span className="truncate font-mono text-xs text-muted-foreground">
          {!slugError && t('wizard.pathPreview', { path: `specs/${slug}/` })}
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setDialog(null)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={submitting || (submitted && !canSubmit)}>
            {submitting && <Loader2Icon className="animate-spin" />}
            {submitting ? t('wizard.creating') : t('wizard.create')}
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}
