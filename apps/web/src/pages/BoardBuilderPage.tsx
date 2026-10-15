import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSession } from '@/context/SessionContext';
import { getUserBoards, uploadBoardAndDetect } from '@/api/queries';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageIcon, LayoutDashboard, Plus } from 'lucide-react';

export default function BoardBuilder() {
  const { session } = useSession();
  const user = session?.user;
  const queryClient = useQueryClient(); // Used to trigger cache invalidation

  const [boardName, setBoardName] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(Date.now());

  const {
    data: userBoards = [],
    isLoading: isLoadingBoards
  } = useQuery({
    queryKey: ['boards', user?.id],
    queryFn: () => getUserBoards(),
    enabled: !!user?.id,
  });

  const createBoardMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You must be logged in to create a board.");
      if (!boardName || !imageFile) throw new Error("Missing required fields.");

      // Single round trip: the API stores the image, runs the ML detector,
      // and persists the board + detected holds.
      return uploadBoardAndDetect(boardName, imageFile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards', user?.id] });

      setBoardName('');
      setImageFile(null);
      setFileInputKey(Date.now());
    }
  });

  const isFormValid = boardName.trim() !== '' && imageFile !== null;

  return (
    <div className="relative min-h-screen w-full max-w-2xl mx-auto flex flex-col bg-background">

      {/* Sticky Header */}
      <header className="sticky top-0 z-10 bg-slate-800 text-white shadow-md border-b px-6 py-5">
        <h1 className="text-3xl font-bold tracking-tight">Manage Boards</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-10 pb-24">

        {/* --- CREATE BOARD SECTION --- */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Create a New Board</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Upload a photo of your wall. Holds are detected automatically.
            </p>
          </div>

          {createBoardMutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>{createBoardMutation.error.message}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-5 bg-card border rounded-xl p-5 shadow-sm">

            <div className="space-y-2">
              <Label htmlFor="board-name" className="text-sm font-medium">Board Name</Label>
              <Input
                id="board-name"
                placeholder="e.g. Garage Kilter Clone"
                value={boardName}
                onChange={(e) => setBoardName(e.target.value)}
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="image-upload" className="text-sm font-medium flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
                Board Image
              </Label>
              <Input
                key={`image-${fileInputKey}`}
                id="image-upload"
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                className="bg-background file:text-primary file:font-medium cursor-pointer"
              />
            </div>

            <Button
              className="w-full mt-4 font-semibold"
              disabled={!isFormValid || createBoardMutation.isPending}
              onClick={() => createBoardMutation.mutate()}
            >
              {createBoardMutation.isPending ? (
                'Detecting Holds...'
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Board
                </>
              )}
            </Button>
          </div>
        </section>

        <hr className="border-border" />

        {/* --- YOUR BOARDS SECTION --- */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Your Boards</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Select or view your currently active climbing walls.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {isLoadingBoards ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            ) : userBoards.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 border border-dashed rounded-lg bg-muted/30">
                <p className="text-muted-foreground text-sm font-medium">
                  No boards found. Create your first one above!
                </p>
              </div>
            ) : (
              userBoards.map((board) => (
                <div
                  key={board.id}
                  className="p-4 border rounded-lg flex items-center gap-4 bg-card hover:border-primary/50 transition-colors shadow-sm"
                >
                  <div className="bg-primary/10 p-2.5 rounded-md text-primary">
                    <LayoutDashboard className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <span className="font-semibold text-card-foreground">
                      {board.name}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
