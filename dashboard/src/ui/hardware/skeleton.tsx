function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div data-kit="skeleton" aria-busy="true" aria-label="Loading">
      <span data-kit="skeleton-block" data-shape="circle" />
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} data-kit="skeleton-block" style={{ width: `${90 - index * 18}%` }} />
      ))}
    </div>
  )
}

export { Skeleton }
