import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyIcon, FolderOpenIcon, LayoutTemplateIcon, Trash2Icon } from 'lucide-react'
import { SPEC_FILE_KINDS, type TemplateInfo } from '@shared/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { api, describeError } from '@/lib/api'
import { useAppStore } from '@/store/app-store'

const PLACEHOLDERS = ['{{module}}', '{{title}}', '{{date}}', '{{requirements}}']
const TEMPLATE_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/

export function TemplatesDialog() {
  const open = useAppStore((s) => s.dialog === 'templates')
  const setDialog = useAppStore((s) => s.setDialog)
  return (
    <Dialog open={open} onOpenChange={(o) => setDialog(o ? 'templates' : null)}>
      <DialogContent className="sm:max-w-2xl">{open && <TemplatesBody />}</DialogContent>
    </Dialog>
  )
}

function TemplatesBody() {
  const { t } = useTranslation()
  const project = useAppStore((s) => s.project)
  const language = useAppStore((s) => s.language)
  const toast = useAppStore((s) => s.toast)
  const [templates, setTemplates] = useState<TemplateInfo[]>([])
  const [ejecting, setEjecting] = useState<TemplateInfo | null>(null)
  const [ejectName, setEjectName] = useState('')
  const [deleting, setDeleting] = useState<TemplateInfo | null>(null)
  const canManage = Boolean(project?.specsExists)
  const templatesPath = 'specs/.templates/'

  const load = useCallback(() => void api.templates.list(language).then(setTemplates), [language])
  useEffect(load, [load])

  const eject = async (): Promise<void> => {
    if (!ejecting) return
    try {
      await api.templates.eject(ejecting.id, ejectName, language)
      toast(t('templates.customized', { path: `${templatesPath}${ejectName}/` }), 'success')
      setEjecting(null)
      load()
    } catch (err) {
      toast(describeError(err), 'error')
    }
  }

  const remove = async (): Promise<void> => {
    if (!deleting) return
    try {
      await api.templates.remove(deleting.id)
      toast(t('templates.deleted'), 'success')
      load()
    } catch (err) {
      toast(describeError(err), 'error')
    } finally {
      setDeleting(null)
    }
  }

  const existingNames = templates.filter((x) => x.source === 'local').map((x) => x.name.toLowerCase())
  const ejectValid = TEMPLATE_NAME_RE.test(ejectName) && !existingNames.includes(ejectName.toLowerCase())

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('templates.title')}</DialogTitle>
        <DialogDescription>{t('templates.description', { path: templatesPath })}</DialogDescription>
      </DialogHeader>

      <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
        {templates.map((tpl) => {
          const missing = SPEC_FILE_KINDS.filter((k) => !tpl.files[k])
          return (
            <li key={tpl.id} className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <LayoutTemplateIcon className="size-4 text-muted-foreground" />
                <span className="font-medium">{tpl.name}</span>
                <Badge variant={tpl.source === 'builtin' ? 'secondary' : 'outline'}>
                  {t(tpl.source === 'builtin' ? 'templates.builtin' : 'templates.local')}
                </Badge>
                {missing.length > 0 && (
                  <span className="text-xs text-warning">
                    {t('templates.missingFiles', { files: missing.map((k) => `${k}.template.md`).join(', ') })}
                  </span>
                )}
                <div className="ml-auto flex gap-1">
                  {tpl.source === 'builtin' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canManage}
                      onClick={() => {
                        setEjecting(tpl)
                        setEjectName(existingNames.includes(tpl.name) ? `${tpl.name}-custom` : tpl.name)
                      }}
                    >
                      <CopyIcon /> {t('templates.customize')}
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleting(tpl)}>
                      <Trash2Icon /> {t('common.delete')}
                    </Button>
                  )}
                </div>
              </div>
              {tpl.description && <p className="text-xs text-muted-foreground">{tpl.description}</p>}
              {ejecting?.id === tpl.id && (
                <form
                  className="flex items-center gap-2 rounded-md bg-muted/50 p-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (ejectValid) void eject()
                  }}
                >
                  <span className="font-mono text-xs text-muted-foreground">{templatesPath}</span>
                  <Input
                    autoFocus
                    value={ejectName}
                    aria-label={t('templates.customizeName')}
                    aria-invalid={!ejectValid}
                    className="h-8 flex-1 font-mono text-xs"
                    onChange={(e) => setEjectName(e.target.value)}
                  />
                  <Button size="sm" type="submit" disabled={!ejectValid}>
                    {t('common.create')}
                  </Button>
                  <Button size="sm" variant="ghost" type="button" onClick={() => setEjecting(null)}>
                    {t('common.cancel')}
                  </Button>
                </form>
              )}
            </li>
          )
        })}
      </ul>

      <div className="flex items-center justify-between gap-4 border-t pt-3 text-xs text-muted-foreground">
        <span>
          {canManage ? (
            <>
              {t('templates.placeholders')}{' '}
              {PLACEHOLDERS.map((p) => (
                <code key={p} className="mr-1 rounded bg-muted px-1 font-mono">{p}</code>
              ))}
            </>
          ) : (
            t('templates.noProject')
          )}
        </span>
        {canManage && existingNames.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void api.project.reveal({ templates: true }).catch((e) => toast(describeError(e), 'error'))}
          >
            <FolderOpenIcon /> {t('templates.openFolder')}
          </Button>
        )}
      </div>

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>{t('templates.deleteConfirm', { name: deleting?.name ?? '' })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('templates.deleteDescription', { path: `${templatesPath}${deleting?.name ?? ''}/` })}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>{t('common.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
