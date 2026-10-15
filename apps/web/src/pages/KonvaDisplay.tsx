import { useState, useEffect } from 'react';
import { Image, Layer, Stage, Rect } from 'react-konva';
import useImage from 'use-image';
import type { Hold, HoldType, Route } from '@/lib/db_types';
import KonvaHeader from './KonvaHeader';

interface KonvaRouteDisplayProps {
  imageUrl: string;
  allHolds: Hold[];
  routeHolds: Record<string, HoldType>
  onHoldClick: (id: string | null) => void;
  isViewOnly: boolean;
  routeDetails: Route | null | undefined;
}

const holdColors: Record<HoldType, string> = {
  unassigned: 'rgba(255, 255, 255, 0.2)',
  hand: 'rgba(0, 0, 255, 0.8)',
  start: 'rgba(0, 255, 0, 0.8)',
  foot: 'rgba(255, 255, 0, 0.8)',
  end: 'rgba(255, 0, 0, 0.8)',
};

export default function KonvaRouteDisplay({
  imageUrl,
  allHolds,
  routeHolds,
  onHoldClick,
  routeDetails,
  isViewOnly
}: KonvaRouteDisplayProps) {
  const [image, status] = useImage(imageUrl, 'anonymous');
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => setWindowSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  let scale = 1;
  let stageWidth = windowSize.width;
  let stageHeight = windowSize.height;

  if (image) {
    const scaleX = windowSize.width / image.width;
    const scaleY = windowSize.height / image.height;
    scale = Math.min(scaleX, scaleY) * 0.95;

    stageWidth = image.width * scale;
    stageHeight = image.height * scale;
  }

  // Holds are stored normalized (0..1); convert to pixels of the natural image.
  const toPixels = (hold: Hold) => {
    if (!image) return null;
    const width = hold.width * image.width;
    const height = hold.height * image.height;
    return {
      x: hold.x_center * image.width - width / 2,
      y: hold.y_center * image.height - height / 2,
      width,
      height,
    };
  };

  return (
    <div className='flex justify-center items-center h-screen w-screen md:w-[calc(100vw-16rem)] bg-gray-950'>
      <KonvaHeader
        isViewOnly={isViewOnly}
        name={routeDetails?.name || 'Unknown'}
        grade={routeDetails?.grade || 'V?'}
      />

      <Stage width={stageWidth} height={stageHeight} scale={{ x: scale, y: scale }}>
        <Layer>
          {status === 'loaded' && <Image image={image} />}
        </Layer>

        <Layer>
          {image && (
            <Rect
              x={0}
              y={0}
              width={image.width}
              height={image.height}
              fill="rgba(0, 0, 0, 0.45)"
              listening={false}
            />
          )}

          {allHolds.map((hold) => {
            const holdId = hold.id as string;
            const isActive = routeHolds[holdId] && routeHolds[holdId] !== 'unassigned';
            const box = toPixels(hold);

            if (!isActive || !box) return null;

            return (
              <Rect
                key={`mask-${holdId}`}
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                fill="black"
                globalCompositeOperation="destination-out"
                listening={false}
              />
            );
          })}

          {allHolds.map((hold) => {
            const holdId = hold.id as string;
            const currentType = routeHolds[holdId] || 'unassigned';
            const isActive = currentType !== 'unassigned';
            const box = toPixels(hold);

            if ((isViewOnly && !isActive) || !box) return null;

            return (
              <Rect
                key={holdId}
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                stroke={holdColors[currentType]}
                strokeWidth={2 / scale}
                fill="transparent"
                onClick={() => onHoldClick(holdId)}
                onTap={() => onHoldClick(holdId)}
                onMouseEnter={(e) => {
                  const container = e.target.getStage()?.container();
                  if (container) container.style.cursor = 'pointer';
                }}
                onMouseLeave={(e) => {
                  const container = e.target.getStage()?.container();
                  if (container) container.style.cursor = 'default';
                }}
              />
            );
          })}
        </Layer>

      </Stage>
    </div>
  );
}