import { Outlet } from "react-router-dom";
import { SessionProvider } from "./context/SessionContext";
import { Toaster } from "sonner";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const Providers = () => {
  const queryClient = new QueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <Outlet />
        <Toaster position="top-right" />
      </SessionProvider>
    </QueryClientProvider>
  );
};

export default Providers;
