import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const workspaceRoot = process.cwd();
const rendererRoot = process.env.MERMAID_RENDERER_ROOT || '/tmp/webforge-mermaid-render/node_modules';
const mermaidDir = path.join(workspaceRoot, 'docs', 'patent', 'mermaid');
const outputDir = '/tmp/webforge_patent_mermaid_figs';

const importFromRenderer = async (relativePath) =>
  import(pathToFileURL(path.join(rendererRoot, relativePath)).href);

const { JSDOM } = await importFromRenderer('jsdom/lib/api.js');
const requireFromRenderer = createRequire(path.join(rendererRoot, 'index.js'));
const { Resvg } = requireFromRenderer('@resvg/resvg-js');

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  pretendToBeVisual: true,
});

const { window } = dom;
const installGlobal = (key, value) => {
  Object.defineProperty(globalThis, key, {
    value,
    configurable: true,
    writable: true,
  });
};

const estimateBox = function estimateBox() {
  const raw = this.innerHTML || this.textContent || '';
  const normalized = raw.replace(/<br\s*\/?>/gi, '\n').replace(/\s+/g, ' ').trim();
  const lines = normalized ? normalized.split('\n') : [''];
  const width = Math.max(80, ...lines.map((line) => line.length * 9 + 24));
  const height = Math.max(24, lines.length * 22 + 12);
  return { x: 0, y: 0, width, height };
};

const normalizeLabelText = (value) =>
  value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n+/g, '\n')
    .trim();

const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

const estimateLabelSize = (value) => {
  const lines = normalizeLabelText(value).split('\n').filter(Boolean);
  const safeLines = lines.length > 0 ? lines : [''];
  const width = Math.max(96, ...safeLines.map((line) => line.length * 18 + 28));
  const height = Math.max(34, safeLines.length * 26 + 14);
  return { width, height, lines: safeLines };
};

const parseTranslate = (value) => {
  const match = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(value || '');
  if (!match) {
    return { x: 0, y: 0 };
  }

  return {
    x: Number(match[1]),
    y: Number(match[2]),
  };
};

const normalizeSvg = (svg) => {
  const doc = new window.DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;
  const nodes = [...doc.querySelectorAll('g.node')];
  const svgNamespace = 'http://www.w3.org/2000/svg';

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    const { x, y } = parseTranslate(node.getAttribute('transform'));
    const foreignObject = node.querySelector('foreignObject');
    const labelSpan = node.querySelector('foreignObject span, foreignObject div');
    const labelValue = labelSpan?.innerHTML || labelSpan?.textContent || '';
    const { width, height, lines } = estimateLabelSize(labelValue);
    const rect = node.querySelector('rect.label-container');

    if (rect) {
      rect.setAttribute('x', String(-width / 2));
      rect.setAttribute('y', String(-height / 2));
      rect.setAttribute('width', String(width));
      rect.setAttribute('height', String(height));
    }

    if (foreignObject) {
      foreignObject.setAttribute('x', String(-width / 2));
      foreignObject.setAttribute('y', String(-height / 2));
      foreignObject.setAttribute('width', String(width));
      foreignObject.setAttribute('height', String(height));
    }

    const labelGroup = node.querySelector('g.label');
    if (labelGroup) {
      labelGroup.replaceChildren();
      const text = doc.createElementNS(svgNamespace, 'text');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-family', 'Arial');
      text.setAttribute('font-size', '18');
      text.setAttribute('fill', '#000000');
      const totalHeight = (lines.length - 1) * 22;

      lines.forEach((line, index) => {
        const tspan = doc.createElementNS(svgNamespace, 'tspan');
        tspan.setAttribute('x', '0');
        tspan.setAttribute('y', String(-totalHeight / 2 + index * 22 + 6));
        tspan.textContent = line;
        text.appendChild(tspan);
      });

      labelGroup.appendChild(text);
    }

    minX = Math.min(minX, x - width / 2);
    minY = Math.min(minY, y - height / 2);
    maxX = Math.max(maxX, x + width / 2);
    maxY = Math.max(maxY, y + height / 2);
  }

  if (Number.isFinite(minX) && Number.isFinite(minY) && Number.isFinite(maxX) && Number.isFinite(maxY)) {
    const margin = 40;
    const width = Math.ceil(maxX - minX + margin * 2);
    const height = Math.ceil(maxY - minY + margin * 2);
    root.setAttribute('viewBox', `${Math.floor(minX - margin)} ${Math.floor(minY - margin)} ${width} ${height}`);
    root.setAttribute('width', String(width));
    root.setAttribute('height', String(height));
    root.setAttribute('style', `max-width: ${width}px;`);
  }

  return new window.XMLSerializer().serializeToString(root);
};

globalThis.window = window;
globalThis.document = window.document;

for (const [key, value] of Object.entries({
  self: window,
  navigator: window.navigator,
  location: window.location,
  Element: window.Element,
  HTMLElement: window.HTMLElement,
  SVGElement: window.SVGElement,
  Node: window.Node,
  DOMParser: window.DOMParser,
  XMLSerializer: window.XMLSerializer,
  performance: window.performance,
  getComputedStyle: window.getComputedStyle.bind(window),
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  atob: (value) => Buffer.from(value, 'base64').toString('utf8'),
  btoa: (value) => Buffer.from(String(value), 'utf8').toString('base64'),
})) {
  installGlobal(key, value);
}

if (window.SVGElement?.prototype) {
  window.SVGElement.prototype.getBBox = estimateBox;
  window.SVGElement.prototype.getComputedTextLength = function getComputedTextLength() {
    return estimateBox.call(this).width;
  };
}

const mermaid = (await importFromRenderer('mermaid/dist/mermaid.core.mjs')).default;

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
  theme: 'base',
  fontFamily: 'Arial',
  flowchart: {
    htmlLabels: false,
  },
});

fs.mkdirSync(outputDir, { recursive: true });

const figureFiles = fs
  .readdirSync(mermaidDir)
  .filter((name) => /^figure\d+\.mmd$/.test(name))
  .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

for (const fileName of figureFiles) {
  const inputPath = path.join(mermaidDir, fileName);
  const outputPath = path.join(outputDir, fileName.replace(/\.mmd$/, '.png'));
  const graphDefinition = fs.readFileSync(inputPath, 'utf8');
  const renderId = fileName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const { svg } = await mermaid.render(renderId, graphDefinition);
  const normalizedSvg = normalizeSvg(svg);
  const resvg = new Resvg(normalizedSvg, {
    fitTo: { mode: 'width', value: 1600 },
    background: 'white',
  });

  fs.writeFileSync(outputPath, resvg.render().asPng());
  process.stdout.write(`${outputPath}\n`);
}
