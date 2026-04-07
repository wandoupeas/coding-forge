# 专利附图 Mermaid 源文件

本目录保存《一种面向编码智能体的仓库内状态持久化与恢复方法》专利交底书附图的 Mermaid 源码。

## 文件对应关系

- `figure1.mmd`：整体系统架构示意图
- `figure2.mmd`：状态契约目录结构示意图
- `figure3.mmd`：就绪任务运行时主循环流程图
- `figure4.mmd`：执行上下文组装示意图
- `figure5.mmd`：恢复流程示意图
- `figure6.mmd`：旁路回写与学习闭环示意图

## 推荐渲染方式

本次交付使用仓库内脚本配合 Mermaid 渲染图片，并额外将图片统一适配为交底书现有占位框所用的 `1400x900` 白底画布。渲染依赖默认从 `/tmp/webforge-mermaid-render/node_modules` 读取，可通过环境变量覆盖。示例命令如下：

```bash
MERMAID_RENDERER_ROOT=/tmp/webforge-mermaid-render/node_modules \
node scripts/render-patent-mermaid-figures.mjs

python scripts/fit-patent-figure-canvas.py
```

第一个脚本会将 `docs/patent/mermaid/figure*.mmd` 渲染到 `/tmp/webforge_patent_mermaid_figs/`。第二个脚本会将结果适配到 `/tmp/webforge_patent_mermaid_figs_canvas/`，供 docx 替换使用。

## 风格说明

- 采用黑白、方框、箭头的专利附图风格
- 图面表达以结构关系和步骤顺序为主
- 节点命名优先保持与交底书正文中的图号说明一致
- 由于当前环境优先采用无浏览器渲染链路，`puppeteer-config.json` 仅作为 Mermaid CLI 备用配置保留
- `fit-patent-figure-canvas.py` 用于适配 Word 文档固定占位比例，避免图片替换后被拉伸变形
