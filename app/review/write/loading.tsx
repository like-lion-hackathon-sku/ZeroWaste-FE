export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="animate-pulse">
        {/* Header skeleton */}
        <div className="h-16 bg-card border-b border-border" />

        {/* Progress skeleton */}
        <div className="h-20 bg-card border-b border-border" />

        {/* Content skeleton */}
        <div className="container mx-auto p-4 max-w-2xl">
          <div className="space-y-4">
            <div className="h-64 bg-muted rounded-lg" />
            <div className="h-32 bg-muted rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}
