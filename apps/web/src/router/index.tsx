import { createBrowserRouter } from "react-router-dom";
import HomePage from "../pages/HomePage.tsx";
import ProtectedPage from "../pages/ProtectedPage.tsx";
import NotFoundPage from "../pages/404Page.tsx";
import AuthProtectedRoute from "./AuthProtectedRoute.tsx";
import Providers from "../Providers.tsx";
import { AuthPage } from "@/pages/AuthPage.tsx";
import RouteBuilder from "@/pages/RouteBuilderPage.tsx";
import BoardBuilder from "@/pages/BoardBuilderPage.tsx";
import RoutesPage from "@/pages/RoutePage.tsx";
import ClimbPage from "@/pages/ClimbPage.tsx";
import ClimbDisplay from "@/pages/ClimbDisplayPage.tsx";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Providers />,
    children: [
      // Public routes
      {
        path: "/",
        element: <HomePage />,
      },
      {
        path: "/auth",
        element: <AuthPage />,
      },
      // Auth Protected routes
      {
        path: "/",
        element: <AuthProtectedRoute />,
        children: [
          {
            path: "/protected",
            element: <ProtectedPage />,
          },
          {
            path: "/routes",
            element: <RoutesPage />
          },
          {
            path: "/routes/:boardId/:routeId",
            element: <RouteBuilder />
          },
          {
            path: "/boards",
            element: <BoardBuilder />
          },
          {
            path: "/climb",
            element: <ClimbPage />
          },
          {
            path: "/climb/:boardId/:routeId",
            element: <ClimbDisplay />
          }

        ],
      },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);

export default router;
