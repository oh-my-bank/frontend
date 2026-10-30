import { useId } from 'react'
import { wonText } from '../../lib/format'
import type { Installment } from '../../lib/learning'

export type Tone = 'principal' | 'interest' | 'tax' | 'extra'
export interface Segment {
  label: string
  value: number
  tone: Tone
}
export interface BarRow {
  label: string
  segments: Segment[]
  /** The value drawn as the full bar width. */
  max: number
  marker?: { value: number; label: string }
}

const WIDTH = 1000
const HEIGHT = 34

function TaxPattern({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="#e4ebe7" />
        <path d="M0 10 10 0" stroke="#7d8f86" strokeWidth="2" />
      </pattern>
    </defs>
  )
}
const toneFill: Record<Exclude<Tone, 'tax'>, string> = {
  principal: '#008577',
  interest: '#7fc7b6',
  extra: '#1f5149',
}

/**
 * Horizontal stacked bars of server amounts. Colour is never the only cue: every segment is
 * named in the legend and in each bar's accessible label, and the page shows the same values
 * in a table.
 */
export function StackedBars({
  title,
  rows,
  note,
}: {
  title: string
  rows: BarRow[]
  note?: string
}) {
  const base = useId()
  const legend = new Map<string, Tone>()
  rows.forEach((row) => row.segments.forEach((segment) => legend.set(segment.label, segment.tone)))
  return (
    <figure className="tool-chart" aria-label={title}>
      {rows.map((row, rowIndex) => {
        const patternId = `${base.replace(/[^a-zA-Z0-9_-]/g, '')}-tax-${rowIndex}`
        const offsets = row.segments.reduce<number[]>(
          (list, segment, index) => [
            ...list,
            list[index] + (row.max > 0 ? (segment.value / row.max) * WIDTH : 0),
          ],
          [0],
        )
        const description = row.segments
          .map((segment) => `${segment.label} ${wonText(segment.value)}`)
          .concat(row.marker ? [`${row.marker.label} ${wonText(row.marker.value)}`] : [])
          .join(', ')
        return (
          <div className="tool-chart-row" key={row.label}>
            <span className="tool-chart-label">{row.label}</span>
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={`${row.label}: ${description}`}
            >
              <TaxPattern id={patternId} />
              <rect width={WIDTH} height={HEIGHT} fill="#f2f6f4" />
              {row.segments.map((segment, index) => (
                <rect
                  key={segment.label}
                  x={offsets[index]}
                  width={Math.max(0, offsets[index + 1] - offsets[index])}
                  height={HEIGHT}
                  fill={segment.tone === 'tax' ? `url(#${patternId})` : toneFill[segment.tone]}
                />
              ))}
              {row.marker && row.max > 0 && (
                <line
                  x1={Math.min(WIDTH, (row.marker.value / row.max) * WIDTH)}
                  x2={Math.min(WIDTH, (row.marker.value / row.max) * WIDTH)}
                  y1="0"
                  y2={HEIGHT}
                  stroke="#a75146"
                  strokeWidth="4"
                  strokeDasharray="6 4"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
          </div>
        )
      })}
      <ul className="tool-chart-legend">
        {[...legend].map(([label, tone]) => (
          <li key={label}>
            <span className={`tool-swatch ${tone}`} aria-hidden="true" />
            {label}
          </li>
        ))}
        {rows.some((row) => row.marker) && (
          <li>
            <span className="tool-swatch marker" aria-hidden="true" />
            {rows.find((row) => row.marker)?.marker?.label}
          </li>
        )}
      </ul>
      {note && <p className="tool-chart-note">{note}</p>}
    </figure>
  )
}

/** Each installment as a column of principal (bottom) and interest (top), scaled to the largest payment. */
export function ScheduleChart({
  schedule,
  maxPayment,
}: {
  schedule: Installment[]
  maxPayment: number
}) {
  const bar = 10
  const height = 160
  const width = schedule.length * bar
  const scale = (value: number) => (maxPayment > 0 ? (value / maxPayment) * height : 0)
  const last = schedule[schedule.length - 1]
  return (
    <figure className="tool-chart">
      <figcaption>회차별 납입액 구성(원금·이자)</figcaption>
      <svg
        className="tool-schedule-chart"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`1회차부터 ${schedule.length}회차까지 회차별 납입액. 가장 큰 납입액 ${wonText(maxPayment)}. 회차별 금액은 아래 상환 일정 표에 있습니다.`}
      >
        <rect width={width} height={height} fill="#f2f6f4" />
        {schedule.map((row, index) => {
          const principal = scale(row.principal)
          const interest = scale(row.interest)
          return (
            <g key={row.installment}>
              <rect
                x={index * bar + 1}
                y={height - principal}
                width={bar - 2}
                height={principal}
                fill="#008577"
              />
              <rect
                x={index * bar + 1}
                y={height - principal - interest}
                width={bar - 2}
                height={interest}
                fill="#7fc7b6"
              />
            </g>
          )
        })}
      </svg>
      <div className="tool-schedule-axis" aria-hidden="true">
        <span>1회</span>
        {last && <span>{last.installment}회</span>}
      </div>
      <ul className="tool-chart-legend">
        <li>
          <span className="tool-swatch principal" aria-hidden="true" />
          원금(막대 아래)
        </li>
        <li>
          <span className="tool-swatch interest" aria-hidden="true" />
          이자(막대 위)
        </li>
      </ul>
    </figure>
  )
}
