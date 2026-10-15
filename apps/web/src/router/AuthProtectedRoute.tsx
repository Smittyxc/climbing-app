import { useSession } from "../context/SessionContext";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Navigate, Outlet, useMatch } from "react-router-dom";
import NavMobile from "@/components/layout/nav-mobile";

const AuthProtectedRoute = () => {
  const { session } = useSession();
  const isBuilderPage = useMatch('/routes/:boardId/:routeId');
  const isClimbDisplayPage = useMatch('/climb/:boardId/:routeId');


  if (!session) {
    return <Navigate to="/auth" replace />
  }
  return (
    <SidebarProvider className="md:m-0 p-0">
      <AppSidebar />
      <SidebarInset className={`relative flex-1 md:m-0 ${!(isBuilderPage || isClimbDisplayPage) ? 'pb-16 md:pb-0' : ''}`}>
        {!(isBuilderPage || isClimbDisplayPage) &&
          <NavMobile />
        }
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
};

export default AuthProtectedRoute;
