import { memo, useRef, useImperativeHandle, forwardRef } from 'react'
import html2canvas from 'html2canvas'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, Brush
} from 'recharts'
import type { Dataset } from '../types'

export type ChartPanelProps = {
  type: 'line' | 'bar' | 'area' | 'mixed'
  data: Dataset
  xKey?: keyof Dataset[number]
  yKeys: Array<{ key: keyof Dataset[number]; color?: string; name?: string }>
  height?: number
  syncId?: string
  showBrush?: boolean
}

export type ChartPanelHandle = {
  capture: () => Promise<string | null>
}

function formatXAxis(value: any) {
  return String(value).slice(0, 10)
}

function ChartPanelInner({ type, data, xKey = 'date', yKeys, height = 260, syncId, showBrush = true }: ChartPanelProps, ref: React.Ref<ChartPanelHandle>) {
  const containerRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({
    async capture() {
      const node = containerRef.current
      if (!node) return null
      const el = node.querySelector('svg, canvas') as HTMLElement | null
      const target = el ? el.parentElement as HTMLElement : node
      const canvas = await html2canvas(target, { backgroundColor: '#ffffff', scale: 2, useCORS: true })
      return canvas.toDataURL('image/png')
    }
  }))

  const common = (
    <>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey={xKey as string} tickFormatter={formatXAxis} minTickGap={24} />
      <YAxis />
      <Tooltip />
      <Legend />
      {showBrush && <Brush dataKey={xKey as string} height={20} stroke="#8884d8" travellerWidth={8} />}
    </>
  )

  const renderChart = () => {
    if (type === 'line') {
      return (
        <LineChart data={data} syncId={syncId}>
          {common}
          {yKeys.map((s, i) => (
            <Line key={String(s.key)} type="monotone" dataKey={s.key as string} stroke={s.color || COLORS[i % COLORS.length]} name={s.name || String(s.key)} dot={false} />
          ))}
        </LineChart>
      )
    }
    if (type === 'bar') {
      return (
        <BarChart data={data} syncId={syncId}>
          {common}
          {yKeys.map((s, i) => (
            <Bar key={String(s.key)} dataKey={s.key as string} fill={s.color || COLORS[i % COLORS.length]} name={s.name || String(s.key)} />
          ))}
        </BarChart>
      )
    }
    if (type === 'area') {
      return (
        <AreaChart data={data} syncId={syncId}>
          {common}
          {yKeys.map((s, i) => (
            <Area key={String(s.key)} type="monotone" dataKey={s.key as string} stroke={s.color || COLORS[i % COLORS.length]} fill={s.color || COLORS[i % COLORS.length]} name={s.name || String(s.key)} />
          ))}
        </AreaChart>
      )
    }
    return <Composed data={data} xKey={xKey} yKeys={yKeys} syncId={syncId} showBrush={showBrush} />
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height }}>
      <ResponsiveContainer>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  )
}

function Composed({ data, xKey, yKeys, syncId, showBrush }: { data: Dataset; xKey: keyof Dataset[number]; yKeys: ChartPanelProps['yKeys']; syncId?: string; showBrush?: boolean }) {
  return (
    <LineChart data={data} syncId={syncId}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey={xKey as string} tickFormatter={formatXAxis} minTickGap={24} />
      <YAxis />
      <Tooltip />
      <Legend />
      {showBrush && <Brush dataKey={xKey as string} height={20} stroke="#8884d8" travellerWidth={8} />}
      <Bar dataKey={yKeys[0]?.key as string} fill={yKeys[0]?.color || COLORS[0]} name={yKeys[0]?.name || String(yKeys[0]?.key)} />
      <Line type="monotone" dataKey={yKeys[1]?.key as string} stroke={yKeys[1]?.color || COLORS[1]} dot={false} name={yKeys[1]?.name || String(yKeys[1]?.key)} />
      {yKeys.slice(2).map((s, i) => (
        <Line key={String(s.key)} type="monotone" dataKey={s.key as string} stroke={s.color || COLORS[(i + 2) % COLORS.length]} dot={false} name={s.name || String(s.key)} />
      ))}
    </LineChart>
  )
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#00c49f']

export const ChartPanel = memo(forwardRef(ChartPanelInner))
