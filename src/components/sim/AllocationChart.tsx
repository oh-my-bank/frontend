import { useId } from 'react'
import { won } from '../../lib/format'
import type { AllocationSegment } from '../../lib/strategy'
import '../../styles/simulation.css'

const allocatedColors = ['#008577', '#1f5149', '#3fa595', '#6e9c4f', '#2c7a8c']

/** Horizontal bar of the monthly plan with a legend and a table carrying the same numbers. */
export default function AllocationChart({ segments }: { segments: AllocationSegment[] }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const total = segments.reduce((sum, segment) => sum + segment.amount, 0)
  if (!total) return <p className="sim-empty-note">이번 계획에는 매월 나눌 여유자금이 없습니다.</p>
  const shortfall = segments
    .filter((segment) => segment.kind === 'shortfall')
    .reduce((sum, segment) => sum + segment.amount, 0)
  let allocatedIndex = 0
  let x = 0
  const bars = segments.map((segment) => {
    const width = (segment.amount / total) * 1000
    const fill =
      segment.kind === 'allocated'
        ? allocatedColors[allocatedIndex++ % allocatedColors.length]
        : segment.kind === 'unallocated'
          ? '#cfe6de'
          : `url(#${id}-hatch)`
    const bar = { ...segment, x, width, fill }
    x += width
    return bar
  })
  const boundary = ((total - shortfall) / total) * 1000
  const percent = (amount: number) =>
    `${((amount / total) * 100).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%`
  return (
    <div className="sim-chart">
      <svg
        className="sim-chart-bar"
        viewBox="0 0 1000 40"
        preserveAspectRatio="none"
        role="img"
        aria-labelledby={`${id}-title ${id}-desc`}
      >
        <title id={`${id}-title`}>월 배분 막대</title>
        <desc id={`${id}-desc`}>
          {bars.map((bar) => `${bar.label} ${won(bar.amount)}`).join(', ')}
        </desc>
        <defs>
          <pattern
            id={`${id}-hatch`}
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="10" height="10" fill="#fbebe6" />
            <line x1="0" y1="0" x2="0" y2="10" stroke="#b04a3c" strokeWidth="4" />
          </pattern>
        </defs>
        {bars.map((bar) => (
          <rect key={bar.key} x={bar.x} y="0" width={bar.width} height="40" fill={bar.fill} />
        ))}
        {shortfall > 0 && (
          <line
            x1={boundary}
            x2={boundary}
            y1="0"
            y2="40"
            stroke="#252b2a"
            strokeWidth="3"
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      {shortfall > 0 && (
        <p className="sim-chart-caption">
          점선 왼쪽이 월 여유자금, 오른쪽 빗금은 목표를 채우기에 모자란 월 금액입니다.
        </p>
      )}
      <ul className="sim-legend">
        {bars.map((bar) => (
          <li key={bar.key}>
            <svg className="sim-legend-swatch" viewBox="0 0 14 14" aria-hidden="true">
              <rect width="14" height="14" rx="2" fill={bar.fill} />
            </svg>
            <span>{bar.label}</span>
            <strong>{won(bar.amount)}</strong>
          </li>
        ))}
      </ul>
      <div className="sim-table-wrap">
        <table className="sim-table">
          <caption className="sim-sr-only">월 배분 표</caption>
          <thead>
            <tr>
              <th scope="col">항목</th>
              <th scope="col">구분</th>
              <th scope="col" className="sim-number">
                월 금액
              </th>
              <th scope="col" className="sim-number">
                비율
              </th>
            </tr>
          </thead>
          <tbody>
            {bars.map((bar) => (
              <tr key={bar.key}>
                <th scope="row" data-label="항목">
                  {bar.label}
                </th>
                <td data-label="구분">
                  {bar.kind === 'allocated'
                    ? '배분'
                    : bar.kind === 'unallocated'
                      ? '미배분'
                      : '부족'}
                </td>
                <td data-label="월 금액" className="sim-number">
                  {won(bar.amount)}
                </td>
                <td data-label="비율" className="sim-number">
                  {percent(bar.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
