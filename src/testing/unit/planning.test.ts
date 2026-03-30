import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createWorkspace } from '../../core/workspace.js';
import {
  buildExecutionContext,
  buildPlanFromKnowledge
} from '../../core/planning.js';

describe('planning core', () => {
  let workspaceDir = '';

  afterEach(async () => {
    if (workspaceDir) {
      await rm(workspaceDir, { recursive: true, force: true });
      workspaceDir = '';
    }
  });

  it('builds phases and tasks from workspace knowledge and writes them back', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-planning-'));
    const state = await createWorkspace(workspaceDir, { projectName: 'planning-core' });

    await writeFile(
      join(state.paths.knowledgeRequirements, 'prd.md'),
      [
        '# 物业绩效管理系统',
        '',
        '需要 Vue 3 前端、Node.js API、PostgreSQL 数据库。',
        '系统包含用户权限、数据报表和管理后台。'
      ].join('\n'),
      'utf-8'
    );
    await writeFile(
      join(state.paths.knowledgeRequirements, 'ignored.md'),
      '# 不应进入规划\n\n这个文件没有进入 knowledge index。',
      'utf-8'
    );
    await writeFile(
      state.paths.knowledgeIndex,
      JSON.stringify(
        [
          {
            id: 'knowledge-requirements-prd-md',
            type: 'requirement',
            title: 'prd',
            path: '.webforge/knowledge/requirements/prd.md',
            createdAt: '2026-03-30T00:00:00.000Z',
            updatedAt: '2026-03-30T00:00:00.000Z'
          }
        ],
        null,
        2
      ),
      'utf-8'
    );

    const result = await buildPlanFromKnowledge(workspaceDir, {
      template: 'auto',
      force: true,
      superpowers: true,
      execution: 'inline'
    });

    expect(result.phases.length).toBeGreaterThan(0);
    expect(result.tasks.length).toBeGreaterThan(0);
    expect(result.analysis.documents).toContain('requirements/prd.md');
    expect(result.analysis.documents).not.toContain('requirements/ignored.md');
    expect(result.tasks.some((task) => task.status === 'ready')).toBe(true);
    expect(result.requiredSkills).toContain('frontend-design');
    expect(result.requiredSkills).toContain('backend-patterns');

    const savedPhases = JSON.parse(await readFile(state.paths.phases, 'utf-8')) as {
      phases: Array<{ id: string }>;
    };
    const savedTasks = JSON.parse(await readFile(state.paths.tasks, 'utf-8')) as {
      tasks: Array<{ id: string; phase: string }>;
    };

    expect(savedPhases.phases).toHaveLength(result.phases.length);
    expect(savedTasks.tasks).toHaveLength(result.tasks.length);
    expect(savedTasks.tasks[0]?.id).toBe(result.tasks[0]?.id);
  });

  it('keeps parsed fallbacks distinct when different categories share the same basename', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-parsed-map-'));
    const state = await createWorkspace(workspaceDir, { projectName: 'parsed-map' });

    await writeFile(
      join(state.paths.knowledgeParsed, 'requirements--spec.md'),
      '# requirements spec\n\nVue 3 frontend。',
      'utf-8'
    );
    await writeFile(
      join(state.paths.knowledgeParsed, 'design--spec.md'),
      '# design spec\n\nGo backend。',
      'utf-8'
    );
    await writeFile(
      state.paths.knowledgeIndex,
      JSON.stringify(
        [
          {
            id: 'knowledge-requirements-spec-pdf',
            type: 'requirement',
            title: 'spec',
            path: '.webforge/knowledge/requirements/spec.pdf',
            createdAt: '2026-03-30T00:00:00.000Z',
            updatedAt: '2026-03-30T00:00:00.000Z'
          },
          {
            id: 'knowledge-design-spec-pdf',
            type: 'design',
            title: 'spec',
            path: '.webforge/knowledge/design/spec.pdf',
            createdAt: '2026-03-30T00:00:00.000Z',
            updatedAt: '2026-03-30T00:00:00.000Z'
          },
          {
            id: 'knowledge-parsed-requirements-spec-md',
            type: 'parsed',
            title: 'requirements--spec',
            path: '.webforge/knowledge/parsed/requirements--spec.md',
            createdAt: '2026-03-30T00:00:00.000Z',
            updatedAt: '2026-03-30T00:00:00.000Z'
          },
          {
            id: 'knowledge-parsed-design-spec-md',
            type: 'parsed',
            title: 'design--spec',
            path: '.webforge/knowledge/parsed/design--spec.md',
            createdAt: '2026-03-30T00:00:00.000Z',
            updatedAt: '2026-03-30T00:00:00.000Z'
          }
        ],
        null,
        2
      ),
      'utf-8'
    );

    const result = await buildPlanFromKnowledge(workspaceDir, {
      template: 'auto',
      force: true
    });

    expect(result.analysis.contents['requirements/spec.pdf']).toContain('Vue 3 frontend');
    expect(result.analysis.contents['design/spec.pdf']).toContain('Go backend');
  });

  it('keeps parsed fallbacks distinct when the same category has the same basename but different source formats', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-parsed-ext-'));
    const state = await createWorkspace(workspaceDir, { projectName: 'parsed-ext' });

    await writeFile(
      join(state.paths.knowledgeParsed, 'requirements--spec--pdf.md'),
      '# requirements pdf\n\ncontent from pdf',
      'utf-8'
    );
    await writeFile(
      join(state.paths.knowledgeParsed, 'requirements--spec--docx.md'),
      '# requirements docx\n\ncontent from docx',
      'utf-8'
    );
    await writeFile(
      state.paths.knowledgeIndex,
      JSON.stringify(
        [
          {
            id: 'knowledge-requirements-spec-pdf',
            type: 'requirement',
            title: 'spec',
            path: '.webforge/knowledge/requirements/spec.pdf',
            createdAt: '2026-03-30T00:00:00.000Z',
            updatedAt: '2026-03-30T00:00:00.000Z'
          },
          {
            id: 'knowledge-requirements-spec-docx',
            type: 'requirement',
            title: 'spec',
            path: '.webforge/knowledge/requirements/spec.docx',
            createdAt: '2026-03-30T00:00:00.000Z',
            updatedAt: '2026-03-30T00:00:00.000Z'
          },
          {
            id: 'knowledge-parsed-requirements-spec-pdf-md',
            type: 'parsed',
            title: 'requirements--spec--pdf',
            path: '.webforge/knowledge/parsed/requirements--spec--pdf.md',
            createdAt: '2026-03-30T00:00:00.000Z',
            updatedAt: '2026-03-30T00:00:00.000Z'
          },
          {
            id: 'knowledge-parsed-requirements-spec-docx-md',
            type: 'parsed',
            title: 'requirements--spec--docx',
            path: '.webforge/knowledge/parsed/requirements--spec--docx.md',
            createdAt: '2026-03-30T00:00:00.000Z',
            updatedAt: '2026-03-30T00:00:00.000Z'
          }
        ],
        null,
        2
      ),
      'utf-8'
    );

    const result = await buildPlanFromKnowledge(workspaceDir, {
      template: 'auto',
      force: true
    });

    expect(result.analysis.contents['requirements/spec.pdf']).toContain('content from pdf');
    expect(result.analysis.contents['requirements/spec.docx']).toContain('content from docx');
  });

  it('keeps legacy flat parsed files attached to their unique source document', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-legacy-parsed-'));
    const state = await createWorkspace(workspaceDir, { projectName: 'legacy-parsed' });

    await writeFile(
      join(state.paths.knowledgeParsed, 'spec.md'),
      '# legacy spec\n\nNode.js API。',
      'utf-8'
    );
    await writeFile(
      state.paths.knowledgeIndex,
      JSON.stringify(
        [
          {
            id: 'knowledge-requirements-spec-pdf',
            type: 'requirement',
            title: 'spec',
            path: '.webforge/knowledge/requirements/spec.pdf',
            createdAt: '2026-03-30T00:00:00.000Z',
            updatedAt: '2026-03-30T00:00:00.000Z'
          },
          {
            id: 'knowledge-parsed-spec-md',
            type: 'parsed',
            title: 'spec',
            path: '.webforge/knowledge/parsed/spec.md',
            createdAt: '2026-03-30T00:00:00.000Z',
            updatedAt: '2026-03-30T00:00:00.000Z'
          }
        ],
        null,
        2
      ),
      'utf-8'
    );

    const result = await buildPlanFromKnowledge(workspaceDir, {
      template: 'auto',
      force: true
    });

    expect(result.analysis.contents['requirements/spec.pdf']).toContain('Node.js API');
    expect(result.analysis.documents).not.toContain('parsed/spec.md');
  });

  it('ignores legacy parsed duplicates when a new-format parsed file also exists', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-mixed-parsed-'));
    const state = await createWorkspace(workspaceDir, { projectName: 'mixed-parsed' });

    await writeFile(
      join(state.paths.knowledgeParsed, 'spec.md'),
      '# legacy spec\n\nstale content',
      'utf-8'
    );
    await writeFile(
      join(state.paths.knowledgeParsed, 'requirements--spec.md'),
      '# new spec\n\nfresh content',
      'utf-8'
    );
    await writeFile(
      state.paths.knowledgeIndex,
      JSON.stringify(
        [
          {
            id: 'knowledge-requirements-spec-pdf',
            type: 'requirement',
            title: 'spec',
            path: '.webforge/knowledge/requirements/spec.pdf',
            createdAt: '2026-03-30T00:00:00.000Z',
            updatedAt: '2026-03-30T00:00:00.000Z'
          },
          {
            id: 'knowledge-parsed-spec-md',
            type: 'parsed',
            title: 'spec',
            path: '.webforge/knowledge/parsed/spec.md',
            createdAt: '2026-03-30T00:00:00.000Z',
            updatedAt: '2026-03-30T00:00:00.000Z'
          },
          {
            id: 'knowledge-parsed-requirements-spec-md',
            type: 'parsed',
            title: 'requirements--spec',
            path: '.webforge/knowledge/parsed/requirements--spec.md',
            createdAt: '2026-03-30T00:00:00.000Z',
            updatedAt: '2026-03-30T00:00:00.000Z'
          }
        ],
        null,
        2
      ),
      'utf-8'
    );

    const result = await buildPlanFromKnowledge(workspaceDir, {
      template: 'auto',
      force: true
    });

    expect(result.analysis.contents['requirements/spec.pdf']).toContain('fresh content');
    expect(result.analysis.documents).not.toContain('parsed/spec.md');
  });

  it('reuses an existing plan without resolving or persisting tech stack again', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-plan-reuse-'));
    const state = await createWorkspace(workspaceDir, { projectName: 'plan-reuse' });
    let resolveCalls = 0;

    await writeFile(
      state.paths.knowledgeIndex,
      JSON.stringify(
        [
          {
            id: 'knowledge-requirements-prd-md',
            type: 'requirement',
            title: 'prd',
            path: '.webforge/knowledge/requirements/prd.md',
            createdAt: '2026-03-30T00:00:00.000Z',
            updatedAt: '2026-03-30T00:00:00.000Z'
          }
        ],
        null,
        2
      ),
      'utf-8'
    );
    await writeFile(
      state.paths.phases,
      JSON.stringify(
        {
          phases: [
            {
              id: 'P1',
              name: '需求分析',
              status: 'in_progress',
              progress: 0,
              depends_on: [],
              created_at: '2026-03-30T00:00:00.000Z',
              updated_at: '2026-03-30T00:00:00.000Z'
            }
          ]
        },
        null,
        2
      ),
      'utf-8'
    );
    await writeFile(
      state.paths.tasks,
      JSON.stringify(
        {
          tasks: [
            {
              id: 'T001',
              phase: 'P1',
              title: 'existing plan',
              status: 'ready',
              assignee: 'pm',
              depends_on: [],
              priority: 1,
              created_at: '2026-03-30T00:00:00.000Z',
              updated_at: '2026-03-30T00:00:00.000Z'
            }
          ]
        },
        null,
        2
      ),
      'utf-8'
    );

    const result = await buildPlanFromKnowledge(workspaceDir, {
      force: false,
      resolveTechStack: async () => {
        resolveCalls += 1;
        return {
          backend: 'go-gin',
          frontend: 'react',
          database: 'mysql',
          infrastructure: ['docker']
        };
      }
    });

    expect(result.reusedExistingPlan).toBe(true);
    expect(resolveCalls).toBe(0);
    await expect(
      readFile(join(workspaceDir, '.webforge', 'techstack.json'), 'utf-8')
    ).rejects.toThrow();
  });

  it('builds a normalized execution context for a task', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-context-'));
    const state = await createWorkspace(workspaceDir, { projectName: 'execution-context' });

    await writeFile(
      state.paths.knowledgeIndex,
      JSON.stringify(
        [
          {
            id: 'knowledge-requirements-prd-md',
            type: 'requirement',
            title: 'PRD',
            path: '.webforge/knowledge/requirements/prd.md',
            createdAt: '2026-03-30T00:00:00.000Z',
            updatedAt: '2026-03-30T00:00:00.000Z'
          }
        ],
        null,
        2
      ),
      'utf-8'
    );

    await writeFile(
      state.paths.deliverablesIndex,
      JSON.stringify(
        [
          {
            id: 'del-001',
            taskId: 'T001',
            type: 'document',
            title: 'Architecture',
            path: '.webforge/deliverables/del-001.md',
            createdBy: 'tech-lead',
            createdAt: '2026-03-30T00:00:00.000Z',
            status: 'approved'
          }
        ],
        null,
        2
      ),
      'utf-8'
    );

    await writeFile(
      state.paths.sessionsIndex,
      JSON.stringify(
        [
          {
            id: 'sess-001',
            name: 'planning',
            createdAt: '2026-03-30T00:00:00.000Z',
            lastActive: '2026-03-30T01:00:00.000Z',
            status: 'active',
            currentPhase: 'P1',
            currentTask: 'T001',
            context: 'continue task',
            stats: {
              tasksCompleted: 0,
              totalTasks: 1
            }
          }
        ],
        null,
        2
      ),
      'utf-8'
    );

    await writeFile(
      state.paths.phases,
      JSON.stringify(
        {
          phases: [
            {
              id: 'P1',
              name: '需求分析',
              status: 'in_progress',
              progress: 50,
              depends_on: [],
              created_at: '2026-03-30T00:00:00.000Z',
              updated_at: '2026-03-30T00:00:00.000Z'
            }
          ]
        },
        null,
        2
      ),
      'utf-8'
    );

    await writeFile(
      state.paths.tasks,
      JSON.stringify(
        {
          tasks: [
            {
              id: 'T001',
              phase: 'P1',
              title: '需求梳理',
              status: 'in_progress',
              assignee: 'pm',
              depends_on: [],
              priority: 1,
              created_at: '2026-03-30T00:00:00.000Z',
              updated_at: '2026-03-30T00:00:00.000Z'
            }
          ]
        },
        null,
        2
      ),
      'utf-8'
    );

    const context = await buildExecutionContext(workspaceDir, 'T001');

    expect(context.runtime.version).toBe('0.2');
    expect(context.task.id).toBe('T001');
    expect(context.phase.id).toBe('P1');
    expect(context.knowledge.items).toHaveLength(1);
    expect(context.deliverables.task).toHaveLength(1);
    expect(context.sessions.active?.id).toBe('sess-001');
    expect(context.sessions.items).toHaveLength(1);
    expect(context.permissions.profile).toBe('workspace-write');
    expect(context.observation.counts.knowledgeItems).toBe(1);
    expect(context.superpowers.enabled).toBe(false);
  });

  it('does not attach unrelated active sessions to the task execution context', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-context-unrelated-'));
    const state = await createWorkspace(workspaceDir, { projectName: 'execution-context' });

    await writeFile(
      state.paths.phases,
      JSON.stringify(
        {
          phases: [
            {
              id: 'P1',
              name: '需求分析',
              status: 'in_progress',
              progress: 50,
              depends_on: [],
              created_at: '2026-03-30T00:00:00.000Z',
              updated_at: '2026-03-30T00:00:00.000Z'
            }
          ]
        },
        null,
        2
      ),
      'utf-8'
    );
    await writeFile(
      state.paths.tasks,
      JSON.stringify(
        {
          tasks: [
            {
              id: 'T001',
              phase: 'P1',
              title: '需求梳理',
              status: 'in_progress',
              assignee: 'pm',
              depends_on: [],
              priority: 1,
              created_at: '2026-03-30T00:00:00.000Z',
              updated_at: '2026-03-30T00:00:00.000Z'
            }
          ]
        },
        null,
        2
      ),
      'utf-8'
    );
    await writeFile(
      state.paths.sessionsIndex,
      JSON.stringify(
        [
          {
            id: 'sess-unrelated',
            name: 'other work',
            createdAt: '2026-03-30T00:00:00.000Z',
            lastActive: '2026-03-30T01:00:00.000Z',
            status: 'active',
            currentPhase: 'P9',
            currentTask: 'T999',
            context: 'other task',
            stats: {
              tasksCompleted: 1,
              totalTasks: 3
            }
          }
        ],
        null,
        2
      ),
      'utf-8'
    );

    const context = await buildExecutionContext(workspaceDir, 'T001');
    expect(context.sessions.related).toHaveLength(0);
    expect(context.sessions.active).toBeNull();
  });

  it('does not treat another task session in the same phase as the active task session', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-context-phase-'));
    const state = await createWorkspace(workspaceDir, { projectName: 'execution-context' });

    await writeFile(
      state.paths.phases,
      JSON.stringify(
        {
          phases: [
            {
              id: 'P1',
              name: '需求分析',
              status: 'in_progress',
              progress: 50,
              depends_on: [],
              created_at: '2026-03-30T00:00:00.000Z',
              updated_at: '2026-03-30T00:00:00.000Z'
            }
          ]
        },
        null,
        2
      ),
      'utf-8'
    );
    await writeFile(
      state.paths.tasks,
      JSON.stringify(
        {
          tasks: [
            {
              id: 'T001',
              phase: 'P1',
              title: '任务一',
              status: 'in_progress',
              assignee: 'pm',
              depends_on: [],
              priority: 1,
              created_at: '2026-03-30T00:00:00.000Z',
              updated_at: '2026-03-30T00:00:00.000Z'
            },
            {
              id: 'T002',
              phase: 'P1',
              title: '任务二',
              status: 'in_progress',
              assignee: 'pm',
              depends_on: [],
              priority: 1,
              created_at: '2026-03-30T00:00:00.000Z',
              updated_at: '2026-03-30T00:00:00.000Z'
            }
          ]
        },
        null,
        2
      ),
      'utf-8'
    );
    await writeFile(
      state.paths.sessionsIndex,
      JSON.stringify(
        [
          {
            id: 'sess-task-1',
            name: 'task 1',
            createdAt: '2026-03-30T00:00:00.000Z',
            lastActive: '2026-03-30T01:00:00.000Z',
            status: 'paused',
            currentPhase: 'P1',
            currentTask: 'T001',
            context: 'task 1 context',
            stats: {
              tasksCompleted: 0,
              totalTasks: 2
            }
          },
          {
            id: 'sess-task-2',
            name: 'task 2',
            createdAt: '2026-03-30T00:00:00.000Z',
            lastActive: '2026-03-30T01:30:00.000Z',
            status: 'active',
            currentPhase: 'P1',
            currentTask: 'T002',
            context: 'task 2 context',
            stats: {
              tasksCompleted: 0,
              totalTasks: 2
            }
          }
        ],
        null,
        2
      ),
      'utf-8'
    );

    const context = await buildExecutionContext(workspaceDir, 'T001');
    expect(context.sessions.related.map((session) => session.id)).toEqual(['sess-task-1']);
    expect(context.sessions.active?.id).toBe('sess-task-1');
  });

  it('picks the most recent related paused session when no related session is active', async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'webforge-context-latest-'));
    const state = await createWorkspace(workspaceDir, { projectName: 'execution-context' });

    await writeFile(
      state.paths.phases,
      JSON.stringify(
        {
          phases: [
            {
              id: 'P1',
              name: '需求分析',
              status: 'in_progress',
              progress: 50,
              depends_on: [],
              created_at: '2026-03-30T00:00:00.000Z',
              updated_at: '2026-03-30T00:00:00.000Z'
            }
          ]
        },
        null,
        2
      ),
      'utf-8'
    );
    await writeFile(
      state.paths.tasks,
      JSON.stringify(
        {
          tasks: [
            {
              id: 'T001',
              phase: 'P1',
              title: '任务一',
              status: 'in_progress',
              assignee: 'pm',
              depends_on: [],
              priority: 1,
              created_at: '2026-03-30T00:00:00.000Z',
              updated_at: '2026-03-30T00:00:00.000Z'
            }
          ]
        },
        null,
        2
      ),
      'utf-8'
    );
    await writeFile(
      state.paths.sessionsIndex,
      JSON.stringify(
        [
          {
            id: 'sess-old',
            name: 'old',
            createdAt: '2026-03-30T00:00:00.000Z',
            lastActive: '2026-03-30T01:00:00.000Z',
            status: 'paused',
            currentPhase: 'P1',
            currentTask: 'T001',
            context: 'old context',
            stats: {
              tasksCompleted: 0,
              totalTasks: 1
            }
          },
          {
            id: 'sess-new',
            name: 'new',
            createdAt: '2026-03-30T00:00:00.000Z',
            lastActive: '2026-03-30T02:00:00.000Z',
            status: 'paused',
            currentPhase: 'P1',
            currentTask: 'T001',
            context: 'new context',
            stats: {
              tasksCompleted: 0,
              totalTasks: 1
            }
          }
        ],
        null,
        2
      ),
      'utf-8'
    );

    const context = await buildExecutionContext(workspaceDir, 'T001');
    expect(context.sessions.active?.id).toBe('sess-new');
  });
});
