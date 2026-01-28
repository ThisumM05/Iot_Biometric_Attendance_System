import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { ThemeProvider } from "@/components/theme-provider"
import GlobalLoader from './components/GlobalLoader';

// Lazy load pages
const Home = lazy(() => import('./pages/Home'));

// Artificial delay for demonstration purposes (Optional - remove in production)
// const Home = lazy(() => new Promise(resolve => {
//     setTimeout(() => resolve(import('./pages/Home')), 2000);
// }));

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <BrowserRouter>
        <Suspense fallback={<GlobalLoader />}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="users" element={<div>Users Page Placeholder</div>} />
              <Route path="analytics" element={<div>Analytics Page Placeholder</div>} />
              <Route path="settings" element={<div>Settings Page Placeholder</div>} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
