export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="animate-pulse">
        {/* Header skeleton */}
        <div className="h-16 bg-card border-b border-border" />

        {/* Content skeleton */}
        <div className="container mx-auto p-4 max-w-4xl">
          <div className="space-y-6">
            {/* User info skeleton */}
            <div className="h-48 bg-muted rounded-lg" />

            {/* Tabs skeleton */}
            <div className="h-12 bg-muted rounded" />

            {/* Content skeleton */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="h-64 bg-muted rounded-lg" />
              <div className="h-64 bg-muted rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
