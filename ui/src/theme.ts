import { createTheme } from '@mantine/core';

export const forgeTheme = createTheme({
  primaryColor: 'forgeLime',
  colors: {
    forgeLime: ['#eef9d9', '#dff2b3', '#cceb8c', '#b7e15f', '#a6d92b', '#97c71f', '#89b318', '#739313', '#5d7410', '#48590b'],
    forgeRust: ['#fff0e7', '#ffd8c0', '#f9b391', '#f1895e', '#ea6436', '#d44e21', '#b53d16', '#912e10', '#71220b', '#551806'],
    forgeInk: ['#edf0f2', '#d7dee4', '#b0bec8', '#889caa', '#667c89', '#4b626f', '#364954', '#25343e', '#162028', '#0b1117'],
    forgeStone: ['#faf6ef', '#f2eadc', '#e8dcc8', '#dbcbb1', '#ccb996', '#bca77c', '#a28f63', '#84724b', '#65563a', '#473c29']
  },
  fontFamily: 'Iowan Old Style, Baskerville, Palatino, Georgia, serif',
  fontFamilyMonospace: '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace',
  headings: {
    fontFamily: 'Iowan Old Style, Baskerville, Palatino, Georgia, serif',
    fontWeight: '700'
  },
  defaultRadius: 'md'
});

export const forgeGlobalStyles = `
  :root {
    --forge-paper: #f5ecda;
    --forge-paper-strong: #efe2cb;
    --forge-ink: #162028;
    --forge-ink-soft: #425563;
    --forge-lime: #97c71f;
    --forge-rust: #d44e21;
    --forge-blueprint: rgba(22, 32, 40, 0.08);
    --forge-panel: rgba(255, 252, 247, 0.86);
    --forge-line: rgba(22, 32, 40, 0.12);
    --forge-shadow: 0 28px 80px rgba(22, 32, 40, 0.12);
  }

  html, body, #root {
    min-height: 100%;
    margin: 0;
  }

  body {
    color: var(--forge-ink);
    background:
      radial-gradient(circle at 12% 18%, rgba(151, 199, 31, 0.18), transparent 22%),
      radial-gradient(circle at 82% 14%, rgba(212, 78, 33, 0.14), transparent 28%),
      linear-gradient(180deg, var(--forge-paper-strong) 0%, var(--forge-paper) 48%, #fbf8f2 100%);
    background-attachment: fixed;
  }

  body::before {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    background-image:
      linear-gradient(var(--forge-blueprint) 1px, transparent 1px),
      linear-gradient(90deg, var(--forge-blueprint) 1px, transparent 1px);
    background-size: 44px 44px;
    opacity: 0.45;
    mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.8), transparent 90%);
  }

  a {
    color: inherit;
    text-decoration: none;
  }

  .forge-mono {
    font-family: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace;
    letter-spacing: 0.04em;
  }
`;
