import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"


interface MobileRouteBuilderProps {
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  routeName: string;
  setRouteName: (name: string) => void;
  routeGrade: string;
  setRouteGrade: (grade: string) => void;
  handleSaveRoute: () => void;
  isSubmitting: boolean;
}
export default function MobileRouteBuilder({
  isDrawerOpen,
  setIsDrawerOpen,
  routeName,
  setRouteName,
  routeGrade,
  setRouteGrade,
  handleSaveRoute,
  isSubmitting,
}: MobileRouteBuilderProps) {

  return (
    <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
      <DrawerTrigger asChild>
        <Button
          size="lg"
          className="absolute bottom-6 right-6 z-50 rounded-full shadow-lg h-14 w-14 bg-white hover:bg-gray-200"
        >
          <Save className="h-6 w-6" color='black' />
        </Button>
      </DrawerTrigger>

      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle>Save New Route</DrawerTitle>
            <DrawerDescription>
              Name your problem and suggest a grade.
            </DrawerDescription>
          </DrawerHeader>

          <div className="p-4 pb-0 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Route Name</Label>
              <Input
                id="name"
                placeholder="e.g. The Pink One"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                className=""
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grade">Grade</Label>
              <Select
                onValueChange={setRouteGrade}
                value={routeGrade}
                defaultValue='V0'
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Select a grade" />
                </SelectTrigger>
                <SelectContent className='w-10'>
                  {Array.from({ length: 18 }, (_, i) => 'V' + String(i)).map(grade => {
                    return (
                      <SelectItem key={grade} value={grade} className='pl-4' >
                        {grade}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DrawerFooter>
            <Button
              onClick={handleSaveRoute}
              className="w-full"
              disabled={isSubmitting || routeName === '' || routeGrade === ''}
            >
              {isSubmitting ? (
                <div className='flex gap-2'>
                  <Loader2 />
                  <p>Submitting...</p>
                </div>
              ) : (
                <p>Publish Route</p>
              )}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline" className="w-full">
                Cancel
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}


