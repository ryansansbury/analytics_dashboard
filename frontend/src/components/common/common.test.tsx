import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary, ErrorMessage } from './ErrorBoundary'
import { Loading, LoadingCard, LoadingChart } from './Loading'

describe('Loading', () => {
  it('renders a spinner', () => {
    const { container } = render(<Loading />)
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('renders optional text', () => {
    render(<Loading text="Fetching revenue" />)
    expect(screen.getByText('Fetching revenue')).toBeInTheDocument()
  })

  it('omits the text node entirely when none is given', () => {
    const { container } = render(<Loading />)
    expect(container.querySelector('p')).not.toBeInTheDocument()
  })

  it.each([
    ['sm', 'h-4'],
    ['md', 'h-8'],
    ['lg', 'h-12'],
  ] as const)('applies the %s size', (size, expected) => {
    const { container } = render(<Loading size={size} />)
    expect(container.querySelector('.animate-spin')?.className).toContain(expected)
  })

  it('defaults to medium', () => {
    const { container } = render(<Loading />)
    expect(container.querySelector('.animate-spin')?.className).toContain('h-8')
  })

  it('LoadingCard and LoadingChart render skeletons', () => {
    const card = render(<LoadingCard />)
    expect(card.container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    card.unmount()

    const chart = render(<LoadingChart />)
    expect(chart.container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('LoadingChart honours a custom height', () => {
    const { container } = render(<LoadingChart height={500} />)
    expect(container.innerHTML).toContain('500')
  })
})

describe('ErrorMessage', () => {
  it('renders the message and a default title', () => {
    render(<ErrorMessage message="Could not load forecast" />)
    expect(screen.getByText('Error')).toBeInTheDocument()
    expect(screen.getByText('Could not load forecast')).toBeInTheDocument()
  })

  it('accepts a custom title', () => {
    render(<ErrorMessage title="Forecast unavailable" message="No model" />)
    expect(screen.getByText('Forecast unavailable')).toBeInTheDocument()
  })

  it('shows a retry button only when a handler is supplied', async () => {
    const { unmount } = render(<ErrorMessage message="boom" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    unmount()

    const onRetry = vi.fn()
    render(<ErrorMessage message="boom" onRetry={onRetry} />)
    await userEvent.setup().click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})

describe('ErrorBoundary', () => {
  function Boom({ shouldThrow }: { shouldThrow: boolean }) {
    if (shouldThrow) throw new Error('Chart exploded')
    return <div>Chart rendered</div>
  }

  beforeEach(() => {
    // React logs the caught error to console.error. Silence it so a passing
    // run stays readable.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={false} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Chart rendered')).toBeInTheDocument()
  })

  it('catches a render error and shows the message', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Chart exploded')).toBeInTheDocument()
  })

  it('one failing panel does not take down the rest of the page', () => {
    render(
      <div>
        <ErrorBoundary>
          <Boom shouldThrow />
        </ErrorBoundary>
        <div>Sibling panel</div>
      </div>
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Sibling panel')).toBeInTheDocument()
  })

  it('renders a custom fallback instead of the default', () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <Boom shouldThrow />
      </ErrorBoundary>
    )
    expect(screen.getByText('Custom fallback')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })

  it('recovers when retry is pressed and the child no longer throws', async () => {
    const user = userEvent.setup()
    function Harness() {
      return (
        <ErrorBoundary>
          <Boom shouldThrow={false} />
        </ErrorBoundary>
      )
    }
    const { rerender } = render(
      <ErrorBoundary>
        <Boom shouldThrow />
      </ErrorBoundary>
    )
    await user.click(screen.getByRole('button', { name: /try again/i }))
    rerender(<Harness />)
    expect(screen.getByText('Chart rendered')).toBeInTheDocument()
  })

  it('falls back to generic copy when the error carries no message', () => {
    function Blank(): never {
      throw new Error('')
    }
    render(
      <ErrorBoundary>
        <Blank />
      </ErrorBoundary>
    )
    expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument()
  })
})
