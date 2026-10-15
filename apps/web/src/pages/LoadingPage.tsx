import { Loader2 } from "lucide-react";

const LoadingPage = () => {
  return (
    <main className="h-screen w-full flex flex-col items-center justify-center bg-background">
      <section className="flex flex-col items-center space-y-4">

        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-80" />

        <h1 className="text-lg font-medium text-muted-foreground animate-pulse tracking-wide">
          Loading your climbs...
        </h1>

      </section>
    </main>
  );
};

export default LoadingPage;