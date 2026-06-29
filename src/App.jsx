import React, { useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useDarkModeState } from './hooks/useStoreSelectors';
import AppErrorBoundary from './components/AppErrorBoundary';
import { getCustomOutputRouteIds } from '../shared/outputRegistry.js';

const Router = import.meta.env.MODE === 'development' ? BrowserRouter : HashRouter;

const AppProviders = React.lazy(() => import('./components/AppProviders'));
const MainWindowShell = React.lazy(() => import('./components/routes/MainWindowShell'));
const ObsDockRoute = React.lazy(() => import('./components/routes/ObsDockRoute'));
const ObsSetupRoute = React.lazy(() => import('./components/routes/ObsSetupRoute'));
const TimerControlRoute = React.lazy(() => import('./components/routes/TimerControlRoute'));

const ControlPanel = React.lazy(() => import('./pages/ControlPanel'));
const Output1 = React.lazy(() => import('./pages/Output1'));
const Output2 = React.lazy(() => import('./pages/Output2'));
const Stage = React.lazy(() => import('./pages/Stage'));
const TimeDisplay = React.lazy(() => import('./pages/TimeDisplay'));
const OutputPage = React.lazy(() => import('./pages/OutputPage'));
const LyricVideoStudio = React.lazy(() => import('./pages/LyricVideoStudio'));
const LyricVideoExportFrame = React.lazy(() => import('./pages/LyricVideoExportFrame'));
const LyricVideoLiveOutput = React.lazy(() => import('./pages/LyricVideoLiveOutput'));
const NewSongCanvas = React.lazy(() => import('./components/NewSongCanvas'));

const CUSTOM_OUTPUT_ROUTE_IDS = getCustomOutputRouteIds();

const normalizePath = (pathname = '/') => {
  const normalized = pathname.replace(/\/+$/, '');
  return normalized || '/';
};

const isPassiveDisplayRoute = (pathname) => {
  const path = normalizePath(pathname);
  return (
    path === '/stage' ||
    path === '/time' ||
    path === '/lyric-video-live-output' ||
    path === '/lyric-video-export-frame' ||
    /^\/output\d+$/.test(path)
  );
};

function AppRoutes() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search || '');
  const isObsDockEntry = normalizePath(location.pathname) === '/' && searchParams.get('dock') === 'obs';

  return (
    <React.Suspense fallback={null}>
      <Routes>
        <Route element={<MainWindowShell />}>
          <Route path="/" element={isObsDockEntry ? <ObsDockRoute /> : <ControlPanel />} />
          <Route path="/lyric-video-studio" element={<LyricVideoStudio />} />
          <Route path="/new-song" element={<NewSongCanvas />} />
        </Route>
        <Route path="/output1" element={<Output1 />} />
        <Route path="/output2" element={<Output2 />} />
        {CUSTOM_OUTPUT_ROUTE_IDS.map((outputId) => (
          <Route key={outputId} path={`/${outputId}`} element={<OutputPage outputId={outputId} />} />
        ))}
        <Route path="/stage" element={<Stage />} />
        <Route path="/time" element={<TimeDisplay />} />
        <Route path="/obs-setup" element={<ObsSetupRoute />} />
        <Route path="/obs-dock" element={<ObsDockRoute />} />
        <Route path="/lyric-video-live-output" element={<LyricVideoLiveOutput />} />
        <Route path="/lyric-video-export-frame" element={<LyricVideoExportFrame />} />
        <Route path="/timer-control" element={<TimerControlRoute />} />
      </Routes>
    </React.Suspense>
  );
}

function AppShell() {
  const location = useLocation();
  const { darkMode } = useDarkModeState();
  const isDockRuntime = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    const search = new URLSearchParams(window.location.search || '');
    const hash = window.location.hash || '';
    const path = window.location.pathname || '/';
    return search.get('dock') === 'obs' || normalizePath(path) === '/obs-dock' || hash.startsWith('#/obs-dock');
  }, []);
  const effectiveDarkMode = isDockRuntime ? true : darkMode;
  const passiveDisplay = isPassiveDisplayRoute(location.pathname);

  useEffect(() => {
    if (effectiveDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [effectiveDarkMode]);

  const routes = (
    <AppErrorBoundary>
      <AppRoutes />
    </AppErrorBoundary>
  );

  if (passiveDisplay) {
    return routes;
  }

  return (
    <React.Suspense fallback={null}>
      <AppProviders effectiveDarkMode={effectiveDarkMode} isDockRuntime={isDockRuntime}>
        {routes}
      </AppProviders>
    </React.Suspense>
  );
}

export default function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}
