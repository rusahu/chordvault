import { renderHook, act } from '@testing-library/react';
import { useDragReorder } from '../useDragReorder';
import { describe, it, expect, vi } from 'vitest';

describe('useDragReorder Hook', () => {
  it('initializes with the provided items', () => {
    const onSave = vi.fn();
    const initialItems = ['A', 'B', 'C'];
    const { result } = renderHook(() => useDragReorder(initialItems, onSave));

    expect(result.current.items).toEqual(initialItems);
    expect(result.current.draggedIdx).toBeNull();
  });

  it('syncs items when initialItems changes externally', () => {
    const onSave = vi.fn();
    const initialItems = ['A', 'B', 'C'];
    const { result, rerender } = renderHook(
      ({ items }) => useDragReorder(items, onSave),
      { initialProps: { items: initialItems } }
    );

    expect(result.current.items).toEqual(initialItems);

    const updatedItems = ['D', 'E'];
    rerender({ items: updatedItems });

    expect(result.current.items).toEqual(updatedItems);
  });

  it('handles HTML5 desktop drag and drop events', () => {
    const onSave = vi.fn();
    const initialItems = ['A', 'B', 'C'];
    const { result } = renderHook(() => useDragReorder(initialItems, onSave));

    // Enable dragging by simulating mouse down on drag handle
    act(() => {
      result.current.handleProps(0).onMouseDown();
    });

    // Start dragging index 0 ('A')
    act(() => {
      result.current.dragProps(0).onDragStart();
    });
    expect(result.current.draggedIdx).toBe(0);

    // Drag over index 1 ('B')
    act(() => {
      const mockEvent = { preventDefault: vi.fn() };
      result.current.dragProps(1).onDragOver(mockEvent as unknown as React.DragEvent);
    });

    // Items should swap live in hook state
    expect(result.current.items).toEqual(['B', 'A', 'C']);
    expect(result.current.draggedIdx).toBe(1);

    // End drag
    act(() => {
      result.current.dragProps(1).onDragEnd();
    });

    expect(result.current.draggedIdx).toBeNull();
    expect(onSave).toHaveBeenCalledWith(['B', 'A', 'C']);
  });

  it('handles touch events for mobile reordering', () => {
    const onSave = vi.fn();
    const initialItems = ['A', 'B', 'C'];
    const { result } = renderHook(() => useDragReorder(initialItems, onSave));

    // Touch Start on index 0
    act(() => {
      result.current.handleProps(0).onTouchStart();
    });
    expect(result.current.draggedIdx).toBe(0);

    // Touch Move over index 2 ('C')
    const mockClosest = vi.fn().mockReturnValue({
      getAttribute: (attr: string) => (attr === 'data-index' ? '2' : null),
    });
    
    document.elementFromPoint = vi.fn().mockReturnValue({
      closest: mockClosest,
    } as unknown as Element);

    act(() => {
      const mockEvent = {
        touches: [{ clientX: 100, clientY: 200 }],
        preventDefault: vi.fn(),
        cancelable: true,
      };
      result.current.handleProps(0).onTouchMove(mockEvent as unknown as React.TouchEvent);
    });

    // Items should swap 'A' to index 2
    expect(result.current.items).toEqual(['B', 'C', 'A']);
    expect(result.current.draggedIdx).toBe(2);
    expect(document.elementFromPoint).toHaveBeenCalledWith(100, 200);

    // Touch End
    act(() => {
      result.current.handleProps(0).onTouchEnd();
    });

    expect(result.current.draggedIdx).toBeNull();
    expect(onSave).toHaveBeenCalledWith(['B', 'C', 'A']);

    delete (document as unknown as Record<string, unknown>).elementFromPoint;
  });
});
