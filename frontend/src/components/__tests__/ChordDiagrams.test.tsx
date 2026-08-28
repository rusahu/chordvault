import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChordDiagrams } from '../ChordDiagrams';
import { TestWrapper } from '../../test/wrappers';

vi.mock('../../context/I18nContext', () => ({
  useI18n: () => ({ t: (_key: string, fallback?: string) => fallback || _key }),
}));

vi.mock('svguitar', () => ({
  SVGuitarChord: class {
    constructor(container: HTMLElement) { container.innerHTML = '<svg></svg>'; }
    configure() { return this; }
    chord() { return this; }
    draw() { return { width: 100, height: 100 }; }
    remove() {}
  },
}));

describe('ChordDiagrams', () => {
  const values = new Map<string, string>();
  beforeEach(() => {
    values.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      clear: () => values.clear(),
    });
  });

  it('renders nothing without chords', () => {
    const { container } = render(<ChordDiagrams chords={[]} />, { wrapper: TestWrapper });
    expect(container).toBeEmptyDOMElement();
  });

  it('starts collapsed and persists expansion', () => {
    render(<ChordDiagrams chords={['C', 'Am']} />, { wrapper: TestWrapper });
    const toggle = screen.getByRole('button', { name: /Chords used/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(localStorage.getItem('cv_chord_diagrams_expanded')).toBe('true');
    expect(document.querySelectorAll('.chord-diagram-card')).toHaveLength(2);
  });

  it('shows a labeled fallback for unsupported chords', () => {
    localStorage.setItem('cv_chord_diagrams_expanded', 'true');
    render(<ChordDiagrams chords={['Cadd#11/nope']} />, { wrapper: TestWrapper });
    expect(screen.getByText('Cadd#11/nope')).toBeInTheDocument();
    expect(screen.getByText('Fingering unavailable')).toBeInTheDocument();
  });
});
