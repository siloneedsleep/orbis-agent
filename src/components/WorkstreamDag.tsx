import type { DagNode } from '@/state/orbisBridge';
export function DagView({ nodes }: { nodes: DagNode[] }) {
  return <section aria-label="Tiến trình đồ thị tác vụ" className="grid gap-2 rounded-xl border border-cyan-900/50 bg-zinc-900/60 p-3">
    <p className="text-xs font-semibold text-cyan-300">Luồng công việc · {nodes.filter(n => n.status === 'done').length}/{nodes.length}</p>
    {nodes.map(node => <div key={node.id} className="flex items-center gap-3 rounded-lg bg-black/20 p-2 text-xs">
      <span className={node.status === 'done' ? 'text-emerald-400' : node.status === 'running' ? 'animate-pulse text-cyan-400' : 'text-zinc-500'}>{node.status === 'done' ? '✓' : node.status === 'running' ? '●' : '○'}</span>
      <div className="min-w-0 flex-1"><p className="text-zinc-200">{node.goal}</p><p className="mt-1 text-zinc-500">{node.id} · {node.role}{node.dependsOn.length > 0 ? ` · Sau: ${node.dependsOn.join(', ')}` : ' · Độc lập'}</p></div>
      <span className="text-zinc-400">{node.status}</span>
    </div>)}
  </section>;
}
