import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AreaChart } from './AreaChart'
import { BarChart } from './BarChart'
import { AttainmentBars } from './AttainmentBars'
import { CalendarHeatmap } from './CalendarHeatmap'
import { CohortHeatmap } from './CohortHeatmap'
import { ComparisonChart } from './ComparisonChart'
import { ForecastChart } from './ForecastChart'
import { RankedBars } from './RankedBars'
import { RiskScatter } from './RiskScatter'
import { SankeyChart } from './SankeyChart'
import { SeasonalityChart } from './SeasonalityChart'
import { SmallMultiples } from './SmallMultiples'
import { Sparkline } from './Sparkline'
import { heatStep, quantileThresholds } from './heat'

const series = [
  { date: '2026-01-01', revenue: 50000, orders: 320 },
  { date: '2026-02-01', revenue: 62000, orders: 410 },
  { date: '2026-03-01', revenue: 58000, orders: 380 },
]

const categories = [
  { category: 'Cloud', value: 900000 },
  { category: 'Security', value: 640000 },
  { category: 'Data', value: 410000 },
]


/** Recharts renders into SVG; grab it from the container. */
function svg(container: HTMLElement) {
  return container.querySelector('svg')
}

describe('AreaChart', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <AreaChart data={series} xKey="date" yKeys={['revenue']} height={300} />
    )
    expect(svg(container)).toBeInTheDocument()
  })

  it('draws solid gridlines, never dashed', () => {
    /*
     * Dashing a grid adds noise and reads as "projection" or "threshold" when
     * it is only a grid. The dashes here were 3 3. Dashed *data* lines stay
     * legal, and that is what dashedKeys is for.
     */
    const { container } = render(
      <AreaChart data={series} xKey="date" yKeys={['revenue']} height={300} />
    )
    const grid = container.querySelectorAll('.recharts-cartesian-grid line')
    expect(grid.length).toBeGreaterThan(0)
    grid.forEach((line) => {
      expect(line.getAttribute('stroke-dasharray')).toBeFalsy()
    })
  })

  it('accepts dashedKeys for a forecast series', () => {
    /*
     * Dashed *data* stays legal and signals a projection; only the grid had to
     * go solid.
     *
     * This is a render smoke test rather than an assertion on the stroke.
     * Recharts computes its Area paths from a measured container, and jsdom has
     * no layout engine, so the series paths never reach the DOM here and
     * stroke-dasharray cannot be read back. Asserting on it would produce a
     * test that passes for the wrong reason. The grid-is-solid test above is
     * the one that covers the actual change.
     */
    const { container } = render(
      <AreaChart
        data={series}
        xKey="date"
        yKeys={['revenue', 'orders']}
        dashedKeys={['orders']}
        height={300}
      />
    )
    expect(svg(container)).toBeInTheDocument()
  })

  it('shows a legend once there are two series', () => {
    render(<AreaChart data={series} xKey="date" yKeys={['revenue', 'orders']} height={300} />)
    expect(screen.getByText('revenue')).toBeInTheDocument()
    expect(screen.getByText('orders')).toBeInTheDocument()
  })

  it('omits the legend for a single series', () => {
    // The card title already names it; a one-entry legend is chrome.
    render(<AreaChart data={series} xKey="date" yKeys={['revenue']} height={300} />)
    expect(screen.queryByText('revenue')).not.toBeInTheDocument()
  })
})

describe('BarChart', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <BarChart data={categories} xKey="category" yKeys={['value']} height={300} />
    )
    expect(svg(container)).toBeInTheDocument()
  })

  it('draws solid gridlines', () => {
    const { container } = render(
      <BarChart data={categories} xKey="category" yKeys={['value']} height={300} />
    )
    container.querySelectorAll('.recharts-cartesian-grid line').forEach((line) => {
      expect(line.getAttribute('stroke-dasharray')).toBeFalsy()
    })
  })

  it('renders bar layers for every category', () => {
    const { container } = render(
      <BarChart data={categories} xKey="category" yKeys={['value']} height={300} />
    )
    expect(
      container.querySelectorAll('.recharts-bar-rectangle').length
    ).toBe(categories.length)
  })

  it('accepts the ordinal flag without crashing', () => {
    const { container } = render(
      <BarChart data={categories} xKey="category" yKeys={['value']} ordinal height={300} />
    )
    expect(svg(container)).toBeInTheDocument()
  })
})


describe('AreaChart confidence band', () => {
  const withBand = [
    { date: '2026-05-01', actual: 50000, predicted: null, lowerBound: null, upperBound: null },
    { date: '2026-06-01', actual: 62000, predicted: 62000, lowerBound: null, upperBound: null },
    { date: '2026-07-01', actual: null, predicted: 65000, lowerBound: 60000, upperBound: 70000 },
    { date: '2026-08-01', actual: null, predicted: 68000, lowerBound: 61000, upperBound: 75000 },
  ]

  it('renders with a band supplied', () => {
    /*
     * A render smoke test, not an assertion on the painted band. Recharts
     * computes Area geometry from a measured container and jsdom has no layout
     * engine, so no .recharts-area element reaches the DOM here for a banded or
     * an unbanded chart alike. Counting them would pass for the wrong reason.
     * The band's real verification is the legend test below plus looking at it.
     */
    const { container } = render(
      <AreaChart
        data={withBand}
        xKey="date"
        yKeys={['actual', 'predicted']}
        band={{ lower: 'lowerBound', upper: 'upperBound' }}
        height={300}
      />
    )
    expect(svg(container)).toBeInTheDocument()
  })

  it('renders without a band when none is supplied', () => {
    const { container } = render(
      <AreaChart data={withBand} xKey="date" yKeys={['actual']} height={300} />
    )
    expect(svg(container)).toBeInTheDocument()
  })

  it('tolerates null bounds on measured points', () => {
    // History has no uncertainty to draw, so both bounds are null there.
    expect(() =>
      render(
        <AreaChart
          data={withBand}
          xKey="date"
          yKeys={['actual', 'predicted']}
          band={{ lower: 'lowerBound', upper: 'upperBound' }}
          height={300}
        />
      )
    ).not.toThrow()
  })

  it('keeps the band out of the legend', () => {
    /* The band is context for the forecast, not a series. Giving it a legend
     * entry would imply a third measured thing on the chart. */
    render(
      <AreaChart
        data={withBand}
        xKey="date"
        yKeys={['actual', 'predicted']}
        band={{ lower: 'lowerBound', upper: 'upperBound', label: 'Forecast range' }}
        showLegend
        height={300}
      />
    )
    expect(screen.queryByText('Forecast range')).not.toBeInTheDocument()
  })
})

describe('Sparkline', () => {
  it('draws one path for an unbroken series, plus its fill', () => {
    const { container } = render(<Sparkline values={[1, 3, 2, 5]} label="Revenue trend" />)
    expect(screen.getByRole('img', { name: 'Revenue trend' })).toBeInTheDocument()
    expect(container.querySelectorAll('path').length).toBe(2)
  })

  it('breaks the line at a null instead of dropping to zero', () => {
    const { container } = render(<Sparkline values={[1, 3, null, 2, 5]} />)
    const lines = [...container.querySelectorAll('path')].filter((p) => p.getAttribute('fill') === 'none')
    expect(lines.length).toBe(2)
  })

  it('draws nothing for fewer than two points', () => {
    const { container } = render(<Sparkline values={[4]} />)
    expect(container.querySelector('svg')).toBeNull()
  })
})

describe('RankedBars', () => {
  const rows = [
    { key: 'b', label: 'Beta', value: 20, display: '$20' },
    { key: 'a', label: 'Alpha', value: 50, display: '$50' },
    { key: 'c', label: 'Gamma', value: 5, display: '$5' },
  ]

  it('sorts largest first and labels every bar directly', () => {
    render(<RankedBars rows={rows} />)
    const labels = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(labels[0]).toContain('Alpha')
    expect(labels[2]).toContain('Gamma')
    expect(screen.getByText('$50')).toBeInTheDocument()
  })

  it('keeps a given order for ordered stages', () => {
    render(<RankedBars rows={rows} keepOrder />)
    expect(screen.getAllByRole('listitem')[0].textContent).toContain('Beta')
  })

  it('scales bars against the largest value', () => {
    const { container } = render(<RankedBars rows={rows} />)
    const fills = [...container.querySelectorAll<HTMLElement>('li .rounded-full > div')]
    expect(parseFloat(fills[0].style.width)).toBe(100)
    expect(parseFloat(fills[1].style.width)).toBe(40)
  })
})

describe('heat steps', () => {
  it('puts a value at a threshold in the step above it', () => {
    expect(heatStep(10, [10, 20, 30, 40, 50])).toBe(2)
    expect(heatStep(9.9, [10, 20, 30, 40, 50])).toBe(1)
    expect(heatStep(99, [10, 20, 30, 40, 50])).toBe(6)
  })

  it('splits values into six roughly equal groups', () => {
    const values = Array.from({ length: 600 }, (_, i) => i)
    const t = quantileThresholds(values)
    expect(t).toHaveLength(5)
    const counts = [1, 2, 3, 4, 5, 6].map((s) => values.filter((v) => heatStep(v, t) === s).length)
    counts.forEach((n) => expect(n).toBeGreaterThan(90))
  })
})

describe('CohortHeatmap', () => {
  const cohorts = [
    { cohort: '2026-08-01', label: 'Aug 2026', size: 40, retention: [100, 72.5, 61, null] },
    { cohort: '2026-09-01', label: 'Sep 2026', size: 35, retention: [100, 68.6, null, null] },
  ]

  it('prints month 0 without shading it', () => {
    render(<CohortHeatmap cohorts={cohorts} />)
    const zero = screen.getAllByText('100')[0]
    expect(zero.getAttribute('style')).toBeNull()
  })

  it('shades and labels every measured month', () => {
    render(<CohortHeatmap cohorts={cohorts} />)
    const cell = screen.getByText('73')
    expect(cell.getAttribute('style')).toContain('--color-heat-')
    expect(cell.getAttribute('title')).toContain('72.5%')
  })

  it('leaves months not yet reached empty rather than zero', () => {
    render(<CohortHeatmap cohorts={cohorts} />)
    expect(screen.getAllByLabelText('Not reached yet')).toHaveLength(3)
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })
})

describe('CalendarHeatmap', () => {
  const days = Array.from({ length: 10 }, (_, i) => ({
    date: `2026-11-${String(i + 2).padStart(2, '0')}`,
    week: Math.floor(i / 7),
    weekday: i % 7,
    revenue: i % 7 >= 5 ? 0 : 1000 * (i + 1),
  }))

  it('draws one cell per day', () => {
    const { container } = render(<CalendarHeatmap days={days} />)
    expect(container.querySelectorAll('rect')).toHaveLength(10)
  })

  it('shows a day with no orders as empty, not as the lowest step', () => {
    const { container } = render(<CalendarHeatmap days={days} />)
    const weekend = container.querySelectorAll('rect')[5]
    expect(weekend.getAttribute('fill')).toBe('var(--color-heat-empty)')
  })

  it('names the best day', () => {
    render(<CalendarHeatmap days={days} />)
    expect(screen.getByText(/Highest day Nov 11/)).toBeInTheDocument()
  })
})

describe('AttainmentBars', () => {
  const reps = [
    { id: 1, name: 'Ana', team: 'Enterprise', region: 'Europe', quota: 1e6, periodQuota: 250000, achieved: 300000, deals: 10, attainment: 120 },
    { id: 2, name: 'Ben', team: 'SMB', region: 'Europe', quota: 1e6, periodQuota: 250000, achieved: 200000, deals: 8, attainment: 80 },
    { id: 3, name: 'Cy', team: 'Mid-Market', region: 'Europe', quota: 1e6, periodQuota: 250000, achieved: 250000, deals: 9, attainment: 100 },
  ]

  it('ranks reps by attainment and counts those at or above quota', () => {
    render(<AttainmentBars reps={reps} />)
    const rows = screen.getAllByRole('listitem').filter((li) => li.textContent?.includes('%'))
    expect(rows[0].textContent).toContain('Ana')
    expect(screen.getByText('2', { selector: 'span' })).toBeInTheDocument()
  })

  it('names every team in the legend', () => {
    render(<AttainmentBars reps={reps} />)
    for (const team of ['Enterprise', 'Mid-Market', 'SMB']) {
      expect(screen.getByText(team)).toBeInTheDocument()
    }
  })
})

describe('charts with a legend above the plot', () => {
  it('ComparisonChart names both years', () => {
    const points = [
      { date: '2026-08-03', label: 'Aug 3', previousDate: '2025-08-04', previousLabel: 'Aug 4', current: 10, previous: 8 },
      { date: '2026-08-10', label: 'Aug 10', previousDate: '2025-08-11', previousLabel: 'Aug 11', current: 12, previous: 9 },
    ]
    render(<ComparisonChart data={points} height={300} />)
    expect(screen.getAllByText('This year').length).toBeGreaterThan(0)
    expect(screen.getByText('Same period last year')).toBeInTheDocument()
  })

  it('ForecastChart lists the backtest only when there is one', () => {
    const base = { lowerBound: null, upperBound: null, lower95: null, upper95: null }
    const { rerender } = render(
      <ForecastChart height={300} data={[{ date: '2026-09-01', actual: 5, predicted: null, backtest: 4.8, ...base }]} />,
    )
    expect(screen.getByText('Backtest on held-out months')).toBeInTheDocument()
    rerender(<ForecastChart height={300} data={[{ date: '2026-09-01', actual: 5, predicted: null, backtest: null, ...base }]} />)
    expect(screen.queryByText('Backtest on held-out months')).not.toBeInTheDocument()
  })

  it('RiskScatter shows three segments', () => {
    render(
      <RiskScatter
        height={300}
        threshold={0.5}
        points={[{ id: 1, company: 'Acme', segment: 'smb', riskScore: 0.7, annualRevenue: 50000 }]}
      />,
    )
    for (const s of ['Enterprise', 'Mid-market', 'SMB']) expect(screen.getByText(s)).toBeInTheDocument()
  })

  it('SeasonalityChart explains its two colours', () => {
    render(<SeasonalityChart height={300} data={[{ month: 'Jan', index: 0.9, trend: null }, { month: 'Dec', index: 1.2, trend: null }]} />)
    expect(screen.getByText('Above an average month')).toBeInTheDocument()
    expect(screen.getByText('Below')).toBeInTheDocument()
  })
})

describe('SmallMultiples', () => {
  const data = {
    granularity: 'month' as const,
    keys: ['North America', 'Middle East'],
    points: [
      { date: '2026-09-01', label: 'Sep 2026', 'North America': 100, 'Middle East': 10 },
      { date: '2026-10-01', label: 'Oct 2026', 'North America': 120, 'Middle East': 14 },
    ],
    totals: [
      { region: 'North America', revenue: 220, previous: 200, change: 10 },
      { region: 'Middle East', revenue: 24, previous: 30, change: -20 },
    ],
  }

  it('gives every region a panel with its total and signed change', () => {
    render(<SmallMultiples data={data} monthly />)
    expect(screen.getByText('North America')).toBeInTheDocument()
    expect(screen.getByText('+10.0%')).toBeInTheDocument()
    expect(screen.getByText('-20.0%')).toBeInTheDocument()
  })
})

describe('SankeyChart', () => {
  it('renders the flow without throwing', () => {
    const flow = {
      nodes: ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost', 'Open'].map((name) => ({ name })),
      links: [
        { source: 0, target: 1, value: 6, amount: 600 },
        { source: 0, target: 5, value: 4, amount: 400 },
        { source: 1, target: 2, value: 5, amount: 500 },
        { source: 1, target: 6, value: 1, amount: 100 },
        { source: 2, target: 3, value: 3, amount: 300 },
        { source: 2, target: 5, value: 2, amount: 200 },
        { source: 3, target: 4, value: 2, amount: 200 },
        { source: 3, target: 6, value: 1, amount: 100 },
      ],
      created: 10,
      startDate: '2025-11-07',
      endDate: '2026-11-06',
    }
    expect(() => render(<SankeyChart flow={flow} height={300} />)).not.toThrow()
  })
})
