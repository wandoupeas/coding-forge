# Patent Mermaid Figures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the patent disclosure document's six figures with Mermaid-generated figures and preserve the Mermaid source files for regeneration.

**Architecture:** Keep Mermaid source-of-truth files under `docs/patent/mermaid/`, render images through a repeatable CLI flow, then swap the embedded docx media assets with the rendered images. The document body stays stable while the figure assets become reproducible.

**Tech Stack:** Mermaid, Node.js CLI tooling, Python zip/XML docx patching, WebForge task/session tracking

---

### Task 1: Create Mermaid source files

**Files:**
- Create: `docs/patent/mermaid/README.md`
- Create: `docs/patent/mermaid/figure1.mmd`
- Create: `docs/patent/mermaid/figure2.mmd`
- Create: `docs/patent/mermaid/figure3.mmd`
- Create: `docs/patent/mermaid/figure4.mmd`
- Create: `docs/patent/mermaid/figure5.mmd`
- Create: `docs/patent/mermaid/figure6.mmd`

- [ ] Draft six Mermaid diagrams using restrained patent-style flowchart syntax.
- [ ] Keep node count and labels controlled so the output stays readable in Word.
- [ ] Document what each figure represents and how to rerender it.

### Task 2: Render Mermaid diagrams into document-ready images

**Files:**
- Use: `docs/patent/mermaid/*.mmd`
- Generate: `/tmp/webforge_patent_mermaid_figs/figure1.png`
- Generate: `/tmp/webforge_patent_mermaid_figs/figure2.png`
- Generate: `/tmp/webforge_patent_mermaid_figs/figure3.png`
- Generate: `/tmp/webforge_patent_mermaid_figs/figure4.png`
- Generate: `/tmp/webforge_patent_mermaid_figs/figure5.png`
- Generate: `/tmp/webforge_patent_mermaid_figs/figure6.png`

- [ ] Install or invoke Mermaid rendering tooling in an isolated temp location.
- [ ] Render each `.mmd` file with consistent theme and background settings.
- [ ] Verify that all six image files are produced successfully.

### Task 3: Replace images inside the patent docx

**Files:**
- Update runtime artifact: `/tmp/WebForge_专利交底书.docx`
- Update output artifact: `/mnt/e/专利/一种面向编码智能体的仓库内状态持久化与恢复方法-专利交底书.docx`

- [ ] Replace the existing figure images in the working docx with Mermaid-rendered images.
- [ ] Validate the zip package contains the expected media files and drawing nodes.
- [ ] Copy the updated document to the patent output path.

### Task 4: Record completion

**Files:**
- Update via CLI: `.webforge/` state

- [ ] Record session progress and deliverable through WebForge CLI.
- [ ] Mark `T013` completed.
- [ ] Pause the session with a summary so the next restore sees the finished state.
