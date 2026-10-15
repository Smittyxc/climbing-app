import { useSession } from '@/context/SessionContext';
import { getUserBoards, getUserRoutes } from '@/api/queries';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQuery } from '@tanstack/react-query';

export default function RoutesPage() {
  const { session } = useSession()
  const user = session?.user;



  const {
    data: userRoutes = [],
    isLoading: isRoutesLoading,
    isError: isRoutesError,
    error: routesError
  } = useQuery({
    queryKey: ['routes', user?.id],
    queryFn: () => getUserRoutes(),
    enabled: !!user?.id
  })

  const {
    data: userBoards = [],
    isLoading: isBoardsLoading,
    isError: isBoardsError,
    error: boardsError
  } = useQuery({
    queryKey: ['boards', user?.id],
    queryFn: () => getUserBoards(),
    enabled: !!user?.id
  })

  return (
    <div className="relative h-screen w-full max-w-md mx-auto flex flex-col bg-background">

      <header className="sticky top-0 z-10 bg-slate-800 text-white shadow-md border-b px-6 py-5">
        <h1 className="text-3xl font-bold tracking-tight">Your Routes</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-4 pb-24 md:pb-6">
        {isRoutesLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        ) : userRoutes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4">
            <p className="text-muted-foreground">
              No routes found. Tap the + to create your first climb!
            </p>
          </div>
        ) : isRoutesError ? (
          <div className="p-4 border border-red-500/50 bg-red-500/10 rounded-lg text-center text-red-500">
            <p className="font-semibold">Failed to load climbs.</p>
            <p className="text-sm opacity-80">{routesError?.message}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {userRoutes.map((route) => (
              <Link
                key={route.id}
                to={`/routes/${route.board_id}/${route.id}`}
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


      {/* --- FLOATING ACTION BUTTON & DIALOG: SELECT BOARD --- */}
      <Dialog>
        <DialogTrigger asChild>
          <Button
            size="lg"
            className="fixed bottom-20 md:bottom-6 right-6 z-50 rounded-full shadow-lg h-14 w-14"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-106]">
          <DialogHeader>
            <DialogTitle>Create New Route</DialogTitle>
            <DialogDescription>
              Select which board you want to build a climb on.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-4">
            {isBoardsLoading ? (
              <Skeleton className="h-12 w-full rounded-md" />
            ) : userBoards.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center">
                You don't have any boards yet. <br />
                <Link to="/boards" className="text-primary underline">Create a board first</Link>.
              </div>
            ) : isBoardsError ? (
              <div className="p-4 border border-red-500/50 bg-red-500/10 rounded-lg text-center text-red-500">
                <p className="font-semibold">Failed to load climbs.</p>
                <p className="text-sm opacity-80">{boardsError.message}</p>
              </div>
            )


              : (
                userBoards.map((board) => (
                  <Link
                    key={board.id}
                    to={`/routes/${board.id}/new`}
                    className="block"
                  >
                    <div className="p-3 border rounded-md flex items-center justify-between hover:border-primary transition-colors">
                      <span className="font-medium">{board.name}</span>
                    </div>
                  </Link>
                ))
              )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}