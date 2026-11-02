export function TheCoreView({ status }: { status: string }) {
  return <div className="orbis-core relative grid h-16 w-16 place-items-center" aria-label={`Orbis ${status}`}>
    <div className="absolute inset-0 rounded-full border border-cyan-300/40 shadow-[0_0_35px_#06b6d455,inset_0_0_25px_#06b6d455]" />
    <div className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-t-cyan-200 border-b-cyan-400" style={{ animationDuration: '3s' }} />
    <div className="h-6 w-6 animate-pulse rounded-full bg-cyan-200 shadow-[0_0_20px_#22d3ee]" />
  </div>;
}
