# WebForge 项目实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (推荐) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于需求文档完成 Web 项目的开发与交付

**Architecture:** 采用多 Agent 协作模式，PM/Frontend/Backend/QA/DevOps 各司其职，通过任务系统协调工作。

**Tech Stack:** Node.js + TypeScript + NestJS + React 18 + TypeScript + PostgreSQL

**Required Skills:** @frontend-design, @tdd-workflow, @backend-patterns, @golang-patterns


## 技术栈

### 后端
Node.js + TypeScript + NestJS

### 前端
React 18 + TypeScript

### 数据库
PostgreSQL

### 基础设施
- Docker

---

## PRD 文档

- design/2026-03-31-webforge-web-ui-design.md
- requirements/2026-03-31-web-ui-research-terminal-redesign-plan.md

---

## 阶段规划

| 阶段 | 名称 | 任务数 | 状态 |
|------|------|--------|------|
| P1 | 建立 UI DOM 测试支撑并收口主题基线 | 6 | in_progress |
| P2 | 重构首页为 Index + Ledger + Signal Rail | 8 | pending |
| P3 | 统一项目详情骨架与恢复侧栏 | 7 | pending |
| P4 | 重构 Summary / Evidence / Runtime 三个主视图 | 7 | pending |
| P5 | 文档收口与全量验证 | 5 | pending |

---

## 任务详情

### P1: 建立 UI DOM 测试支撑并收口主题基线


#### T001: 为首页结构先写失败测试

**Assignee:** agent  
**Priority:** 2  
**Depends on:** None  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

#### T002: 运行测试，确认当前布局不满足新结构

**Assignee:** agent  
**Priority:** 2  
**Depends on:** T001  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

#### T003: 增加 DOM 测试依赖和渲染辅助

**Assignee:** agent  
**Priority:** 2  
**Depends on:** T002  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

#### T004: 收口主题和 AppFrame

**Assignee:** agent  
**Priority:** 2  
**Depends on:** T003  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

#### T005: 重新运行首页结构测试

**Assignee:** agent  
**Priority:** 2  
**Depends on:** T004  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

#### T006: Commit

**Assignee:** agent  
**Priority:** 2  
**Depends on:** T005  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

---
### P2: 重构首页为 Index + Ledger + Signal Rail


#### T007: 扩展首页测试，先锁定主表和项目索引行为

**Assignee:** agent  
**Priority:** 2  
**Depends on:** None  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

#### T008: 运行测试，确认当前页面仍然是旧卡片结构

**Assignee:** agent  
**Priority:** 2  
**Depends on:** T007  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

#### T009: 实现项目索引面板

**Assignee:** agent  
**Priority:** 2  
**Depends on:** T008  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

#### T010: 实现 Workspace Ledger 主表

**Assignee:** agent  
**Priority:** 2  
**Depends on:** T009  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

#### T011: 实现 Signal Rail

**Assignee:** agent  
**Priority:** 2  
**Depends on:** T010  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

#### T012: 移除首页对 ProjectCard 的依赖

**Assignee:** agent  
**Priority:** 2  
**Depends on:** T011  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

#### T013: 重新运行首页测试

**Assignee:** agent  
**Priority:** 2  
**Depends on:** T012  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

#### T014: Commit

**Assignee:** agent  
**Priority:** 2  
**Depends on:** T013  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

---
### P3: 统一项目详情骨架与恢复侧栏


#### T015: 为详情骨架先写失败测试

**Assignee:** agent  
**Priority:** 2  
**Depends on:** None  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

#### T016: 运行测试，确认当前详情页还没有统一骨架

**Assignee:** agent  
**Priority:** 2  
**Depends on:** T015  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

#### T017: 实现共享 ProjectDetailShell

**Assignee:** agent  
**Priority:** 2  
**Depends on:** T016  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

#### T018: 实现 ProjectRecoveryRail

**Assignee:** agent  
**Priority:** 2  
**Depends on:** T017  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

#### T019: 将三个详情路由统一接到共享骨架

**Assignee:** agent  
**Priority:** 2  
**Depends on:** T018  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

#### T020: 重新运行详情骨架测试

**Assignee:** agent  
**Priority:** 2  
**Depends on:** T019  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

#### T021: Commit

**Assignee:** agent  
**Priority:** 2  
**Depends on:** T020  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

---
### P4: 重构 Summary / Evidence / Runtime 三个主视图


#### T022: 先扩展详情测试，锁定三种视图的关键结构

**Assignee:** agent  
**Priority:** 2  
**Depends on:** None  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

#### T023: 运行测试，确认旧视图结构不满足新布局

**Assignee:** agent  
**Priority:** 2  
**Depends on:** T022  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

#### T024: 重写 Summary 视角

**Assignee:** agent  
**Priority:** 2  
**Depends on:** T023  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

#### T025: 实现 ArtifactBrowser

**Assignee:** agent  
**Priority:** 2  
**Depends on:** T024  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

#### T026: 重写 RuntimeEventsPanel 与 SnapshotComparison

**Assignee:** agent  
**Priority:** 2  
**Depends on:** T025  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

#### T027: 重新运行详情视图测试

**Assignee:** agent  
**Priority:** 2  
**Depends on:** T026  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

#### T028: Commit

**Assignee:** agent  
**Priority:** 2  
**Depends on:** T027  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

---
### P5: 文档收口与全量验证


#### T029: 更新 README 中的 UI 定位

**Assignee:** agent  
**Priority:** 2  
**Depends on:** None  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

#### T030: 更新操作手册和命令参考

**Assignee:** agent  
**Priority:** 2  
**Depends on:** T029  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

#### T031: 运行前端相关测试

**Assignee:** agent  
**Priority:** 2  
**Depends on:** T030  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

#### T032: 运行全量验证

**Assignee:** agent  
**Priority:** 2  
**Depends on:** T031  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员

#### T033: Commit

**Assignee:** agent  
**Priority:** 2  
**Depends on:** T032  
**Required Skills:** N/A

- [ ] **Step 1: 分析任务需求**
  - 阅读相关文档
  - 理解任务目标
  - 识别技术要点

- [ ] **Step 2: 设计与规划**
  - 确定实现方案
  - 识别需要的 skills
  - 估算工作量

- [ ] **Step 3: 实现开发**
  - 编写代码
  - 遵循项目规范
  - 使用正确的 skills

- [ ] **Step 4: 测试验证**
  - 运行测试: `npm test`
  - 预期: PASS

- [ ] **Step 5: 提交交付**
  - 创建交付物
  - 更新任务状态
  - 通知相关人员


---

## Execution Guidelines

### Subagent-Driven Mode (Recommended)

1. 每个任务由一个独立的 subagent 执行
2. 任务完成后进行审查
3. 审查通过后更新任务状态
4. 继续下一个任务

### Skills Usage

执行任务时，根据任务内容选择合适的 skills:

- **@frontend-design**: Create distinctive, production-grade frontend interfaces
- **@tdd-workflow**: Test-driven development with 80%+ coverage
- **@backend-patterns**: Backend architecture patterns, API design, database optimization
- **@golang-patterns**: Idiomatic Go patterns and best practices

### Task State Transitions

```
pending → ready → in_progress → completed
   ↑         ↓         ↓
   └──── blocked ←────┘
```

---

## Generated

- **Date:** 2026-03-31T08:20:47.921Z
- **Execution Mode:** subagent
- **Total Tasks:** 33
- **Total Phases:** 5
