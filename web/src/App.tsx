import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { RequireAuth, RequireOnboarded } from "./components/RequireAuth";
import { Dashboard } from "./pages/Dashboard";
import { Collections } from "./pages/Collections";
import { CollectionDetail } from "./pages/CollectionDetail";
import { Study } from "./pages/Study";
import { Upload } from "./pages/Upload";
import { Profile } from "./pages/Profile";
import { Login } from "./pages/Login";
import { OAuthCallback } from "./pages/OAuthCallback";
import { Onboarding } from "./pages/Onboarding";
import { Landing } from "./pages/Landing";
import { Imprint } from "./pages/Imprint";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";
import { TermsOfService } from "./pages/TermsOfService";

const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  { path: "/impressum", element: <Imprint /> },
  { path: "/privacy", element: <PrivacyPolicy /> },
  { path: "/terms", element: <TermsOfService /> },
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
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
