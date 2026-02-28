'use client'

interface TrendDataPoint {
  date: string
  connections: number
  replies: number
}

interface TrendChartProps {
  data: TrendDataPoint[]
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return DAY_LABELS[d.getDay()]
}

export default function AnalyticsTrendChart({ data }: TrendChartProps) {
  const maxValue = Math.max(...data.flatMap(d => [d.connections, d.replies]), 1)
  const chartHeight = 120

  return (
    <div className="w-full">
      <div className="flex items-end justify-between gap-1" style={{ height: chartHeight + 24 }}>
        {data.map((day, i) => {
          const connH = Math.round((day.connections / maxValue) * chartHeight)
          const replyH = Math.round((day.replies / maxValue) * chartHeight)
          return (
            <div key={i} className="flex flex-col items-center flex-1 gap-1">
              {/* Bars */}
              <div className="flex items-end gap-0.5 w-full justify-center" style={{ height: chartHeight }}>
                {/* Connections bar */}
                <div className="relative group flex-1">
                  <div
                    className="w-full bg-blue-500 rounded-t-sm transition-all hover:bg-blue-600"
                    style={{ height: connH || 2 }}
                    title={`Connections: ${day.connections}`}
                  />
                  {day.connections > 0 && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-1.5 py-0.5 whitespace-nowrap z-10">
                      {day.connections} conn
                    </div>
                  )}
                </div>
                {/* Replies bar */}
                <div className="relative group flex-1">
                  <div
                    className="w-full bg-green-500 rounded-t-sm transition-all hover:bg-green-600"
                    style={{ height: replyH || 2 }}
                    title={`Replies: ${day.replies}`}
                  />
                  {day.replies > 0 && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-1.5 py-0.5 whitespace-nowrap z-10">
                      {day.replies} replies
                    </div>
                  )}
                </div>
              </div>
              {/* X-axis label */}
              <span className="text-xs text-gray-400">{formatDayLabel(day.date)}</span>
            </div>
          )
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 justify-center">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-blue-500" />
          <span className="text-xs text-gray-500">Connections</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-green-500" />
          <span className="text-xs text-gray-500">Replies</span>
        </div>
      </div>
    </div>
  )
}
