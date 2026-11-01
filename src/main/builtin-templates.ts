import type { Language, SpecFileKind } from '@shared/types'

/**
 * Built-in templates shipped with the app. Placeholders:
 *   {{module}} {{title}} {{date}} {{requirements}}
 * Frontmatter is injected by the generator, so templates contain only the body.
 */
export interface BuiltinTemplate {
  name: string
  description: Record<Language, string>
  files: Record<Language, Record<SpecFileKind, string>>
}

const standard: BuiltinTemplate = {
  name: 'standard',
  description: {
    en: 'Full SDD trio: user stories with acceptance criteria, architecture and phased tasks.',
    'pt-BR': 'Trinca SDD completa: histórias com critérios de aceite, arquitetura e tarefas por fase.',
    es: 'Trío SDD completo: historias con criterios de aceptación, arquitectura y tareas por fase.'
  },
  files: {
    en: {
      requirements: `# {{title}} — Requirements

## Overview
Describe the problem this module solves, who it serves and why it matters.

## Initial requirements
{{requirements}}

## User stories
- **As a** <role>, **I want** <capability>, **so that** <benefit>.

## Acceptance criteria
- WHEN <event> THEN the system SHALL <behavior>.
- IF <precondition> THEN the system SHALL <behavior>.

## Non-functional requirements
- Performance:
- Security:
- Accessibility:

## Out of scope
-
`,
      design: `# {{title}} — Technical Design

## Context
High-level summary of the solution for \`{{module}}\`.

## Architecture
Describe components, boundaries and data flow.

## Architectural rules
> [!IMPORTANT]
> Rules every implementation of this module must follow (patterns, layers, naming, forbidden dependencies).

-

## Data model
\`\`\`ts
// Types, schemas or entities
\`\`\`

## Interfaces / API
-

## Error handling
-

## Testing strategy
-
`,
      tasks: `# {{title}} — Tasks

## Phase 1 — Foundation
- [ ] Set up the module structure for \`{{module}}\`
- [ ] Define data types and contracts

## Phase 2 — Implementation
- [ ] Implement the core behavior
- [ ] Handle errors and edge cases

## Phase 3 — Quality
- [ ] Write automated tests for the acceptance criteria
- [ ] Update documentation
`
    },
    'pt-BR': {
      requirements: `# {{title}} — Requisitos

## Visão geral
Descreva o problema que este módulo resolve, para quem e por que é importante.

## Requisitos iniciais
{{requirements}}

## Histórias de usuário
- **Como** <papel>, **quero** <capacidade>, **para que** <benefício>.

## Critérios de aceite
- QUANDO <evento> ENTÃO o sistema DEVE <comportamento>.
- SE <pré-condição> ENTÃO o sistema DEVE <comportamento>.

## Requisitos não funcionais
- Desempenho:
- Segurança:
- Acessibilidade:

## Fora do escopo
-
`,
      design: `# {{title}} — Design Técnico

## Contexto
Resumo de alto nível da solução para \`{{module}}\`.

## Arquitetura
Descreva componentes, fronteiras e fluxo de dados.

## Regras arquiteturais
> [!IMPORTANT]
> Regras que toda implementação deste módulo deve seguir (padrões, camadas, nomenclatura, dependências proibidas).

-

## Modelo de dados
\`\`\`ts
// Tipos, schemas ou entidades
\`\`\`

## Interfaces / API
-

## Tratamento de erros
-

## Estratégia de testes
-
`,
      tasks: `# {{title}} — Tarefas

## Fase 1 — Fundação
- [ ] Criar a estrutura do módulo \`{{module}}\`
- [ ] Definir tipos de dados e contratos

## Fase 2 — Implementação
- [ ] Implementar o comportamento principal
- [ ] Tratar erros e casos de borda

## Fase 3 — Qualidade
- [ ] Escrever testes automatizados para os critérios de aceite
- [ ] Atualizar a documentação
`
    },
    es: {
      requirements: `# {{title}} — Requisitos

## Visión general
Describe el problema que resuelve este módulo, a quién sirve y por qué importa.

## Requisitos iniciales
{{requirements}}

## Historias de usuario
- **Como** <rol>, **quiero** <capacidad>, **para** <beneficio>.

## Criterios de aceptación
- CUANDO <evento> ENTONCES el sistema DEBE <comportamiento>.
- SI <precondición> ENTONCES el sistema DEBE <comportamiento>.

## Requisitos no funcionales
- Rendimiento:
- Seguridad:
- Accesibilidad:

## Fuera de alcance
-
`,
      design: `# {{title}} — Diseño Técnico

## Contexto
Resumen de alto nivel de la solución para \`{{module}}\`.

## Arquitectura
Describe componentes, límites y flujo de datos.

## Reglas arquitectónicas
> [!IMPORTANT]
> Reglas que toda implementación de este módulo debe seguir (patrones, capas, nombres, dependencias prohibidas).

-

## Modelo de datos
\`\`\`ts
// Tipos, esquemas o entidades
\`\`\`

## Interfaces / API
-

## Manejo de errores
-

## Estrategia de pruebas
-
`,
      tasks: `# {{title}} — Tareas

## Fase 1 — Fundación
- [ ] Crear la estructura del módulo \`{{module}}\`
- [ ] Definir tipos de datos y contratos

## Fase 2 — Implementación
- [ ] Implementar el comportamiento principal
- [ ] Manejar errores y casos límite

## Fase 3 — Calidad
- [ ] Escribir pruebas automatizadas para los criterios de aceptación
- [ ] Actualizar la documentación
`
    }
  }
}

const minimal: BuiltinTemplate = {
  name: 'minimal',
  description: {
    en: 'Lightweight skeleton for small features and quick iterations.',
    'pt-BR': 'Esqueleto enxuto para funcionalidades pequenas e iterações rápidas.',
    es: 'Esqueleto ligero para funcionalidades pequeñas e iteraciones rápidas.'
  },
  files: {
    en: {
      requirements: `# {{title}}\n\n## Goal\n\n## Requirements\n{{requirements}}\n`,
      design: `# {{title}} — Design\n\n## Approach\n\n## Rules\n-\n`,
      tasks: `# {{title}} — Tasks\n\n- [ ] Implement \`{{module}}\`\n- [ ] Add tests\n`
    },
    'pt-BR': {
      requirements: `# {{title}}\n\n## Objetivo\n\n## Requisitos\n{{requirements}}\n`,
      design: `# {{title}} — Design\n\n## Abordagem\n\n## Regras\n-\n`,
      tasks: `# {{title}} — Tarefas\n\n- [ ] Implementar \`{{module}}\`\n- [ ] Adicionar testes\n`
    },
    es: {
      requirements: `# {{title}}\n\n## Objetivo\n\n## Requisitos\n{{requirements}}\n`,
      design: `# {{title}} — Diseño\n\n## Enfoque\n\n## Reglas\n-\n`,
      tasks: `# {{title}} — Tareas\n\n- [ ] Implementar \`{{module}}\`\n- [ ] Agregar pruebas\n`
    }
  }
}

export const BUILTIN_TEMPLATES: readonly BuiltinTemplate[] = [standard, minimal]

/** Fallback body when a local template omits one of the three files. */
export const EMPTY_FILE_BODIES: Record<SpecFileKind, string> = {
  requirements: '# {{title}}\n\n{{requirements}}\n',
  design: '# {{title}} — Design\n',
  tasks: '# {{title}} — Tasks\n\n- [ ] \n'
}

export interface TemplateVars {
  module: string
  title: string
  date: string
  requirements: string[]
}

/** Replaces `{{placeholders}}`. Unknown placeholders are left untouched. */
export function renderTemplate(source: string, vars: TemplateVars): string {
  const reqList =
    vars.requirements.length > 0 ? vars.requirements.map((r) => `- ${r}`).join('\n') : '-'
  const values: Record<string, string> = {
    module: vars.module,
    title: vars.title,
    date: vars.date,
    requirements: reqList
  }
  return source.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, key: string) => values[key] ?? whole)
}
