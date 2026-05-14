import { render, screen, fireEvent } from '@testing-library/react';
import { KeyPicker } from '../KeyPicker';
import { describe, it, expect, vi } from 'vitest';

describe('KeyPicker', () => {
  const onPickKey = vi.fn();
  const onSaveOnline = vi.fn();
  const onSaveLocal = vi.fn();

  it('renders all 12 keys when visible', () => {
    render(<KeyPicker currentKey="G" onPickKey={onPickKey} visible={true} />);
    const keys = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
    keys.forEach(k => {
      expect(screen.getByText(k)).toBeDefined();
    });
  });

  it('highlights the active key', () => {
    render(<KeyPicker currentKey="G" onPickKey={onPickKey} visible={true} />);
    const activeBtn = screen.getByText('G');
    expect(activeBtn.className).toContain('active');
  });

  it('shows save buttons when isModified is true', () => {
    render(
      <KeyPicker 
        currentKey="A" 
        onPickKey={onPickKey} 
        visible={true} 
        isModified={true}
        onSaveOnline={onSaveOnline}
        onSaveLocal={onSaveLocal}
      />
    );
    expect(screen.getByText('Save this key?')).toBeDefined();
    expect(screen.getByText('SAVE (Online)')).toBeDefined();
    expect(screen.getByText('Save (Local)')).toBeDefined();
  });

  it('calls onSaveOnline when online save button is clicked', () => {
    render(
      <KeyPicker 
        currentKey="A" 
        onPickKey={onPickKey} 
        visible={true} 
        isModified={true}
        onSaveOnline={onSaveOnline}
      />
    );
    fireEvent.click(screen.getByText('SAVE (Online)'));
    expect(onSaveOnline).toHaveBeenCalled();
  });

  it('calls onSaveLocal when local save button is clicked', () => {
    render(
      <KeyPicker 
        currentKey="A" 
        onPickKey={onPickKey} 
        visible={true} 
        isModified={true}
        onSaveLocal={onSaveLocal}
      />
    );
    fireEvent.click(screen.getByText('Save (Local)'));
    expect(onSaveLocal).toHaveBeenCalled();
  });

  it('does not show save buttons when isModified is false', () => {
    render(
      <KeyPicker 
        currentKey="A" 
        onPickKey={onPickKey} 
        visible={true} 
        isModified={false}
      />
    );
    expect(screen.queryByText('Save this key?')).toBeNull();
  });
});
