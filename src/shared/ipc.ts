import type {
  AppInfo,
  CreateSpecInput,
  Language,
  ProjectState,
  Settings,
  SpecFile,
  SpecFileKind,
  SpecStatus,
  SpecSummary,
  TemplateInfo,
  WriteResult,
  WriteSpecFileInput
} from './types'

/**
 * Single source of truth for every IPC channel: name → [args, result].
 * Both `ipcMain.handle` registrations and the preload bridge are typed from it.
 */
export interface IpcContract {
  'app:info': [[], AppInfo]
  'settings:get': [[], Settings]
  'settings:update': [[patch: Partial<Settings>], Settings]
  'recents:remove': [[path: string], Settings]
  'project:pick': [[], string | null]
  'project:open': [[path: string], ProjectState]
  'project:close': [[], void]
  'project:state': [[], ProjectState]
  'project:initSpecs': [[], ProjectState]
  'project:reveal': [[target: { slug?: string; templates?: boolean }], void]
  'spec:read': [[slug: string, kind: SpecFileKind], SpecFile]
  'spec:write': [[input: WriteSpecFileInput], WriteResult]
  'spec:setStatus': [[slug: string, status: SpecStatus], void]
  'spec:create': [[input: CreateSpecInput], SpecSummary]
  'templates:list': [[language: Language], TemplateInfo[]]
  'templates:eject': [[builtinId: string, name: string, language: Language], void]
  'templates:delete': [[templateId: string], void]
  'clipboard:write': [[text: string], void]
}

export type IpcChannel = keyof IpcContract
export type IpcArgs<C extends IpcChannel> = IpcContract[C][0]
export type IpcReturn<C extends IpcChannel> = IpcContract[C][1]

/** Channel used for main → renderer file-system notifications. */
export const FS_EVENT_CHANNEL = 'fs:event'
