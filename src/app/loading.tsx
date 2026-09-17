export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="animate-pulse space-y-6">
        <div className="h-4 w-28 rounded-full bg-slate-200" />
        <div className="h-12 max-w-lg rounded-2xl bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 rounded-3xl bg-white shadow-sm" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-48 rounded-3xl bg-white shadow-sm" />
          ))}
        </div>
      </div>
    </div>
  );
}
