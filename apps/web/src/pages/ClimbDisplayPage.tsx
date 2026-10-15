import { useMemo } from 'react';
import type { HoldType } from '@/lib/db_types';
import { useParams } from 'react-router-dom';
import { getBoardWithHolds, getCompleteRoute, getRouteDetailsById } from '@/api/queries';
import KonvaRouteDisplay from './KonvaDisplay';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';




export default function ClimbDisplay() {
  const { boardId, routeId } = useParams<{ boardId: string, routeId: string }>();

  const {
    data,
    isLoading
  } = useQuery({
    queryKey: ['climb', routeId],
    queryFn: async () => {
      const [board, holds, routeDetails] = await Promise.all([
        getBoardWithHolds(boardId || null),
        getCompleteRoute(routeId),
        getRouteDetailsById(routeId)
      ]);
      return { board, holds, routeDetails };
    },
    enabled: !!routeId && routeId !== 'new',
  });

  const imageUrl = data?.board?.image_url || '';

  const allHolds = useMemo(() => {
    return data?.holds?.map(routeHold => routeHold.hold) || [];
  }, [data]);

  const routeHolds = useMemo(() => {
    return data?.holds?.reduce((acc, routeHold) => {
      acc[routeHold.hold_id] = routeHold.type || 'hand';
      return acc;
    }, {} as Record<string, HoldType>);
  }, [data]);

  const handleHoldClick = () => {
    return null;
  };

  return (
    <div className='w-full h-screen'>
      {isLoading ? (
        <Skeleton />
      ) : (
        <KonvaRouteDisplay
          imageUrl={imageUrl}
          allHolds={allHolds}
          routeHolds={routeHolds || {}}
          onHoldClick={handleHoldClick}
          isViewOnly={true}
          routeDetails={data?.routeDetails || null}
        />

      )}

    </div>

  );
}