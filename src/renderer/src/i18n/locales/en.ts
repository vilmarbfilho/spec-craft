const en = {
  app: { name: 'SpecCraft', tagline: 'Spec-Driven Development for AI-accelerated projects' },
  common: {
    cancel: 'Cancel',
    close: 'Close',
    create: 'Create',
    save: 'Save',
    delete: 'Delete',
    retry: 'Retry',
    loading: 'Loading…',
    open: 'Open',
    remove: 'Remove',
    optional: 'optional'
  },
  status: { draft: 'Draft', 'in-progress': 'In Progress', completed: 'Done' },
  files: { requirements: 'Requirements', design: 'Design', tasks: 'Tasks' },
  welcome: {
    title: 'Open a project to get started',
    description: 'Pick a local repository. SpecCraft reads and writes the specs/ folder — everything stays on your machine.',
    openFolder: 'Open project folder',
    recents: 'Recent projects',
    noRecents: 'No recent projects yet.',
    offline: '100% offline · no telemetry · no API keys'
  },
  sidebar: {
    openProject: 'Open project…',
    recents: 'Recent',
    closeProject: 'Close project',
    revealSpecs: 'Show specs/ in file manager',
    newSpec: 'New Spec',
    noSpecs: 'No specs yet.',
    tasksProgress: '{{done}}/{{total}} tasks',
    noTasks: 'No tasks',
    settings: 'Settings',
    templates: 'Templates',
    filter: 'Filter specs…'
  },
  specsMissing: {
    title: 'No specs/ folder in this project',
    description: 'SpecCraft stores modules in {{path}}. Create the folder to start writing specs.',
    action: 'Initialize specs/'
  },
  workspace: {
    empty: 'Select a spec in the sidebar or create a new one.',
    emptyNoSpecs: 'Create your first spec to describe what the AI should build.',
    exportPrompt: 'Export prompt for AI',
    reveal: 'Show in file manager',
    status: 'Status',
    version: 'v{{version}}',
    updated: 'Updated {{date}}',
    moduleRemoved: 'The module "{{slug}}" was removed or renamed outside SpecCraft.'
  },
  editor: {
    saving: 'Saving…',
    saved: 'Saved',
    unsaved: 'Unsaved changes',
    saveError: 'Save failed',
    placeholder: 'Start writing… Markdown shortcuts work (#, -, [ ], ```).',
    missingTitle: '{{file}} does not exist',
    missingDescription: 'This file is missing from the module (it may have been deleted or renamed externally).',
    createFile: 'Create {{file}}',
    conflictTitle: 'This file changed on disk',
    conflictDescription: 'Another program modified it while you had unsaved changes.',
    reloadFromDisk: 'Reload from disk',
    keepMine: 'Keep my version',
    removedTitle: 'This file was deleted on disk',
    removedDescription: 'Your content is still here. Restore it to recreate the file.',
    restore: 'Restore file',
    reloaded: 'Reloaded {{file}} after an external change',
    toolbar: {
      undo: 'Undo',
      redo: 'Redo',
      bold: 'Bold',
      italic: 'Italic',
      strike: 'Strikethrough',
      code: 'Inline code',
      h1: 'Heading 1',
      h2: 'Heading 2',
      h3: 'Heading 3',
      bulletList: 'Bullet list',
      orderedList: 'Numbered list',
      taskList: 'Checklist',
      codeBlock: 'Code block',
      quote: 'Quote',
      callout: 'Callout (> [!NOTE])'
    }
  },
  wizard: {
    title: 'New Spec',
    description: 'Creates specs/<module>/ with requirements.md, design.md and tasks.md.',
    moduleName: 'Module name',
    moduleHint: 'Folder name: lowercase letters, numbers and hyphens.',
    titleLabel: 'Title / short description',
    titlePlaceholder: 'e.g. User management and roles',
    template: 'Template',
    builtin: 'Built-in',
    local: 'Project',
    requirements: 'Initial requirements',
    requirementPlaceholder: 'e.g. Users can reset their password by email',
    addRequirement: 'Add requirement',
    removeRequirement: 'Remove requirement',
    create: 'Create spec',
    creating: 'Creating…',
    created: 'Spec "{{title}}" created',
    pathPreview: 'Will create {{path}}',
    errors: {
      required: 'Module name is required.',
      tooShort: 'Use at least 2 characters.',
      tooLong: 'Use at most 64 characters.',
      invalidChars: 'Only lowercase letters, numbers and single hyphens (no leading/trailing hyphen).',
      reserved: 'This name is reserved by the operating system.',
      exists: 'A module with this name already exists.',
      titleRequired: 'Title is required.'
    }
  },
  export: {
    title: 'Export prompt for AI',
    description: 'Build a focused prompt with the module context and an exact set of tasks.',
    nextTask: 'Next pending task',
    allPending: 'All pending in module',
    clear: 'Clear selection',
    includeRequirements: 'Include requirements.md',
    includeDesign: 'Include design.md',
    tasks: 'Tasks',
    selectedCount: '{{count}} selected',
    noTasks: 'tasks.md has no checklist items yet.',
    allDone: 'All tasks are completed 🎉',
    showCompleted: 'Show completed',
    preview: 'Prompt preview',
    selectSomething: 'Select at least one task to generate the prompt.',
    copy: 'Copy to clipboard',
    copied: 'Copied!',
    stats: '{{chars}} characters · ~{{tokens}} tokens',
    recommended: 'recommended'
  },
  prompt: {
    heading: 'Implement: {title} (`{slug}`)',
    intro:
      'You are an AI coding agent working in this repository with Spec-Driven Development. The specification below is the source of truth: follow it precisely, respect the architectural rules and do not implement anything outside the requested scope.',
    contextHeading: 'Module context',
    moduleLine: '- **Module:** `{slug}`\n- **Title:** {title}\n- **Status:** {status}',
    requirementsHeading: 'Requirements — `{path}`',
    designHeading: 'Design & architectural rules — `{path}`',
    rulesHint: 'Treat every rule and decision in this design as a hard constraint.',
    tasksHeading: 'Tasks to implement (exact scope)',
    tasksIntro: 'Implement ONLY the tasks below, in order. Line numbers refer to `tasks.md`.',
    lineLabel: 'tasks.md line {line}',
    sectionLabel: 'Section',
    completionHeading: 'Completion protocol (mandatory)',
    completionRules: [
      'After finishing and verifying each task, open `{path}` and change that exact task from `- [ ]` to `- [x]`.',
      'Mark ONLY the tasks you fully completed. Never check tasks outside this list.',
      'Do not reword, reorder or delete any other content of `{path}`; keep the YAML frontmatter intact.',
      'If a task cannot be completed, leave it unchecked and explain the blocker in your final answer.',
      'Finish with a short summary of what changed and which checkboxes were marked.'
    ],
    emptyDocument: '(empty)'
  },
  settings: {
    title: 'Settings',
    language: 'Language',
    languageSystem: 'System default',
    theme: 'Theme',
    themeSystem: 'System',
    themeLight: 'Light',
    themeDark: 'Dark',
    about: 'Version {{version}} · works fully offline'
  },
  templates: {
    title: 'Templates',
    description: 'Built-in templates ship with the app. Project templates live in {{path}} and can be versioned with your repo.',
    builtin: 'Built-in',
    local: 'Project',
    customize: 'Customize',
    customizeTitle: 'Copy "{{name}}" into the project',
    customizeName: 'New template name',
    customized: 'Template copied to {{path}}',
    openFolder: 'Open templates folder',
    deleteConfirm: 'Delete template "{{name}}"?',
    deleteDescription: 'This removes the folder {{path}} from disk.',
    deleted: 'Template deleted',
    noProject: 'Open a project with a specs/ folder to manage project templates.',
    placeholders: 'Available placeholders:',
    missingFiles: 'missing: {{files}}'
  },
  errors: {
    NO_PROJECT: 'No project is open.',
    SPECS_MISSING: 'The specs/ folder does not exist.',
    INVALID_SLUG: 'Invalid name.',
    MODULE_EXISTS: 'That name already exists.',
    NOT_FOUND: 'Not found on disk.',
    CONFLICT: 'The file changed on disk.',
    INVALID_TEMPLATE: 'Invalid template.',
    INVALID_PATH: 'Invalid path.',
    IO: 'Disk operation failed: {{message}}',
    openProject: 'Could not open the project: {{message}}'
  }
}

export default en

type DeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : T[K] extends readonly string[] ? string[] : DeepStringify<T[K]>
}
export type Messages = DeepStringify<typeof en>
