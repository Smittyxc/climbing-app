import { Link, useNavigate } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import { Button } from "@/components/ui/button";
import { getUserBoards, updateUserDefaultBoard } from "@/api/queries";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Mountain, LayoutDashboard, Settings2, Activity } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const ProtectedPage = () => {
  const { session, setDefaultBoard, defaultBoard, signOutUser } = useSession();
  const userId = session?.user.id || "";
  const navigate = useNavigate();

  const firstName = session?.user?.user_metadata?.first_name
    || session?.user?.email?.split('@')[0]
    || "Climber";

  const { data: boards = [], isLoading } = useQuery({
    queryKey: ['boards', userId],
    queryFn: () => getUserBoards(),
    enabled: !!userId,
  });

  const boardItems = boards.map((board) => ({
    value: board.id,
    label: board.name,
  }));

  const handleBoardSelect = async (value: string) => {
    const newValue = value === "unselected" ? null : value;

    try {
      await updateUserDefaultBoard(newValue);
      setDefaultBoard(newValue);

    } catch (error) {
      console.error("Failed to update default board", error);
      toast.error("Failed to update default board");
    }
  };

  // const defaultBoardName = boardItems.find(board => board.value === defaultBoard)?.label;

  return (
    <div className="relative min-h-screen w-full max-w-md mx-auto flex flex-col bg-background">

      {/* Sleek App Header */}
      <header className="sticky top-0 z-10 bg-slate-800  border-b px-5 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2 text-white">
          <Mountain className="w-6 h-6" />
          <h1 className="text-xl font-bold tracking-tight">Garage Grind</h1>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:text-destructive"
          onClick={() => signOutUser().then(() => navigate("/"))}
          title="Sign Out"
        >
          <LogOut className="w-5 h-5" />
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto p-5 space-y-8 pb-24">

        {/* Welcome Section */}
        <section>
          <h2 className="text-3xl font-bold tracking-tight">Welcome back,</h2>
          <h2 className="text-3xl font-bold text-primary">{firstName}</h2>
        </section>

        {/* Active Board Card - Highlights the current context */}
        <Card className={`border-2 transition-colors ${defaultBoard ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-muted-foreground" />
              Active Board
            </CardTitle>
            <CardDescription>
              Set the wall you are currently climbing on.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-full rounded-md" />
            ) : (
              <Select onValueChange={handleBoardSelect} value={defaultBoard || 'unselected'}>
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder="Select a board..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {/* Value changed to 'unselected' to match your function logic! */}
                    <SelectItem value="unselected" className="italic text-muted-foreground">
                      None
                    </SelectItem>
                    {boardItems.map(board => (
                      <SelectItem key={board.value} value={board.value}>
                        {board.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions Grid */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Quick Actions</h3>

          <div className="grid grid-cols-2 gap-3">
            <Link to="/routes" className="block group">
              <Card className="h-full hover:border-primary/50 hover:bg-accent transition-all">
                <CardContent className="p-5 flex flex-col items-center justify-center text-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-full text-primary group-hover:scale-110 transition-transform">
                    <Activity className="w-6 h-6" />
                  </div>
                  <span className="font-semibold text-sm">My Climbs</span>
                </CardContent>
              </Card>
            </Link>

            <Link to="/boards" className="block group">
              <Card className="h-full hover:border-primary/50 hover:bg-accent transition-all">
                <CardContent className="p-5 flex flex-col items-center justify-center text-center gap-3">
                  <div className="p-3 bg-secondary rounded-full text-secondary-foreground group-hover:scale-110 transition-transform">
                    <LayoutDashboard className="w-6 h-6" />
                  </div>
                  <span className="font-semibold text-sm">Manage Boards</span>
                </CardContent>
              </Card>
            </Link>
          </div>
        </section>

      </main>
    </div>
  );
};

export default ProtectedPage;