import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DataTable } from './DataTable'

type Row = Record<string, unknown> & {
  id: number
  name: string
  revenue: number
  segment: string
}

const rows: Row[] = [
  { id: 1, name: 'Beta Corp', revenue: 5000, segment: 'smb' },
  { id: 2, name: 'Alpha Inc', revenue: 15000, segment: 'enterprise' },
  { id: 3, name: 'Gamma LLC', revenue: 10000, segment: 'mid-market' },
]

const columns = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'revenue', header: 'Revenue', sortable: true, align: 'right' as const },
  { key: 'segment', header: 'Segment' },
]

function renderTable(props: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) {
  return render(
    <DataTable<Row>
      data={rows}
      columns={columns}
      keyExtractor={(r) => r.id}
      {...props}
    />
  )
}

function bodyRowText(): string[] {
  const body = screen.getAllByRole('rowgroup')[1]
  return within(body)
    .getAllByRole('row')
    .map((r) => within(r).getAllByRole('cell')[0].textContent ?? '')
}

describe('DataTable', () => {
  it('renders headers and every row', () => {
    renderTable()
    columns.forEach((c) => expect(screen.getByText(c.header)).toBeInTheDocument())
    rows.forEach((r) => expect(screen.getByText(r.name)).toBeInTheDocument())
  })

  it('shows an empty message instead of an empty table', () => {
    renderTable({ data: [] })
    expect(screen.getByText('No data available')).toBeInTheDocument()
  })

  it('accepts a custom empty message', () => {
    renderTable({ data: [], emptyMessage: 'Nothing at risk' })
    expect(screen.getByText('Nothing at risk')).toBeInTheDocument()
  })

  it('preserves source order until a sort is requested', () => {
    renderTable()
    expect(bodyRowText()).toEqual(['Beta Corp', 'Alpha Inc', 'Gamma LLC'])
  })

  describe('sorting', () => {
    it('sorts ascending on first click', async () => {
      const user = userEvent.setup()
      renderTable()
      await user.click(screen.getByText('Name'))
      expect(bodyRowText()).toEqual(['Alpha Inc', 'Beta Corp', 'Gamma LLC'])
    })

    it('sorts descending on second click', async () => {
      const user = userEvent.setup()
      renderTable()
      await user.click(screen.getByText('Name'))
      await user.click(screen.getByText('Name'))
      expect(bodyRowText()).toEqual(['Gamma LLC', 'Beta Corp', 'Alpha Inc'])
    })

    it('returns to source order on third click', async () => {
      const user = userEvent.setup()
      renderTable()
      const header = screen.getByText('Name')
      await user.click(header)
      await user.click(header)
      await user.click(header)
      expect(bodyRowText()).toEqual(['Beta Corp', 'Alpha Inc', 'Gamma LLC'])
    })

    it('sorts numerically rather than lexicographically', async () => {
      // String sorting would put 10000 before 5000.
      const user = userEvent.setup()
      renderTable()
      await user.click(screen.getByText('Revenue'))
      expect(bodyRowText()).toEqual(['Beta Corp', 'Gamma LLC', 'Alpha Inc'])
    })

    it('ignores clicks on non-sortable columns', async () => {
      const user = userEvent.setup()
      renderTable()
      await user.click(screen.getByText('Segment'))
      expect(bodyRowText()).toEqual(['Beta Corp', 'Alpha Inc', 'Gamma LLC'])
    })

    it('does not mutate the caller data array', async () => {
      const user = userEvent.setup()
      const original = [...rows]
      renderTable()
      await user.click(screen.getByText('Name'))
      expect(rows).toEqual(original)
    })
  })

  describe('cell rendering', () => {
    it('uses a custom renderer when given one', () => {
      renderTable({
        columns: [
          {
            key: 'revenue',
            header: 'Revenue',
            render: (value) => <span data-testid="money">${String(value)}</span>,
          },
        ],
      })
      expect(screen.getAllByTestId('money')).toHaveLength(3)
      expect(screen.getByText('$5000')).toBeInTheDocument()
    })

    it('renders null and undefined as empty rather than the literal text', () => {
      render(
        <DataTable<Row>
          data={[{ id: 1, name: 'X', revenue: 0, segment: undefined as never }]}
          columns={[{ key: 'segment', header: 'Segment' }]}
          keyExtractor={(r) => r.id}
        />
      )
      expect(screen.queryByText('undefined')).not.toBeInTheDocument()
      expect(screen.queryByText('null')).not.toBeInTheDocument()
    })
  })

  describe('row interaction', () => {
    it('calls onRowClick with the row', async () => {
      const user = userEvent.setup()
      const onRowClick = vi.fn()
      renderTable({ onRowClick })
      await user.click(screen.getByText('Alpha Inc'))
      expect(onRowClick).toHaveBeenCalledWith(rows[1])
    })

    it('does not attach a handler when none is given', async () => {
      const user = userEvent.setup()
      renderTable()
      await user.click(screen.getByText('Alpha Inc'))
      // Nothing to assert beyond not throwing; a missing guard would crash here.
      expect(screen.getByText('Alpha Inc')).toBeInTheDocument()
    })
  })

  it('renders one row per key without collisions', () => {
    renderTable()
    const body = screen.getAllByRole('rowgroup')[1]
    expect(within(body).getAllByRole('row')).toHaveLength(rows.length)
  })
})
