import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Terminal, 
  MousePointer, 
  Keyboard, 
  Camera, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Sparkles,
  User,
  Bot,
  Check,
  X
} from 'lucide-react';
import { WorkstreamItem } from '@/state/agentStore';

interface WorkstreamCardProps {
  item: WorkstreamItem;
  onConfirmAction?: (id: string, approved: boolean) => void;
}

export const WorkstreamCard: React.FC<WorkstreamCardProps> = ({ item, onConfirmAction }) => {
  const [isThoughtOpen, setIsThoughtOpen] = useState(false);

  // Render User Message
  if (item.type === 'user') {
    return (
      <div className="flex items-start gap-3 justify-end">
        <div className="max-w-xl rounded-2xl rounded-tr-sm bg-zinc-800 border border-zinc-700/60 p-4 text-sm text-zinc-100 shadow-md">
          <div className="flex items-center gap-2 mb-1.5 text-xs text-zinc-400 font-medium">
            <User className="h-3.5 w-3.5 text-cyan-400" />
            <span>Bạn</span>
            <span className="text-[10px] text-zinc-500 font-mono ml-auto">{item.timestamp}</span>
          </div>
          <p className="whitespace-pre-wrap leading-relaxed">{item.content}</p>
        </div>
      </div>
    );
  }

  // Render Assistant Message
  if (item.type === 'assistant') {
    return (
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mt-0.5">
          <Bot className="h-4 w-4" />
        </div>
        <div className="max-w-2xl rounded-2xl rounded-tl-sm bg-zinc-900 border border-zinc-800 p-4 text-sm text-zinc-100 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
            <span className="text-cyan-400 font-semibold">Orbis Agent</span>
            <span className="text-[10px] text-zinc-500 font-mono ml-auto">{item.timestamp}</span>
          </div>
          <p className="whitespace-pre-wrap leading-relaxed">{item.content}</p>
        </div>
      </div>
    );
  }

  // Render Thinking Accordion (Chain of Thought)
  if (item.type === 'thinking') {
    return (
      <div className="rounded-xl border border-purple-500/20 bg-purple-950/10 overflow-hidden text-xs">
        <button
          type="button"
          onClick={() => setIsThoughtOpen(!isThoughtOpen)}
          className="w-full flex items-center justify-between p-3 text-purple-300 hover:bg-purple-900/20 transition"
        >
          <div className="flex items-center gap-2 font-mono">
            <Sparkles className="h-3.5 w-3.5 text-purple-400 animate-pulse" />
            <span>Quá trình suy luận (Chain of Thought)</span>
          </div>
          {isThoughtOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {isThoughtOpen && (
          <div className="border-t border-purple-500/20 p-3.5 text-zinc-300 font-mono text-[11px] leading-relaxed whitespace-pre-wrap bg-black/30">
            {item.content}
          </div>
        )}
      </div>
    );
  }

  // Render Tool Action Card
  if (item.type === 'action' && item.actionData) {
    const { tool, params, result, status, durationMs } = item.actionData;

    const getToolIcon = () => {
      switch (tool) {
        case 'ClickButton':
        case 'MoveMouse':
          return <MousePointer className="h-4 w-4 text-cyan-400" />;
        case 'SendKeystroke':
          return <Keyboard className="h-4 w-4 text-blue-400" />;
        case 'CaptureScreen':
          return <Camera className="h-4 w-4 text-amber-400" />;
        case 'ExecutePowerShell':
          return <Terminal className="h-4 w-4 text-emerald-400" />;
        case 'SandboxExec':
          return <ShieldAlert className="h-4 w-4 text-cyan-400" />;
        default:
          return <Terminal className="h-4 w-4 text-zinc-400" />;
      }
    };

    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3.5 text-xs shadow-sm space-y-2.5">
        {/* Header of Action Card */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700">
              {getToolIcon()}
            </div>
            <div>
              <span className="font-semibold text-white tracking-wide">{tool}</span>
              <span className="ml-2 font-mono text-[10px] text-zinc-500">
                {item.timestamp}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {durationMs !== undefined && (
              <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                <Clock className="h-3 w-3" /> {durationMs}ms
              </span>
            )}
            {status === 'pending_approval' && (
              <span className="flex items-center gap-1 text-[11px] text-cyan-300 bg-cyan-500/15 px-2.5 py-0.5 rounded-full border border-cyan-400/30">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
                Chờ phê duyệt
              </span>
            )}
            {status === 'running' && (
              <span className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                Đang thực thi
              </span>
            )}
            {status === 'success' && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                <CheckCircle2 className="h-3 w-3" /> Hoàn thành
              </span>
            )}
            {status === 'rejected' && (
              <span className="flex items-center gap-1 text-[11px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-700">
                <X className="h-3 w-3" /> Đã từ chối
              </span>
            )}
            {status === 'error' && (
              <span className="flex items-center gap-1 text-[11px] text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded-full border border-rose-400/20">
                <AlertTriangle className="h-3 w-3" /> Lỗi
              </span>
            )}
          </div>
        </div>

        {/* Parameters */}
        {params && (
          <div className="rounded-lg bg-black/40 border border-zinc-800/80 p-2.5 font-mono text-[11px] text-zinc-300 overflow-x-auto">
            {tool === 'ExecutePowerShell' || tool === 'SandboxExec' ? (
              <div className="text-cyan-300 whitespace-pre-wrap">{params.command || JSON.stringify(params, null, 2)}</div>
            ) : (
              <pre>{JSON.stringify(params, null, 2)}</pre>
            )}
          </div>
        )}

        {/* Approval Buttons for Request Review / Default sensitive operations */}
        {status === 'pending_approval' && onConfirmAction && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-2.5">
            <span className="text-[11px] text-cyan-200">
              Lệnh này yêu cầu xác nhận trước khi thực thi trong Sandbox. Bạn có cho phép chạy không?
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onConfirmAction(item.id, false)}
                className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition"
              >
                <X className="h-3.5 w-3.5" />
                Từ chối
              </button>
              <button
                type="button"
                onClick={() => onConfirmAction(item.id, true)}
                className="flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 shadow transition"
              >
                <Check className="h-3.5 w-3.5" />
                Chấp thuận (Run)
              </button>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="text-[11px] text-zinc-400 pl-1">
            <span className="text-zinc-500 font-medium">Kết quả: </span>
            <span className="text-zinc-300 font-mono whitespace-pre-wrap">{String(result)}</span>
          </div>
        )}
      </div>
    );
  }

  return null;
};
