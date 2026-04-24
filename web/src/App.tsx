import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { Collections } from "./pages/Collections";
import { CollectionDetail } from "./pages/CollectionDetail";
import { Study } from "./pages/Study";
import { Upload } from "./pages/Upload";
import { Profile } from "./pages/Profile";
import { Login } from "./pages/Login";

const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: "/signup", element: <Login /> },
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <Dashboard /> },
      { path: "/collections", element: <Collections /> },
      { path: "/c/:id", element: <CollectionDetail /> },
      { path: "/c/:id/study", element: <Study /> },
      { path: "/upload", element: <Upload /> },
      { path: "/profile", element: <Profile /> },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
