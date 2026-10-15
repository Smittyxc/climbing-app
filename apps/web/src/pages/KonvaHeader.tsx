import { Button } from "@/components/ui/button";
import { deleteRoute } from "@/api/queries";
import { CheckCircle2, ChevronLeft, Trash2 } from "lucide-react"
import { useMatch, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner";

interface KonvaHeaderProps {
  name: string;
  grade: string;
  isViewOnly: boolean;
  isExistingRoute?: boolean;
}

export default function KonvaHeader({
  name,
  grade,
  isViewOnly,
}: KonvaHeaderProps) {
  const navigate = useNavigate()
  const isNewRoute = useMatch('/routes/:boardId/new')
  const link = isViewOnly ? '/climb' : '/routes'
  const { routeId } = useParams();

  const handleRouteDelete = async () => {
    if (!routeId) return
    try {
      await deleteRoute(routeId)
    } catch {
      toast.error('Failed to delete route')
      return
    }

    toast.success(`Deleted ${name}`)
    navigate('/routes')
  }

  return (
    <header className="fixed top-0 left-0 w-full h-18 bg-gray-950/80 backdrop-blur-md border-b border-gray-800 z-50 grid grid-cols-[1fr_2fr_1fr] items-center px-5 text-white shadow-sm">

      {/* Left Column: Back Button */}
      <div className="flex justify-start">
        <button
          onClick={() => navigate(`${link}`)}
          className="p-2 -ml-2 rounded-full text-gray-300 hover:text-white hover:bg-gray-800 transition-colors flex items-center justify-center"
          aria-label="Go back"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      </div>

      {isViewOnly ? (
        <div className="flex flex-col items-center justify-center text-center truncate">
          <h1 className="text-lg font-bold tracking-wide truncate w-full px-2">
            {name || 'Unknown Route'}
          </h1>
          <span className="text-sm font-semibold text-gray-300 bg-gray-800/80 px-2.5 py-0.5 rounded-md mt-0.5">
            {grade || 'V?'}
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center truncate">

          <h1 className="text-lg font-bold tracking-wide truncate w-full px-2">{isNewRoute ? 'New Route' : 'Edit Route'}</h1>
        </div>
      )}

      {/* Right Column: Log Ascent Button */}
      <div className="flex justify-end">
        {isViewOnly ? (
          <button
            onClick={() => console.log('Future Feature: Log Ascent Modal!')}
            className="p-2 -mr-2 rounded-full text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors flex items-center justify-center"
            aria-label="Log ascent"
            title="Log Ascent"
          >
            <CheckCircle2 className="w-8 h-8" />
          </button>
        ) : isNewRoute ? (
          <div></div>

        ) : (
          <Button
            onClick={handleRouteDelete}
            variant="ghost"
            className="p-2 -mr-2 rounded-full text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center"
            aria-label="Delete route"
            title="Delete Route"
          >
            <Trash2 className="w-6 h-6" />
          </Button>
        )



        }
      </div>
    </header>
  )
}