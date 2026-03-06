function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="h-3 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
      <div className="mt-3 h-7 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
    </div>
  )
}

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="h-5 w-56 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        <div className="mt-3 h-3 w-72 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="h-4 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        <div className="mt-4 space-y-2">
          <div className="h-10 animate-pulse rounded bg-gray-100 dark:bg-gray-800/70" />
          <div className="h-10 animate-pulse rounded bg-gray-100 dark:bg-gray-800/70" />
          <div className="h-10 animate-pulse rounded bg-gray-100 dark:bg-gray-800/70" />
        </div>
      </div>
    </div>
  )
}
