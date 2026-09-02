import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { RequireAuth, RequireOnboarded } from "./components/RequireAuth";
import { AppLoader } from "./components/AppLoader";
import { Toaster } from "./components/Toaster";
import { ShutdownBanner } from "./components/ShutdownBanner";
import { useDb, selectCollectionsLoading, selectSession } from "./lib/store";

// Core pages — eagerly loaded. They're always accessed post-login and
// their combined weight is small; lazy-loading them only adds a Suspense
// flicker with no meaningful bundle-size benefit.
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { OAuthCallback } from "./pages/OAuthCallback";
import { Dashboard } from "./pages/Dashboard";
import { Collections } from "./pages/Collections";
import { CollectionDetail } from "./pages/CollectionDetail";
import { Study } from "./pages/Study";
import { Upload } from "./pages/Upload";
import { Profile } from "./pages/Profile";
import { Onboarding } from "./pages/Onboarding";
import { Announcements } from "./pages/Announcements";

// Infrequent pages — lazy is fine, no user-visible flicker expected.
const Imprint = lazy(() => import("./pages/Imprint").then(m => ({ default: m.Imprint })));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy").then(m => ({ default: m.PrivacyPolicy })));
const TermsOfService = lazy(() => import("./pages/TermsOfService").then(m => ({ default: m.TermsOfService })));

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
        <Onboarding />
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
      { index: true, element: <Dashboard /> },
      { path: "collections", element: <Collections /> },
      { path: "c/:id", element: <CollectionDetail /> },
      { path: "c/:id/study", element: <Study /> },
      { path: "upload", element: <Upload /> },
      { path: "profile", element: <Profile /> },
      { path: "announcements", element: <Announcements /> },
    ],
  },
]);

function GlobalLoader() {
  const session = useDb(selectSession);
  const collectionsLoading = useDb(selectCollectionsLoading);
  // Show when a logged-in user is waiting for their collections to arrive.
  // The bootstrap+no-session case is handled by RequireAuth.
  if (!session || !collectionsLoading) return null;
  return <AppLoader />;
}

function App() {
  return (
    <>
      <ShutdownBanner />
      <GlobalLoader />
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}

export default App;
