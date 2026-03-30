/**
 * 测试工具模块
 */

import { Task, Phase, Message, TaskStatus, PhaseStatus, MessageType } from '../types/index.js';

/**
 * 创建模拟任务
 */
export function createMockTask(overrides?: Partial<Task>): Task {
  return {
    id: 'T001',
    phase: 'P1',
    title: '测试任务',
    status: 'pending' as TaskStatus,
    assignee: 'backend',
    depends_on: [],
    priority: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  };
}

/**
 * 创建模拟阶段
 */
export function createMockPhase(overrides?: Partial<Phase>): Phase {
  return {
    id: 'P1',
    name: '测试阶段',
    status: 'pending' as PhaseStatus,
    progress: 0,
    depends_on: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  };
}

/**
 * 创建模拟消息
 */
export function createMockMessage(overrides?: Partial<Message>): Message {
  return {
    id: 'msg-001',
    from: 'pm',
    to: 'backend',
    type: 'task_assign' as MessageType,
    content: '测试消息',
    timestamp: new Date().toISOString(),
    read: false,
    ...overrides
  };
}

/**
 * 测试用邮箱目录路径
 */
export const mockMailboxDir = '.webforge/test-mailboxes';
