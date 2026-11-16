import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
// The hardware skin goes first so the VU-1 blocks' styles refine it.
import { Shell } from "./Shell.jsx";
import App from "./App.jsx";
import { SignInRedirect } from "./pages/SignInRedirect.jsx";
import { SignUpRedirect } from "./pages/SignUpRedirect.jsx";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";
import "@fontsource/geist-mono/700.css";
import "@fontsource/geist-mono/900.css";
import "./styles.css";

const router = createBrowserRouter([
  ...(import.meta.env.DEV
    ? [
        {
          path: "/__2049",
          lazy: () =>
            import("./ui/gallery/Gallery2049.tsx").then((m) => ({ Component: m.Gallery2049 })),
        },
        {
          path: "/__vu1",
          HydrateFallback: () => null,
          lazy: () =>
            import("./ui/gallery/GalleryVu1.tsx").then((m) => ({ Component: m.GalleryVu1 })),
        },
      ]
    : []),
  { path: "/sign-in", element: <SignInRedirect /> },
  { path: "/sign-up", element: <SignUpRedirect /> },
  { path: "*", element: <App /> },
]);

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Shell>
      <RouterProvider router={router} />
    </Shell>
  </React.StrictMode>,
);
