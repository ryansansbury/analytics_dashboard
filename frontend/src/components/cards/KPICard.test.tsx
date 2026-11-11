import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { KPICard, KPIGrid } from './KPICard'

describe('KPICard', () => {
  it('renders the label and a compact value', () => {
    render(<KPICard label="Revenue" value={1_200_000} format="currency" />)
    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('$1.2M')).toBeInTheDocument()
  })

  it('formats by the requested type', () => {
    const { rerender } = render(<KPICard label="Count" value={2500} format="number" />)
    expect(screen.getByText('2.5K')).toBeInTheDocument()

    rerender(<KPICard label="Rate" value={91.25} format="percent" />)
    expect(screen.getByText('91.3%')).toBeInTheDocument()
  })

  it('defaults to number formatting', () => {
    render(<KPICard label="Things" value={1500} />)
    expect(screen.getByText('1.5K')).toBeInTheDocument()
  })

  describe('the change badge', () => {
    it('shows a positive delta with a sign', () => {
      render(<KPICard label="Revenue" value={100} changePercent={12.3} />)
      expect(screen.getByText('+12.3%')).toBeInTheDocument()
    })

    it('shows a negative delta with its minus sign', () => {
      /*
       * Regression test. The badge used to print the absolute value through a
       * formatter that prefixes "+", so a fall of 8.5% read "+8.5%" beside a
       * down arrow, and the number contradicted the icon. The sign is the
       * number's; the arrow and colour only repeat it.
       */
      render(<KPICard label="Revenue" value={100} changePercent={-8.5} />)
      expect(screen.getByText('-8.5%')).toBeInTheDocument()
      expect(screen.queryByText('+8.5%')).not.toBeInTheDocument()
    })

    it('reads a fall as good news when down is good', () => {
      render(<KPICard label="Sales cycle" value={40} changePercent={-6} invert />)
      expect(screen.getByText('-6.0%').closest('span')).toHaveClass('text-success')
    })

    it('reads a rise as bad news when down is good', () => {
      render(<KPICard label="Sales cycle" value={40} changePercent={6} invert />)
      expect(screen.getByText('+6.0%').closest('span')).toHaveClass('text-danger')
    })

    it('prints percentage points for a figure that is already a percentage', () => {
      render(<KPICard label="Win rate" value={20} format="percent" changePercent={-2.4} changeUnit="pts" />)
      expect(screen.getByText('-2.4 pts')).toBeInTheDocument()
    })

    it('is omitted when changePercent is undefined', () => {
      render(<KPICard label="Revenue" value={100} />)
      expect(screen.queryByText(/%$/)).not.toBeInTheDocument()
    })

    it('is omitted when changePercent is null', () => {
      /*
       * Regression test. The API returns null for deltas it cannot compute,
       * because no prior observation exists to difference against. The guard
       * here was `changePercent !== undefined`, and since `null !== undefined`
       * is true, a null delta rendered a "+0.0%" badge with a neutral arrow.
       * That invented a data point the backend had deliberately declined to
       * invent.
       */
      render(<KPICard label="At Risk" value={1630} changePercent={null} />)
      expect(screen.queryByText('+0.0%')).not.toBeInTheDocument()
      expect(screen.queryByText(/%$/)).not.toBeInTheDocument()
    })

    it('still renders a zero delta, which is a real measurement', () => {
      render(<KPICard label="Flat" value={100} changePercent={0} />)
      expect(screen.getByText('0.0%')).toBeInTheDocument()
    })
  })

  it('puts the change beside what it compares against', () => {
    render(<KPICard label="Revenue" value={100} changePercent={4.2} comparison="vs prior 90 days" />)
    expect(screen.getByText('+4.2%').closest('div')).toHaveTextContent('+4.2%vs prior 90 days')
  })

  it('keeps a description on its own line, apart from the change', () => {
    render(
      <KPICard label="Active" value={100} changePercent={4.2} comparison="vs prior 90 days" caption="Placed an order" />,
    )
    expect(screen.getByText('+4.2%').closest('div')).not.toHaveTextContent('Placed an order')
    expect(screen.getByText('Placed an order')).toBeInTheDocument()
  })

  it('draws a sparkline when given a trend', () => {
    render(<KPICard label="Revenue" value={100} trend={[1, 2, 3, 2, 4]} />)
    expect(screen.getByRole('img', { name: 'Revenue trend' })).toBeInTheDocument()
  })

  it('shows days for a duration', () => {
    render(<KPICard label="Sales cycle" value={57.4} format="days" />)
    expect(screen.getByText('57 days')).toBeInTheDocument()
  })

  it('renders a skeleton and no value while loading', () => {
    const { container } = render(
      <KPICard label="Revenue" value={1_200_000} format="currency" loading />
    )
    expect(screen.queryByText('$1.2M')).not.toBeInTheDocument()
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('renders an icon when given one', () => {
    render(<KPICard label="Revenue" value={100} icon={<span data-testid="icon" />} />)
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('applies an extra className', () => {
    const { container } = render(
      <KPICard label="Revenue" value={100} className="custom-class" />
    )
    expect(container.querySelector('.custom-class')).toBeInTheDocument()
  })

  it('handles a zero value without collapsing', () => {
    render(<KPICard label="Empty" value={0} format="currency" />)
    expect(screen.getByText('$0')).toBeInTheDocument()
  })
})

describe('KPIGrid', () => {
  it('renders its children', () => {
    render(
      <KPIGrid>
        <KPICard label="One" value={1} />
        <KPICard label="Two" value={2} />
      </KPIGrid>
    )
    expect(screen.getByText('One')).toBeInTheDocument()
    expect(screen.getByText('Two')).toBeInTheDocument()
  })
})
