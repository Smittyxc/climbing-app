import { BrickWall, Home, Mountain, RouteIcon } from "lucide-react"
import { Link } from "react-router-dom"

const NavMobile = () => {

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t bg-background flex items-center justify-around z-50 pb-safe">
      <Link to="/protected" className="flex flex-col items-center p-2 text-muted-foreground hover:text-primary">
        <Home className="h-5 w-5" />
        <span className="text-[10px] mt-1">Home</span>
      </Link>

      <Link to="/climb" className="flex flex-col items-center p-2 text-muted-foreground hover:text-primary">
        <Mountain className="h-5 w-5" />
        <span className="text-[10px] mt-1">Climb</span>
      </Link>

      <Link to="/boards" className="flex flex-col items-center p-2 text-muted-foreground hover:text-primary">
        <BrickWall className="h-5 w-5" />
        <span className="text-[10px] mt-1">Boards</span>
      </Link>

      <Link to="/routes" className="flex flex-col items-center p-2 text-muted-foreground hover:text-primary">
        <RouteIcon className="h-5 w-5" />
        <span className="text-[10px] mt-1">Routes</span>
      </Link>
    </nav>
  )
}

export default NavMobile
