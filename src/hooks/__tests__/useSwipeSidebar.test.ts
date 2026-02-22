/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSwipeSidebar } from '../useSwipeSidebar';

function touch(x: number, y: number) {
  return { clientX: x, clientY: y } as Touch;
}

function fireTouchStart(x: number, y: number) {
  const ev = new TouchEvent('touchstart', {
    touches: [touch(x, y)],
    bubbles: true,
  });
  document.dispatchEvent(ev);
}

function fireTouchMove(x: number, y: number) {
  const ev = new TouchEvent('touchmove', {
    touches: [touch(x, y)],
    bubbles: true,
  });
  document.dispatchEvent(ev);
}

function fireTouchEnd(x: number, y: number) {
  const ev = new TouchEvent('touchend', {
    changedTouches: [touch(x, y)],
    bubbles: true,
  });
  document.dispatchEvent(ev);
}

describe('useSwipeSidebar', () => {
  let onOpen: ReturnType<typeof vi.fn>;
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onOpen = vi.fn();
    onClose = vi.fn();
    vi.spyOn(Date, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens sidebar on right swipe from left edge when closed', () => {
    renderHook(() => useSwipeSidebar(false, onOpen, onClose));

    fireTouchStart(10, 200);
    fireTouchMove(70, 205);
    vi.spyOn(Date, 'now').mockReturnValue(1200);
    fireTouchEnd(100, 205);

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not open when swipe starts outside edge zone', () => {
    renderHook(() => useSwipeSidebar(false, onOpen, onClose));

    fireTouchStart(50, 200);
    fireTouchMove(120, 205);
    vi.spyOn(Date, 'now').mockReturnValue(1200);
    fireTouchEnd(150, 205);

    expect(onOpen).not.toHaveBeenCalled();
  });

  it('closes sidebar on left swipe when open', () => {
    renderHook(() => useSwipeSidebar(true, onOpen, onClose));

    fireTouchStart(200, 200);
    fireTouchMove(130, 205);
    vi.spyOn(Date, 'now').mockReturnValue(1200);
    fireTouchEnd(100, 205);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('ignores swipe with too much vertical drift', () => {
    renderHook(() => useSwipeSidebar(false, onOpen, onClose));

    fireTouchStart(10, 200);
    fireTouchMove(70, 300); // 100px vertical drift > MAX_Y_DRIFT (80)
    vi.spyOn(Date, 'now').mockReturnValue(1200);
    fireTouchEnd(100, 300);

    expect(onOpen).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores swipe that is too slow (>500ms)', () => {
    renderHook(() => useSwipeSidebar(false, onOpen, onClose));

    fireTouchStart(10, 200);
    fireTouchMove(70, 205);
    vi.spyOn(Date, 'now').mockReturnValue(1600); // 600ms elapsed
    fireTouchEnd(100, 205);

    expect(onOpen).not.toHaveBeenCalled();
  });

  it('ignores swipe that is too short (<50px)', () => {
    renderHook(() => useSwipeSidebar(false, onOpen, onClose));

    fireTouchStart(10, 200);
    fireTouchMove(30, 205);
    vi.spyOn(Date, 'now').mockReturnValue(1200);
    fireTouchEnd(40, 205);

    expect(onOpen).not.toHaveBeenCalled();
  });

  it('cleans up event listeners on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderHook(() => useSwipeSidebar(false, onOpen, onClose));

    unmount();

    const removedEvents = removeSpy.mock.calls.map(c => c[0]);
    expect(removedEvents).toContain('touchstart');
    expect(removedEvents).toContain('touchmove');
    expect(removedEvents).toContain('touchend');
  });
});
