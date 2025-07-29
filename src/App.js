import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CssBaseline, Box } from '@mui/material';
import Sidebar from './components/Sidebar';
import TimelineView from './components/TimelineView';
import GraphView from './components/GraphView';
import ManageView from './components/ManageView';
import ShareView from './components/ShareView';

import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Box sx={{ display: 'flex' }}>
        <CssBaseline />
        <Sidebar />
        <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
          <Routes>
            <Route path="/" element={<ManageView />} />
            <Route path="/timeline" element={<TimelineView />} />
            <Route path="/graph" element={<GraphView />} />
            <Route path="/share" element={<ShareView />} />
          </Routes>
        </Box>
      </Box>
    </BrowserRouter>
  );
}

export default App;
