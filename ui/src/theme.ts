import { createTheme } from '@mantine/core';

export const forgeTheme = createTheme({
  primaryColor: 'forgeLime',
  colors: {
    forgeLime: ['#eef9d9', '#dff2b3', '#cceb8c', '#b7e15f', '#a6d92b', '#97c71f', '#89b318', '#739313', '#5d7410', '#48590b'],
    forgeRust: ['#fff0e7', '#ffd8c0', '#f9b391', '#f1895e', '#ea6436', '#d44e21', '#b53d16', '#912e10', '#71220b', '#551806'],
    forgeInk: ['#edf0f2', '#d7dee4', '#b0bec8', '#889caa', '#667c89', '#4b626f', '#364954', '#25343e', '#162028', '#0b1117'],
    forgeStone: ['#faf6ef', '#f2eadc', '#e8dcc8', '#dbcbb1', '#ccb996', '#bca77c', '#a28f63', '#84724b', '#65563a', '#473c29']
  }
});

export const forgeGlobalStyles = `
  :root {
    --forge-ink: #162028;
    --forge-lime: #97c71f;
    --forge-rust: #d44e21;
  }

  html,
  body,
  #root {
    min-height: 100%;
    margin: 0;
  }

  body {
    color: var(--mantine-color-text);
    background: var(--mantine-color-body);
  }

  a {
    color: inherit;
    text-decoration: none;
  }

  .forge-mono {
    font-family: var(--mantine-font-family-monospace);
    letter-spacing: 0.02em;
  }
`;
