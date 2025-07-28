import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline, Box } from '@mui/material';
import Sidebar from './components/Sidebar';
import TimelineView from './components/TimelineView';
import GraphView from './components/GraphView';
import ManageView from './components/ManageView';
import ShareView from './components/ShareView';
import Signup from './components/Signup';
import Enroll from './components/Enroll';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import ChaincodeSubmission from './components/ChaincodeSubmission';
import './App.css';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" />;
  if (adminOnly) {
    const decoded = JSON.parse(atob(token.split('.')[1]));
    if (decoded.enrollmentId !== 'admin') return <Navigate to="/" />;
  }
  return children;
};

const PrivateLayout = ({ children }) => (
  <Box sx={{ display: 'flex' }}>
    <CssBaseline />
    <Sidebar />
    <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
      {children}
    </Box>
  </Box>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/enroll" element={<Enroll />} />
        <Route
          path="/"
          element={<ProtectedRoute><PrivateLayout><ManageView /></PrivateLayout></ProtectedRoute>}
        />
        <Route
          path="/timeline"
          element={<ProtectedRoute><PrivateLayout><TimelineView /></PrivateLayout></ProtectedRoute>}
        />
        <Route
          path="/graph"
          element={<ProtectedRoute><PrivateLayout><GraphView /></PrivateLayout></ProtectedRoute>}
        />
        <Route
          path="/share"
          element={<ProtectedRoute><PrivateLayout><ShareView /></PrivateLayout></ProtectedRoute>}
        />
        <Route
          path="/admin"
          element={<ProtectedRoute adminOnly><PrivateLayout><AdminDashboard /></PrivateLayout></ProtectedRoute>}
        />
        <Route
          path="/submit-chaincode"
          element={<ProtectedRoute><PrivateLayout><ChaincodeSubmission /></PrivateLayout></ProtectedRoute>}
        />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;