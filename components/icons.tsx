import type { SVGProps } from "react"
import {
  Alarm1Stroke,
  ArrowLeftStroke,
  ArrowRightCircleStroke,
  BarChart4Stroke,
  Bell1Stroke,
  Buildings1Stroke,
  CalendarDaysStroke,
  CheckCircle1Stroke,
  CheckStroke,
  ChevronDownStroke,
  ChevronRightStroke,
  ChevronUpStroke,
  ClipboardStroke,
  CreditCardMultipleStroke,
  DashboardSquare1Stroke,
  Download1Stroke,
  EyeStroke,
  FileMultipleStroke,
  Gear1Stroke,
  HandStopStroke,
  HandTakingDollarStroke,
  HourglassStroke,
  Key1Stroke,
  Layers1Stroke,
  Locked1Stroke,
  Locked2Stroke,
  Megaphone1Stroke,
  MenuHamburger1Stroke,
  MenuMeatballs1Stroke,
  MinusCircleStroke,
  MinusStroke,
  Pencil1Stroke,
  PieChart2Stroke,
  PlusStroke,
  QuestionMarkCircleStroke,
  RefreshCircle1ClockwiseStroke,
  RupeeStroke,
  Search1Stroke,
  Shield2Stroke,
  StopwatchStroke,
  TargetUserStroke,
  Telephone1Stroke,
  Telephone3Stroke,
  ThumbsDown3Stroke,
  ThumbsUp3Stroke,
  Trash3Stroke,
  TrendUp1Stroke,
  TruckDelivery1Stroke,
  Upload1Stroke,
  User4Stroke,
  UserMultiple4Stroke,
  Wallet1Stroke,
  XmarkCircleStroke,
  XmarkStroke,
} from "@/components/lineicons-data"
import type { IconData } from "@/components/lineicons-data"
import { cn } from "@/lib/utils"

// The project's single icon set: Lineicons (free, "stroke" style), exposed
// under the names the UI already uses so every import comes from here.
// Icon data lives in lineicons-data.ts, generated from @lineiconshq/free-icons
// by scripts/sync-lineicons.mjs (rerun it after adding an icon below).
// Rendering mirrors @lineiconshq/react-lineicons but without hooks, so the
// icons work in Server Components as well as Client Components.

export type IconProps = Omit<SVGProps<SVGSVGElement>, "dangerouslySetInnerHTML"> & {
  size?: number | string
  strokeWidth?: number
}

export type IconComponent = (props: IconProps) => React.JSX.Element

function icon(data: IconData, displayName: string): IconComponent {
  const markup = data.svg
    .replace(/fill="\{color\}"/g, 'fill="currentColor"')
    .replace(/stroke="\{color\}"/g, 'stroke="currentColor"')

  function Icon({ size = 24, strokeWidth = 1.75, className, children, ...props }: IconProps) {
    const html = data.hasStrokeWidth
      ? markup.replace(/stroke-width="\{strokeWidth\}"/g, `stroke-width="${strokeWidth}"`)
      : markup
    // The paths go in a <g> so the <svg> itself can still take children —
    // some UI primitives pass children to their icon, and React forbids
    // children alongside dangerouslySetInnerHTML on the same element.
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox={data.viewBox}
        fill={data.defaultFill ?? "none"}
        aria-hidden="true"
        focusable="false"
        className={cn("shrink-0", className)}
        {...props}
      >
        <g dangerouslySetInnerHTML={{ __html: html }} />
        {children}
      </svg>
    )
  }
  Icon.displayName = displayName
  return Icon
}

// Navigation & layout
export const LayoutDashboard = icon(DashboardSquare1Stroke, "LayoutDashboard")
export const PanelLeftIcon = icon(MenuHamburger1Stroke, "PanelLeftIcon")
export const Settings = icon(Gear1Stroke, "Settings")
export const MoreHorizontalIcon = icon(MenuMeatballs1Stroke, "MoreHorizontalIcon")

// Arrows & chevrons
export const ArrowLeft = icon(ArrowLeftStroke, "ArrowLeft")
export const ArrowRightCircle = icon(ArrowRightCircleStroke, "ArrowRightCircle")
export const ChevronDown = icon(ChevronDownStroke, "ChevronDown")
export const ChevronDownIcon = ChevronDown
export const ChevronRight = icon(ChevronRightStroke, "ChevronRight")
export const ChevronRightIcon = ChevronRight
export const ChevronUpIcon = icon(ChevronUpStroke, "ChevronUpIcon")

// Actions
export const Plus = icon(PlusStroke, "Plus")
export const Minus = icon(MinusStroke, "Minus")
export const Check = icon(CheckStroke, "Check")
export const CheckIcon = Check
export const X = icon(XmarkStroke, "X")
export const XIcon = X
export const Search = icon(Search1Stroke, "Search")
export const SearchIcon = Search
export const Pencil = icon(Pencil1Stroke, "Pencil")
export const Trash2 = icon(Trash3Stroke, "Trash2")
export const Download = icon(Download1Stroke, "Download")
export const Upload = icon(Upload1Stroke, "Upload")
export const RefreshCw = icon(RefreshCircle1ClockwiseStroke, "RefreshCw")
export const Eye = icon(EyeStroke, "Eye")
export const EyeOff = icon(Locked2Stroke, "EyeOff")

// Status
export const CheckCircle2 = icon(CheckCircle1Stroke, "CheckCircle2")
export const XCircle = icon(XmarkCircleStroke, "XCircle")
export const AlertTriangle = icon(HandStopStroke, "AlertTriangle")
export const Info = icon(QuestionMarkCircleStroke, "Info")
export const ShieldAlert = icon(Shield2Stroke, "ShieldAlert")
export const Lock = icon(Locked1Stroke, "Lock")
export const KeyRound = icon(Key1Stroke, "KeyRound")
export const Bell = icon(Bell1Stroke, "Bell")
export const CircleDot = icon(PieChart2Stroke, "CircleDot")
export const CircleDashed = icon(MinusCircleStroke, "CircleDashed")

// Time
export const Clock = icon(StopwatchStroke, "Clock")
export const AlarmClock = icon(Alarm1Stroke, "AlarmClock")
export const Hourglass = icon(HourglassStroke, "Hourglass")
export const History = icon(RefreshCircle1ClockwiseStroke, "History")
export const CalendarRange = icon(CalendarDaysStroke, "CalendarRange")
export const CalendarCheck = CalendarRange
export const CalendarClock = CalendarRange

// Money
export const IndianRupee = icon(RupeeStroke, "IndianRupee")
export const Wallet = icon(Wallet1Stroke, "Wallet")
export const Banknote = Wallet
export const PiggyBank = icon(HandTakingDollarStroke, "PiggyBank")
export const CreditCard = icon(CreditCardMultipleStroke, "CreditCard")
export const Receipt = icon(FileMultipleStroke, "Receipt")
export const ReceiptText = icon(ClipboardStroke, "ReceiptText")

// Charts
export const BarChart3 = icon(BarChart4Stroke, "BarChart3")
export const LineChart = icon(TrendUp1Stroke, "LineChart")
export const TrendingUp = LineChart

// People & business
export const Users = icon(UserMultiple4Stroke, "Users")
export const Users2 = Users
export const UserCheck = icon(User4Stroke, "UserCheck")
export const UserCog = icon(TargetUserStroke, "UserCog")
export const Building2 = icon(Buildings1Stroke, "Building2")
export const Truck = icon(TruckDelivery1Stroke, "Truck")
export const Megaphone = icon(Megaphone1Stroke, "Megaphone")
export const Layers = icon(Layers1Stroke, "Layers")

// Calls
export const Phone = icon(Telephone1Stroke, "Phone")
export const PhoneCall = icon(Telephone3Stroke, "PhoneCall")
export const ThumbsUp = icon(ThumbsUp3Stroke, "ThumbsUp")
export const ThumbsDown = icon(ThumbsDown3Stroke, "ThumbsDown")
