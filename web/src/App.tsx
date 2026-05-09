import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { RequireAuth, RequireOnboarded } from "./components/RequireAuth";

// Eagerly loaded — shown before auth is resolved
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { OAuthCallback } from "./pages/OAuthCallback";

// Legal pages — tiny, rarely visited, lazy is fine
const Imprint = lazy(() => import("./pages/Imprint").then(m => ({ default: m.Imprint })));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy").then(m => ({ default: m.PrivacyPolicy })));
const TermsOfService = lazy(() => import("./pages/TermsOfService").then(m => ({ default: m.TermsOfService })));

// Onboarding — only hit once per user
const Onboarding = lazy(() => import("./pages/Onboarding").then(m => ({ default: m.Onboarding })));

// App pages — loaded only after authentication
const Dashboard = lazy(() => import("./pages/Dashboard").then(m => ({ default: m.Dashboard })));
const Collections = lazy(() => import("./pages/Collections").then(m => ({ default: m.Collections })));
const CollectionDetail = lazy(() => import("./pages/CollectionDetail").then(m => ({ default: m.CollectionDetail })));
const Study = lazy(() => import("./pages/Study").then(m => ({ default: m.Study })));
const Upload = lazy(() => import("./pages/Upload").then(m => ({ default: m.Upload })));
const Profile = lazy(() => import("./pages/Profile").then(m => ({ default: m.Profile })));

function PageFallback() {
  return null;
}

const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  { path: "/imprint", element: <Suspense fallback={<PageFallback />}><Imprint /></Suspense> },
  { path: "/privacy", element: <Suspense fallback={<PageFallback />}><PrivacyPolicy /></Suspense> },
  { path: "/terms", element: <Suspense fallback={<PageFallback />}><TermsOfService /></Suspense> },
  { path: "/login", element: <Login /> },
  { path: "/signup", element: <Login /> },
  { path: "/auth/callback", element: <OAuthCallback /> },
  {
    path: "/onboarding",
    element: (
      <RequireAuth>
        <Suspense fallback={<PageFallback />}>
          <Onboarding />
        </Suspense>
      </RequireAuth>
    ),
  },
  {
    path: "/app",
    element: (
      <RequireAuth>
        <RequireOnboarded>
          <AppShell />
        </RequireOnboarded>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Suspense fallback={<PageFallback />}><Dashboard /></Suspense> },
      { path: "collections", element: <Suspense fallback={<PageFallback />}><Collections /></Suspense> },
      { path: "c/:id", element: <Suspense fallback={<PageFallback />}><CollectionDetail /></Suspense> },
      { path: "c/:id/study", element: <Suspense fallback={<PageFallback />}><Study /></Suspense> },
      { path: "upload", element: <Suspense fallback={<PageFallback />}><Upload /></Suspense> },
      { path: "profile", element: <Suspense fallback={<PageFallback />}><Profile /></Suspense> },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
