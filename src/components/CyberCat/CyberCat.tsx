import React, { useState, useEffect, useRef } from 'react';
import { commands } from '@/ipc/commands';
import { 
  CatSettings, 
  getStoredCatSettings, 
  saveStoredCatSettings, 
  addCatExp, 
  getStoredProfile 
} from '@/state/agentStore';
import { 
  Heart, 
  Utensils, 
  Droplets, 
  Moon, 
  Sun, 
  ExternalLink, 
  GraduationCap, 
  Sparkles,
  X
} from 'lucide-react';

export type CatActionState = 
  | 'idle' 
  | 'sleep' 
  | 'wake' 
  | 'thinking' 
  | 'executing' 
  | 'done' 
  | 'feed' 
  | 'drink' 
  | 'petting';

interface CyberCatProps {
  actionState?: CatActionState;
  customMessage?: string;
  onOpenDashboard?: () => void;
  onOpenTeach?: () => void;
}

// Bộ clip video tương ứng từng trạng thái
const STATE_CLIPS: Record<CatActionState, string[]> = {
  sleep: ['01-idle-curled-deep-sleep', '02-idle-curled-dream-twitch'],
  wake: ['12-tr-curled-to-sphinx', '39-idle-stand-alert-paw-wave'],
  idle: ['05-idle-sphinx-blink', '06-idle-sphinx-groom-paw', '07-idle-sphinx-look-around', '08-idle-loaf-content'],
  thinking: ['34-idle-meditation-breath', '07-idle-sphinx-look-around'],
  executing: ['11-idle-crouch-wiggle', '24-tr-stand-to-crouch'],
  done: ['10-idle-stretch-yawn', '03-idle-belly-up-bask', '04-idle-belly-up-paw-curl'],
  feed: ['09-idle-sit-eat-bowl'],
  drink: ['36-tr-sit-to-drink-water-bowl', '37-idle-sit-drink-water-bowl'],
  petting: ['38-tr-drink-to-sit-water-bowl-meow', '39-idle-stand-alert-paw-wave']
};

export const CyberCat: React.FC<CyberCatProps> = ({
  actionState = 'idle',
  customMessage,
  onOpenDashboard,
  onOpenTeach
}) => {
  const [settings, setSettings] = useState<CatSettings>(getStoredCatSettings());
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [currentClip, setCurrentClip] = useState<string>('05-idle-sphinx-blink');
  const [speechText, setSpeechText] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const cacheRef = useRef<Map<string, string>>(new Map());
  const speechTimerRef = useRef<any>(null);

  // Cập nhật settings từ storage
  useEffect(() => {
    const handleStorage = () => setSettings(getStoredCatSettings());
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Xử lý nạp video từ Rust Backend
  const loadClip = async (clipName: string) => {
    try {
      if (cacheRef.current.has(clipName)) {
        setVideoSrc(cacheRef.current.get(clipName)!);
        return;
      }
      const dataUri = await commands.getPetVideoBase64(clipName);
      cacheRef.current.set(clipName, dataUri);
      setVideoSrc(dataUri);
    } catch (err) {
      console.warn("Không load được clip mèo:", clipName, err);
    }
  };

  // Đồng bộ trạng thái hành động
  useEffect(() => {
    const clips = STATE_CLIPS[actionState] || STATE_CLIPS.idle;
    const chosen = clips[Math.floor(Math.random() * clips.length)];
    setCurrentClip(chosen);
    loadClip(chosen);

    if (customMessage) {
      triggerSpeech(customMessage, 5000);
    } else if (actionState === 'thinking') {
      triggerSpeech("Đang phân tích màn hình...", 4000);
    } else if (actionState === 'executing') {
      triggerSpeech("Em đang thực thi tác vụ...", 4000);
    } else if (actionState === 'done') {
      triggerSpeech("Đã xong việc rồi anh ơi! ✨", 5000);
    }
  }, [actionState, customMessage]);

  const triggerSpeech = (text: string, duration = 4000) => {
    if (!settings.speechBubbleEnabled) return;
    setSpeechText(text);
    if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
    speechTimerRef.current = setTimeout(() => {
      setSpeechText(null);
    }, duration);
  };

  // Chuỗi hành động khi click (Xoa đầu)
  const handlePetCat = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = addCatExp(5);
    setSettings(updated);

    // Bật hiệu ứng tim bay
    const newHeart = { id: Date.now(), x: Math.random() * 40 - 20, y: -20 };
    setHearts(prev => [...prev.slice(-4), newHeart]);

    const profile = getStoredProfile();
    const pronoun = profile?.pronoun || 'anh';
    const greetings = [
      `Meow~ ${pronoun} vuốt lông em thích quá! 💖`,
      `Em đang túc trực sẵn sàng rồi ${pronoun} ơi! ✨`,
      `Meo meo~ Chúc ${pronoun} một ngày làm việc năng suất! 🚀`,
      `Purrr... Cần em tự động hoá việc gì cứ bảo nhé!`
    ];
    triggerSpeech(greetings[Math.floor(Math.random() * greetings.length)], 4000);

    const happyClip = Math.random() > 0.5 ? '39-idle-stand-alert-paw-wave' : '38-tr-drink-to-sit-water-bowl-meow';
    setCurrentClip(happyClip);
    loadClip(happyClip);
  };

  const handleFeed = () => {
    setShowMenu(false);
    triggerSpeech("Măm măm... Cảm ơn anh đã cho em ăn hạt! 🐟", 4500);
    loadClip('09-idle-sit-eat-bowl');
    const updated = addCatExp(10);
    setSettings(updated);
  };

  const handleDrink = () => {
    setShowMenu(false);
    triggerSpeech("Nước mát quá, anh cũng nhớ uống nước nhé! 💧", 4500);
    loadClip('37-idle-sit-drink-water-bowl');
    const updated = addCatExp(5);
    setSettings(updated);
  };

  const handleSleep = () => {
    setShowMenu(false);
    triggerSpeech("Khò khò... Em chợp mắt một lát, gọi em là em dậy ngay nhé! 💤", 4500);
    loadClip('01-idle-curled-deep-sleep');
  };

  const handleWake = () => {
    setShowMenu(false);
    triggerSpeech("Em dậy rồi đây! Sẵn sàng nhận lệnh! ⚡", 4000);
    loadClip('39-idle-stand-alert-paw-wave');
  };

  // Kéo thả vị trí
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Chỉ kéo bằng chuột trái
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - settings.position.x,
      y: e.clientY - settings.position.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newX = Math.max(10, Math.min(window.innerWidth - 180, e.clientX - dragOffset.x));
      const newY = Math.max(10, Math.min(window.innerHeight - 180, e.clientY - dragOffset.y));
      const updated = { ...settings, position: { x: newX, y: newY } };
      setSettings(updated);
      saveStoredCatSettings(updated);
    };

    const handleMouseUp = () => {
      if (isDragging) setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, settings]);

  // Bộ lọc màu Cyber
  const getColorFilter = () => {
    switch (settings.colorTheme) {
      case 'emerald':
        return 'hue-rotate(95deg) saturate(1.8) brightness(1.08) drop-shadow(0 0 16px rgba(16, 185, 129, 0.45))';
      case 'violet':
        return 'hue-rotate(220deg) saturate(1.9) brightness(1.1) drop-shadow(0 0 16px rgba(168, 85, 247, 0.45))';
      case 'amber':
        return 'hue-rotate(-10deg) saturate(1.6) brightness(1.1) drop-shadow(0 0 16px rgba(245, 158, 11, 0.45))';
      case 'gold':
        return 'saturate(1.15) brightness(1.02) drop-shadow(0 0 12px rgba(250, 204, 21, 0.3))';
      case 'cyan':
      default:
        return 'hue-rotate(150deg) saturate(1.85) brightness(1.12) drop-shadow(0 0 18px rgba(0, 240, 255, 0.45))';
    }
  };

  if (!settings.enabled) return null;

  return (
    <div 
      className="pointer-events-auto absolute select-none transition-all duration-75 ease-out"
      style={{
        left: `${settings.position.x}px`,
        top: `${settings.position.y}px`,
        transform: `scale(${settings.scale})`,
        transformOrigin: 'bottom center',
        zIndex: 9999
      }}
      onMouseEnter={() => commands.setOverlayInteractive(true)}
      onMouseLeave={() => {
        if (!showMenu && !isDragging) {
          commands.setOverlayInteractive(false);
        }
      }}
    >
      {/* 1. Bong bóng thoại Hologram */}
      {speechText && (
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 whitespace-nowrap z-30 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="rounded-2xl border border-cyan-400/50 bg-zinc-950/90 px-3.5 py-2 text-xs font-medium text-cyan-200 shadow-[0_0_20px_rgba(0,240,255,0.25)] backdrop-blur-md flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
            <span>{speechText}</span>
          </div>
          <div className="mx-auto h-2 w-2 -translate-y-1 rotate-45 border-b border-r border-cyan-400/50 bg-zinc-950/90" />
        </div>
      )}

      {/* 2. Hiệu ứng tim bay khi xoa đầu */}
      {hearts.map((h) => (
        <div 
          key={h.id}
          className="absolute pointer-events-none text-pink-400 animate-out fade-out slide-out-to-top-8 duration-1000 z-40"
          style={{ left: `calc(50% + ${h.x}px)`, top: `${h.y}px` }}
        >
          <Heart className="h-5 w-5 fill-current filter drop-shadow-[0_0_8px_rgba(244,114,182,0.8)]" />
        </div>
      ))}

      {/* 3. Video Mèo Xanh Trong Suốt */}
      <div 
        className="relative cursor-grab active:cursor-grabbing group"
        onMouseDown={handleMouseDown}
        onClick={handlePetCat}
        onDoubleClick={() => {
          if (onOpenDashboard) onOpenDashboard();
          else commands.openDashboard().catch(() => {});
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowMenu(!showMenu);
        }}
      >
        {videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            autoPlay
            loop
            playsInline
            muted
            className="w-48 h-48 object-contain pointer-events-auto transition-transform duration-200 group-hover:scale-105"
            style={{
              filter: getColorFilter()
            }}
          />
        ) : (
          <div className="w-48 h-48 flex items-center justify-center">
            <div className="h-10 w-10 rounded-full border-2 border-cyan-400/40 border-t-cyan-400 animate-spin" />
          </div>
        )}

        {/* Level Badge siêu nhỏ cạnh mèo */}
        <div className="absolute bottom-2 right-4 flex items-center gap-1 rounded-full border border-cyan-500/40 bg-zinc-900/90 px-2 py-0.5 text-[10px] font-mono text-cyan-300 shadow-md backdrop-blur-sm">
          <span>Lv.{settings.bondLevel}</span>
        </div>
      </div>

      {/* 4. Menu Tương Tác Chuột Phải */}
      {showMenu && (
        <div 
          className="absolute left-full top-0 ml-2 w-48 rounded-xl border border-zinc-700 bg-zinc-900/95 p-1.5 shadow-2xl backdrop-blur-xl text-zinc-200 z-50 text-xs animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-zinc-800 text-[11px] font-semibold text-cyan-400">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> {settings.name}
            </span>
            <button 
              onClick={() => setShowMenu(false)}
              className="text-zinc-500 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="py-1 space-y-0.5">
            <button
              onClick={(e) => {
                handlePetCat(e);
                setShowMenu(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 hover:text-pink-300 transition text-left"
            >
              <Heart className="h-3.5 w-3.5 text-pink-400" />
              <span>Xoa đầu cưng nựng (+EXP)</span>
            </button>

            <button
              onClick={handleFeed}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 hover:text-amber-300 transition text-left"
            >
              <Utensils className="h-3.5 w-3.5 text-amber-400" />
              <span>Cho ăn hạt</span>
            </button>

            <button
              onClick={handleDrink}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 hover:text-cyan-300 transition text-left"
            >
              <Droplets className="h-3.5 w-3.5 text-cyan-400" />
              <span>Uống nước mát</span>
            </button>

            <button
              onClick={handleSleep}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 hover:text-indigo-300 transition text-left"
            >
              <Moon className="h-3.5 w-3.5 text-indigo-400" />
              <span>Bảo mèo đi ngủ cuộn tròn</span>
            </button>

            <button
              onClick={handleWake}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 hover:text-yellow-300 transition text-left"
            >
              <Sun className="h-3.5 w-3.5 text-yellow-400" />
              <span>Đánh thức mèo dậy</span>
            </button>

            <div className="my-1 border-t border-zinc-800" />

            <button
              onClick={() => {
                setShowMenu(false);
                if (onOpenTeach) onOpenTeach();
                else {
                  commands.openDashboard().catch(() => {});
                }
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-cyan-500/10 hover:text-cyan-300 text-cyan-400 transition text-left font-medium"
            >
              <GraduationCap className="h-3.5 w-3.5" />
              <span>Huấn luyện Mèo (Teach)</span>
            </button>

            <button
              onClick={() => {
                setShowMenu(false);
                commands.openDashboard().catch(() => {});
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 hover:text-white transition text-left"
            >
              <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
              <span>Mở Dashboard Agent</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
