import { useSession } from '@/context/SessionContext';
import { getUserRoutes } from '@/api/queries';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

export default function ClimbPage() {
  const { session } = useSession();
  const user = session?.user;

  const {
    data: userRoutes = [],
    isLoading,
    isError,
    error
  } = useQuery({
    queryKey: ['routes', user?.id],

    queryFn: () => getUserRoutes(),

    enabled: !!user?.id,
  });

  const sortedRoutes = [...userRoutes].sort((a, b) => {
    const aGrade = parseInt(a.grade?.slice(1) || '-1');
    const bGrade = parseInt(b.grade?.slice(1) || '-1');
    return aGrade - bGrade;

  })

  return (
    <div className="relative h-screen w-full max-w-md mx-auto flex flex-col bg-background">

      <header className="sticky top-0 z-10 bg-slate-800 text-white border-b px-6 py-5 shadow-md">
        <h1 className="text-3xl font-bold tracking-tight">Your Climbs</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-4 pb-24 md:pb-6">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        ) : isError ? (
          // NEW: Gracefully handle the error state in the UI
          <div className="p-4 border border-red-500/50 bg-red-500/10 rounded-lg text-center text-red-500">
            <p className="font-semibold">Failed to load climbs.</p>
            <p className="text-sm opacity-80">{error?.message}</p>
          </div>
        ) : userRoutes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4">
            <p className="text-muted-foreground">
              No routes found. Tap the + to create your first climb!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sortedRoutes.map((route) => (
              <Link
                key={route.id}
                to={`/climb/${route.board_id}/${route.id}`}
                className="block group"
              >
                <div className="p-4 border rounded-lg flex items-center justify-between bg-card hover:border-primary/50 hover:bg-accent transition-all shadow-sm">
                  <span className="font-semibold text-card-foreground group-hover:text-accent-foreground">
                    {route.name}
                  </span>
                  {route.grade && (
                    <span className="text-sm font-medium bg-secondary text-secondary-foreground px-2.5 py-1 rounded-md">
                      {route.grade}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}