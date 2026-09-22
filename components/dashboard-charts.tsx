"use client"

import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { formatCompactCurrency } from "@/lib/format"
import { campaigns, monthlyPerformance } from "@/lib/mock-data"

const trendConfig = {
  collections: {
    label: "Collections",
    color: "var(--chart-1)",
  },
  outstandingDues: {
    label: "Outstanding dues",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig

const SERVICE_LABELS: Record<string, string> = {
  "WhatsApp API": "WhatsApp",
  "Voice/OBD": "Voice/OBD",
}

const revenueByService = Object.entries(
  campaigns.reduce<Record<string, number>>((acc, campaign) => {
    acc[campaign.service] = (acc[campaign.service] ?? 0) + campaign.agreedAmount
    return acc
  }, {})
).map(([service, revenue]) => ({ service: SERVICE_LABELS[service] ?? service, revenue }))

const revenueConfig = {
  revenue: {
    label: "Agreed amount",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

export function CollectionsTrendChart() {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Collections vs outstanding dues</CardTitle>
        <CardDescription>Monthly trend for the last 6 months.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={trendConfig} className="aspect-auto h-[280px] w-full">
          <AreaChart data={monthlyPerformance} margin={{ left: 0, right: 12 }}>
            <defs>
              <linearGradient id="fillCollections" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="fillDues" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-3)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={56}
              tickFormatter={(value: number) => formatCompactCurrency(value)}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  formatter={(value, name) => [
                    ` ${formatCompactCurrency(Number(value))}`,
                    trendConfig[name as keyof typeof trendConfig]?.label ?? name,
                  ]}
                />
              }
            />
            <Area
              dataKey="collections"
              type="monotone"
              fill="url(#fillCollections)"
              stroke="var(--chart-1)"
              strokeWidth={2}
            />
            <Area
              dataKey="outstandingDues"
              type="monotone"
              fill="url(#fillDues)"
              stroke="var(--chart-3)"
              strokeWidth={2}
            />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export function ServiceRevenueChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue by service</CardTitle>
        <CardDescription>Agreed amount across active campaigns.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={revenueConfig} className="aspect-auto h-[280px] w-full">
          <BarChart data={revenueByService} margin={{ left: 0, right: 12, bottom: 16 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="service"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={48}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={56}
              tickFormatter={(value: number) => formatCompactCurrency(value)}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  formatter={(value) => [
                    ` ${formatCompactCurrency(Number(value))}`,
                    "Agreed amount",
                  ]}
                />
              }
            />
            <Bar dataKey="revenue" fill="var(--chart-2)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
