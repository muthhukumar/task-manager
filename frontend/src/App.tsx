import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Today } from './pages/Today';
import { AllTasks } from './pages/AllTasks';
import { SprintSetup } from './pages/SprintSetup';
import { Backlog } from './pages/Backlog';
import { Reports } from './pages/Reports';
import { Export } from './pages/Export';
import { BackupRestore } from './pages/BackupRestore';

import { ThemeProvider } from './context/ThemeContext';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Today />} />
            <Route path="tasks" element={<AllTasks />} />
            <Route path="sprints" element={<SprintSetup />} />
            <Route path="backlog" element={<Backlog />} />
            <Route path="reports" element={<Reports />} />
            <Route path="export" element={<Export />} />
            <Route path="backup" element={<BackupRestore />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
