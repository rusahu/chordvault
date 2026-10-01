import { fireEvent, render, screen } from '@testing-library/react';
import { MultiTagSelect } from '../MultiTagSelect';

describe('MultiTagSelect', () => {
  it('selects multiple tags and clears them', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <MultiTagSelect options={['Romantic', 'Acoustic']} selected={[]} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /All tags/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Romantic' }));
    expect(onChange).toHaveBeenLastCalledWith(['Romantic']);

    rerender(<MultiTagSelect options={['Romantic', 'Acoustic']} selected={['Romantic']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Acoustic' }));
    expect(onChange).toHaveBeenLastCalledWith(['Romantic', 'Acoustic']);
    fireEvent.click(screen.getByRole('button', { name: 'Clear tags' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('closes when clicking outside', () => {
    render(<MultiTagSelect options={['Romantic']} selected={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /All tags/ }));
    expect(screen.getByRole('checkbox', { name: 'Romantic' })).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('checkbox', { name: 'Romantic' })).not.toBeInTheDocument();
  });
});
