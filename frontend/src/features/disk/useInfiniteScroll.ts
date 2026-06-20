// useInfiniteScroll — observe a sentinel element and fire `onLoadMore` when it scrolls
// into view, so a cursor-paginated list fetches the next page automatically.
//
// Returns a ref to attach to the sentinel (placed at the end of the list). The observer
// only fires when `enabled` (there IS a next page and nothing is in flight), and it
// re-checks whenever those inputs change, so a sentinel already on-screen after a page
// loads keeps paging until the viewport is full or the list is exhausted.

import { useEffect, useRef } from 'react';

export function useInfiniteScroll<T extends Element>(
  onLoadMore: () => void,
  enabled: boolean,
): React.RefObject<T | null> {
  const sentinelRef = useRef<T | null>(null);
  // Keep the latest callback without re-creating the observer each render. Updated in
  // an effect (not during render) so it never reads/writes the ref while rendering.
  const cbRef = useRef(onLoadMore);
  useEffect(() => {
    cbRef.current = onLoadMore;
  });

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !enabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) cbRef.current();
      },
      // rootMargin pre-fetches a little before the sentinel is fully visible.
      { rootMargin: '400px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled]);

  return sentinelRef;
}
