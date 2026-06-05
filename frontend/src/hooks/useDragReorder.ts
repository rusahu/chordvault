import { useState, useRef, useEffect } from 'react';

export function useDragReorder<T>(
  initialItems: T[],
  onSave: (items: T[]) => void
) {
  const [items, setItems] = useState<T[]>(initialItems);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [canDrag, setCanDrag] = useState(false);
  const currentTouchIdx = useRef<number | null>(null);

  // Sync state if initialItems changes externally (e.g. song added or removed)
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  // HTML5 Drag & Drop (Desktop)
  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;

    const reordered = [...items];
    const [draggedItem] = reordered.splice(draggedIdx, 1);
    reordered.splice(idx, 0, draggedItem);
    setDraggedIdx(idx);
    setItems(reordered);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setCanDrag(false);
    onSave(items);
  };

  // Touch Reordering (Mobile/Touchscreen)
  const handleTouchStart = (idx: number) => {
    currentTouchIdx.current = idx;
    setDraggedIdx(idx);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (currentTouchIdx.current === null) return;
    
    // Prevent default scrolling behavior on mobile while dragging
    if (e.cancelable) {
      e.preventDefault();
    }

    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!element) return;

    const entryElement = element.closest('[data-index]');
    if (!entryElement) return;

    const hoverIdx = parseInt(entryElement.getAttribute('data-index') || '', 10);
    if (isNaN(hoverIdx) || hoverIdx === currentTouchIdx.current) return;

    const reordered = [...items];
    const [draggedItem] = reordered.splice(currentTouchIdx.current, 1);
    reordered.splice(hoverIdx, 0, draggedItem);
    
    currentTouchIdx.current = hoverIdx;
    setDraggedIdx(hoverIdx);
    setItems(reordered);
  };

  const handleTouchEnd = () => {
    currentTouchIdx.current = null;
    setDraggedIdx(null);
    onSave(items);
  };

  return {
    items,
    setItems,
    draggedIdx,
    dragProps: (idx: number) => ({
      draggable: canDrag,
      onDragStart: () => handleDragStart(idx),
      onDragOver: (e: React.DragEvent) => handleDragOver(e, idx),
      onDragEnd: handleDragEnd,
      'data-index': idx,
    }),
    handleProps: (idx: number) => ({
      onMouseDown: () => setCanDrag(true),
      onMouseUp: () => setCanDrag(false),
      onMouseLeave: () => setCanDrag(false),
      onTouchStart: () => handleTouchStart(idx),
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    }),
  };
}
