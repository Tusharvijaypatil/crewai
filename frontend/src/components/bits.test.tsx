import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ConfidenceMeter, ScoreRing } from './bits'

describe('ConfidenceMeter', () => {
  it.each([
    [92, 'text-emerald-400'],
    [60, 'text-amber-400'],
    [30, 'text-rose-400'],
  ])('value %i renders the number in the matching semantic tone', (value, toneClass) => {
    render(<ConfidenceMeter value={value} />)
    const num = screen.getByText(String(value))
    expect(num).toBeInTheDocument()
    expect(num).toHaveClass(toneClass)
  })

  it('honours an explicit tone override instead of deriving from the value', () => {
    render(<ConfidenceMeter value={20} tone="iris" />)
    expect(screen.getByText('20')).toHaveClass('text-iris-400')
  })

  it('shows a custom label', () => {
    render(<ConfidenceMeter value={80} label="Retrieval" />)
    expect(screen.getByText('Retrieval')).toBeInTheDocument()
  })
})

describe('ScoreRing', () => {
  it('renders the score with the high-confidence tone', () => {
    render(<ScoreRing value={88} />)
    expect(screen.getByText('88')).toHaveClass('text-emerald-400')
  })

  it('renders a low score with the danger tone', () => {
    render(<ScoreRing value={32} />)
    expect(screen.getByText('32')).toHaveClass('text-rose-400')
  })
})
