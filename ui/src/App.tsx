import { MantineProvider } from '@mantine/core';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppFrame from './components/layout/AppFrame';
import ProjectsPage from './routes/ProjectsPage';
import { forgeGlobalStyles, forgeTheme } from './theme';

export default function App() {
  return (
    <MantineProvider theme={forgeTheme}>
      <style>{forgeGlobalStyles}</style>
      <BrowserRouter>
        <AppFrame>
          <Routes>
            <Route path="/" element={<ProjectsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppFrame>
      </BrowserRouter>
    </MantineProvider>
  );
}
