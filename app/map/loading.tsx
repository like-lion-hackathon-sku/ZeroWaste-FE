export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="animate-pulse">
        {/* Header skeleton */}
        <div className="h-16 bg-card border-b border-border" />

        {/* Hero image skeleton */}
        <div className="h-64 bg-muted" />

        {/* Content skeleton */}
        <div className="container mx-auto p-4 max-w-4xl">
          <div className="space-y-4">
            <div className="h-12 bg-muted rounded" />
            <div className="h-32 bg-muted rounded" />
            <div className="h-24 bg-muted rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}
