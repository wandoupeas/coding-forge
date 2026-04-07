# Patent Disclosure Chapters 4-6 Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite chapters 4, 5, and 6 of the patent disclosure document into a more professional patent style, using text-only figure descriptions for now and removing embedded figures from the current draft.

**Architecture:** Keep the existing disclosure document as the formatting source of truth, replace only the target paragraphs in `word/document.xml`, and preserve the rest of the template unchanged. Generate the revised output from a repeatable script so later figure reinsertion can reuse the same workflow.

**Tech Stack:** Python standard library zip/XML processing, DOCX package structure, WebForge task/session tracking

---

### Task 1: Finalize rewrite content

**Files:**
- Create: `docs/superpowers/specs/2026-04-07-patent-disclosure-chapters-4-6-rewrite-design.md`
- Modify: patent rewrite script content payload

- [ ] Confirm the rewrite scope stays limited to chapters 4, 5, and 6.
- [ ] Draft the new chapter 4 text around state contract, runtime loop, context assembly, recovery, writeback, learning, and observation.
- [ ] Draft the new chapter 5 embodiments with stepwise processing and technical effects.
- [ ] Draft the new chapter 6 text so each figure is described clearly without embedding images.

### Task 2: Implement repeatable docx rewrite

**Files:**
- Create: `scripts/rewrite-patent-disclosure-chapters.py`
- Update runtime artifact: `/tmp/WebForge_专利交底书_Mermaid版.docx`

- [ ] Read the existing `.docx` package and locate the chapter 4 to chapter 6 paragraph range.
- [ ] Replace the target paragraph sequence with newly generated text paragraphs while preserving surrounding document structure.
- [ ] Remove image paragraphs in chapter 6 so the current output becomes text-only.
- [ ] Write the updated package back to the working `.docx` path.

### Task 3: Verify and publish the revised document

**Files:**
- Verify: `/tmp/WebForge_专利交底书_Mermaid版.docx`
- Update output artifact: `/mnt/e/专利/一种面向编码智能体的仓库内状态持久化与恢复方法-专利交底书-Mermaid版.docx`

- [ ] Extract the updated document XML and confirm the new chapter text exists.
- [ ] Confirm no drawing paragraphs remain in chapter 6.
- [ ] Copy the revised document to the patent output directory.

### Task 4: Record completion

**Files:**
- Update via CLI: `.webforge/` state

- [ ] Record the rewritten disclosure document as a deliverable through WebForge.
- [ ] Mark `T014` completed after verification succeeds.
- [ ] Save a snapshot so the next session can resume from the finished state.
