import { useState } from 'react'
import { BookOpen, Info, TriangleAlert } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { HudPanel } from '@/hud/HudFrame'

/** The restyled shadcn/ui primitives, for everything the HUD kit does not cover. */
export function KitPrimitives() {
  const [slider, setSlider] = useState([35])
  const [sw, setSw] = useState(true)
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <HudPanel index="07" title="Buttons and badges">
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Do not use</Button>
          <Button variant="link">Link</Button>
          <Button size="icon" variant="outline" aria-label="Open the glossary">
            <BookOpen aria-hidden />
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge>LPV</Badge>
          <Badge variant="secondary">LNAV/VNAV</Badge>
          <Badge variant="outline">LNAV</Badge>
          <Badge variant="destructive">Unavailable</Badge>
        </div>
      </HudPanel>

      <HudPanel index="08" title="Overlays">
        <div className="flex flex-wrap gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">Tooltip</Button>
            </TooltipTrigger>
            <TooltipContent>Protection level: how far off the position could be, with very high confidence.</TooltipContent>
          </Tooltip>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">Popover</Button>
            </PopoverTrigger>
            <PopoverContent>
              <PopoverHeader>
                <PopoverTitle>Alert limit</PopoverTitle>
                <PopoverDescription>The largest protection level the operation allows.</PopoverDescription>
              </PopoverHeader>
            </PopoverContent>
          </Popover>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Sheet</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Glossary</SheetTitle>
                <SheetDescription>Every term on the page arrives here in Stage 4.</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
        </div>
        <p className="mt-4 text-[13px] text-muted-foreground">
          Keys: <Kbd>←</Kbd> <Kbd>→</Kbd> move along the timeline, <Kbd>Home</Kbd> <Kbd>End</Kbd> jump to the ends.
        </p>
      </HudPanel>

      <HudPanel index="09" title="Inputs">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="kit-select">Minima</Label>
            <Select defaultValue="lpv">
              <SelectTrigger id="kit-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lpv200">LPV-200</SelectItem>
                <SelectItem value="lpv">LPV</SelectItem>
                <SelectItem value="lnavvnav">LNAV/VNAV</SelectItem>
                <SelectItem value="lnav">LNAV</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="kit-input">Callsign</Label>
            <Input id="kit-input" defaultValue="LAB201" />
          </div>
          <div className="flex flex-col gap-3">
            <Label id="kit-slider-l">Brass slider: {slider[0]} m</Label>
            <Slider aria-labelledby="kit-slider-l" value={slider} onValueChange={setSlider} min={0} max={50} step={1} />
          </div>
          <div className="flex items-center gap-3">
            <Switch id="kit-switch" checked={sw} onCheckedChange={setSw} />
            <Label htmlFor="kit-switch">Sound captions</Label>
          </div>
          <RadioGroup defaultValue="a" aria-label="Quiz answer">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="a" id="kit-r1" />
              <Label htmlFor="kit-r1">It corrects the GPS errors</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="b" id="kit-r2" />
              <Label htmlFor="kit-r2">It replaces GPS</Label>
            </div>
          </RadioGroup>
        </div>
      </HudPanel>

      <HudPanel index="10" title="Tabs (phone panels)">
        <Tabs defaultValue="now">
          <TabsList className="w-full">
            <TabsTrigger value="now">Now</TabsTrigger>
            <TabsTrigger value="cockpit">Cockpit</TabsTrigger>
            <TabsTrigger value="signals">Signals</TabsTrigger>
            <TabsTrigger value="break">Break it</TabsTrigger>
          </TabsList>
          <TabsContent value="now" className="pt-3 text-[13px] text-muted-foreground">
            At 390 px the panels sit below the view in these four tabs.
          </TabsContent>
          <TabsContent value="cockpit" className="pt-3 text-[13px] text-muted-foreground">
            The CDI and the protection bars.
          </TabsContent>
          <TabsContent value="signals" className="pt-3 text-[13px] text-muted-foreground">
            The message log and the Stanford chart.
          </TabsContent>
          <TabsContent value="break" className="pt-3 text-[13px] text-muted-foreground">
            The failure switches.
          </TabsContent>
        </Tabs>
        <div className="mt-4 flex flex-col gap-2">
          <span className="hud-label">Loading</span>
          <Progress value={62} aria-label="Loading the 3D stage, 62 percent" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </HudPanel>

      <HudPanel index="11" title="Alerts and disclosure">
        <div className="flex flex-col gap-3">
          <Alert>
            <Info aria-hidden />
            <AlertTitle>Made up for this fictional region</AlertTitle>
            <AlertDescription>Stations, airports and frequencies are fictional.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <TriangleAlert aria-hidden />
            <AlertTitle>LPV lost</AlertTitle>
            <AlertDescription>An alarm style, used only for failures.</AlertDescription>
          </Alert>
          <Accordion type="single" collapsible>
            <AccordionItem value="deeper">
              <AccordionTrigger>Go deeper</AccordionTrigger>
              <AccordionContent>
                <p className="formula">VPL = K_V · d_V</p>
                <p className="text-[13px] text-muted-foreground">Formulas appear only inside Go deeper drawers.</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </HudPanel>

      <HudPanel index="12" title="Table" bodyClassName="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Operation</TableHead>
              <TableHead className="text-right">HAL</TableHead>
              <TableHead className="text-right">VAL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>LPV-200</TableCell>
              <TableCell className="hud-value text-right">40 m</TableCell>
              <TableCell className="hud-value text-right">35 m</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>LPV (APV-I)</TableCell>
              <TableCell className="hud-value text-right">40 m</TableCell>
              <TableCell className="hud-value text-right">50 m</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <p className="px-4 py-3 text-[12px] text-muted-foreground">ICAO Annex 10 Vol I, Table 3.7.2.4-1.</p>
      </HudPanel>
    </div>
  )
}
