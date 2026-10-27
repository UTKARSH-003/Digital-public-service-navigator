import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Spinner } from './components/ui';
import Layout from './layouts/Layout';
import Home from './pages/Home';
import Directory from './pages/Directory';
import ServiceDetail from './pages/ServiceDetail';
import Eligibility from './pages/Eligibility';
import Assistant from './pages/Assistant';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Checklist from './pages/Checklist';
import Profile from './pages/Profile';
const Admin = lazy(() => import('./pages/Admin'));
import Legal from './pages/Legal';
import NotFound from './pages/NotFound';
import { RequireAuth, RequireStaff } from './components/Guards';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="services" element={<Directory />} />
        <Route path="services/:id" element={<ServiceDetail />} />
        <Route path="services/:id/eligibility" element={<Eligibility />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="login" element={<Login />} />
        <Route path="legal/:page" element={<Legal />} />
        <Route path="dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="checklist/:serviceId" element={<RequireAuth><Checklist /></RequireAuth>} />
        <Route path="profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="admin/*" element={<RequireStaff><Suspense fallback={<Spinner />}><Admin /></Suspense></RequireStaff>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
