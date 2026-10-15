import { useState, useEffect } from 'react';
import type { HoldType, Route, RouteHoldInsert } from '@/lib/db_types';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  addRouteHolds,
  deleteRouteHolds,
  getBoardWithHolds,
  getRouteDetailsById,
  getRouteHoldsById,
  saveRoute,
  updateRoute
} from '@/api/queries';
import KonvaRouteDisplay from './KonvaDisplay';
import MobileRouteBuilder from '@/components/layout/mobile-route-builder';
import { toast } from 'sonner';
import { useSession } from '@/context/SessionContext';
import { Skeleton } from '@/components/ui/skeleton';

const cycleOrder: HoldType[] = ['unassigned', 'start', 'hand', 'foot', 'end'];

export default function RouteBuilder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { boardId, routeId } = useParams<{ boardId: string, routeId: string }>();
  const { session } = useSession();
  const user = session?.user;

  // Local Form State
  const [routeHolds, setRouteHolds] = useState<Record<string, HoldType>>({});
  const [routeName, setRouteName] = useState("");
  const [routeGrade, setRouteGrade] = useState("");
  const [routeDetails, setRouteDetails] = useState<Route>();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // 1. QUERY: Fetch the Board Data
  const {
    data: boardData,
    isLoading: isLoadingBoard
  } = useQuery({
    queryKey: ['board', boardId],
    queryFn: () => getBoardWithHolds(boardId as string),
    enabled: !!boardId, // Only run if we have a boardId
  });

  // 2. QUERY: Fetch the Route Data (Only if editing an existing route)
  const {
    data: existingRouteData,
    isLoading: isLoadingRoute
  } = useQuery({
    queryKey: ['route', routeId],
    queryFn: async () => {
      const [holds, details] = await Promise.all([
        getRouteHoldsById(routeId as string),
        getRouteDetailsById(routeId as string)
      ]);
      return { holds, details };
    },
    enabled: !!routeId && routeId !== 'new',
  });

  // Seed local state when existing route data arrives
  useEffect(() => {
    if (existingRouteData?.details) {
      setRouteDetails(existingRouteData.details);
      setRouteName(existingRouteData.details.name);
      setRouteGrade(existingRouteData.details.grade || "");
    }

    if (existingRouteData?.holds) {
      const formattedHolds = existingRouteData.holds.reduce((acc, hold) => {
        acc[hold.hold_id] = hold.type || 'unassigned';
        return acc;
      }, {} as Record<string, HoldType>);

      setRouteHolds(formattedHolds);
    }
  }, [existingRouteData]);

  // Handle saving/updating the route
  const saveRouteMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("User not logged in");
      if (!boardId) throw new Error("Missing board ID");
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const activeHolds = Object.entries(routeHolds).filter(([_, type]) => type !== 'unassigned');

      let finalRouteId = routeId;

      if (routeId === 'new') {
        // CREATE
        const routeData = await saveRoute(boardId, routeName, routeGrade);
        finalRouteId = routeData.id;
      } else if (routeId) {
        // EDIT
        await updateRoute(routeId, routeName, routeGrade);
        await deleteRouteHolds(routeId);
      }

      // INSERT HOLDS
      const payload: RouteHoldInsert[] = activeHolds.map(([holdId, type]) => ({
        route_id: finalRouteId as string,
        hold_id: holdId,
        type: type as HoldType,
      }));

      await addRouteHolds(payload);
      return finalRouteId;
    },
    onSuccess: () => {
      toast.success("Successfully saved route!");
      setIsDrawerOpen(false);

      // Invalidate the route list so the new/edited route shows up immediately
      queryClient.invalidateQueries({ queryKey: ['routes', user?.id] });

      // If we edited an existing route, invalidate its specific cache too
      if (routeId !== 'new') {
        queryClient.invalidateQueries({ queryKey: ['route', routeId] });
      }

      navigate('/routes');
    },
    onError: (error) => {
      console.error("Error saving route:", error);
      toast.error(error instanceof Error ? error.message : "There was an error saving your route.");
    }
  });

  const handleHoldClick = (holdId: string | null) => {
    if (!holdId) return;
    setRouteHolds((prev) => {
      const currentType = prev[holdId] || 'unassigned';
      const currentIndex = cycleOrder.indexOf(currentType);
      const nextType = cycleOrder[(currentIndex + 1) % cycleOrder.length];
      return { ...prev, [holdId]: nextType };
    });
  };

  const handleValidationAndSave = () => {
    if (!routeName.trim()) {
      toast.error("Please provide a route name.");
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const activeHolds = Object.entries(routeHolds).filter(([_, type]) => type !== 'unassigned');
    if (activeHolds.length === 0) {
      toast.error("Please select at least one hold for this route.");
      return;
    }

    // If validations pass, trigger the mutation
    saveRouteMutation.mutate();
  };

  // Derive total loading state
  const isLoading = isLoadingBoard || isLoadingRoute;

  return (
    <div className='w-full h-screen'>
      {isLoading ? (
        <Skeleton className="w-full h-full" />
      ) : (
        <>
          <KonvaRouteDisplay
            imageUrl={boardData?.image_url || ''}
            allHolds={boardData?.holds || []}
            routeHolds={routeHolds}
            onHoldClick={handleHoldClick}
            isViewOnly={false}
            routeDetails={routeDetails}
          />
          <MobileRouteBuilder
            isDrawerOpen={isDrawerOpen}
            setIsDrawerOpen={setIsDrawerOpen}
            routeName={routeName}
            setRouteName={setRouteName}
            routeGrade={routeGrade}
            setRouteGrade={setRouteGrade}
            handleSaveRoute={handleValidationAndSave}
            isSubmitting={saveRouteMutation.isPending} // Pass this down to disable the save button!
          />
        </>
      )}
    </div>
  );
}