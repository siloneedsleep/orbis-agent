import React, { useState, useEffect, useRef } from 'react';
import { commands } from '@/ipc/commands';
import { 
  CatSettings, 
  getStoredCatSettings, 
  saveStoredCatSettings, 
  addCatExp, 
  addCatTreats,
  spendCatTreats,
  renameCat,
  getStoredProfile 
} from '@/state/agentStore';
import { AgentBrain } from '@/services/agentLoop';
import { redeemCode, RedeemResult } from '@/services/redeemService';
import { 
  Heart, 
  Utensils, 
  Droplets, 
  Moon, 
  Sun, 
  ExternalLink, 
  GraduationCap, 
  Sparkles,
  X,
  Send,
  MessageSquare,
  Gift,
  Edit3,
  Lock,
  Check,
  Coins
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

interface PoseBubbleItem {
  id: string;
  label: string;
  icon: string;
  clip: string;
  speech: string;
  actionState?: CatActionState;
}

const POSE_BUBBLES: PoseBubbleItem[] = [
  { id: 'meditate', label: 'Thiền', icon: '🧘', clip: '34-idle-meditation-breath', speech: 'Em đang thiền tịnh tâm, nạp năng lượng... 🧘', actionState: 'thinking' },
  { id: 'sit', label: 'Ngồi', icon: '🐾', clip: '08-idle-loaf-content', speech: 'Ngồi ngoan chờ anh giao việc đây! 🐾', actionState: 'idle' },
  { id: 'lie', label: 'Nằm', icon: '🛌', clip: '03-idle-belly-up-bask', speech: 'Nằm phơi bụng sưởi ấm thích quá đi à~ 💖', actionState: 'idle' },
  { id: 'sleep', label: 'Ngủ', icon: '💤', clip: '01-idle-curled-deep-sleep', speech: 'Khò khò... ngủ ngoan không quấy anh nhé 💤', actionState: 'sleep' },
  { id: 'stretch', label: 'Giãn cơ', icon: '🤸', clip: '10-idle-stretch-yawn', speech: 'Oáp~ Vươn vai một cái thật sảng khoái! ⚡', actionState: 'done' },
  { id: 'alert', label: 'Tỉnh táo', icon: '⚡', clip: '39-idle-stand-alert-paw-wave', speech: 'Sẵn sàng 100% công lực phục vụ anh! 🚀', actionState: 'wake' },
  { id: 'feed', label: 'Ăn hạt', icon: '🐟', clip: '09-idle-sit-eat-bowl', speech: 'Măm măm... Cảm ơn anh đã cho em ăn! 🐟', actionState: 'feed' },
  { id: 'drink', label: 'Uống nước', icon: '💧', clip: '37-idle-sit-drink-water-bowl', speech: 'Nước mát lành quá, anh cũng uống nước nhé! 💧', actionState: 'drink' },
];

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

  // Trạng thái các menu & popups
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const [showPoseBubbles, setShowPoseBubbles] = useState<boolean>(false);
  const [showMiniChat, setShowMiniChat] = useState<boolean>(false);
  const [showRedeemModal, setShowRedeemModal] = useState<boolean>(false);
  const [showRenameModal, setShowRenameModal] = useState<boolean>(false);

  // Dữ liệu nhập
  const [miniChatPrompt, setMiniChatPrompt] = useState<string>('');
  const [isChatBusy, setIsChatBusy] = useState<boolean>(false);
  const [redeemInput, setRedeemInput] = useState<string>('');
  const [redeemMsg, setRedeemMsg] = useState<{ text: string; success: boolean } | null>(null);
  const [renameInput, setRenameInput] = useState<string>(settings.name);
  const [renameMsg, setRenameMsg] = useState<string | null>(null);

  // Kéo thả như tab desktop
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const isPointerDownRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ startX: number; startY: number; origX: number; origY: number }>({
    startX: 0, startY: 0, origX: 0, origY: 0
  });
  const hasMovedRef = useRef<boolean>(false);

  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const cacheRef = useRef<Map<string, string>>(new Map());
  const speechTimerRef = useRef<any>(null);
  const clickTimerRef = useRef<any>(null);
  const miniChatInputRef = useRef<HTMLInputElement>(null);
  const redeemInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

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

  // Tự động focus input khi mở Mini Bubble Chat, Redeem Modal, Rename Modal
  useEffect(() => {
    if (showMiniChat) {
      commands.setOverlayInteractive(true);
      setTimeout(() => miniChatInputRef.current?.focus(), 100);
    }
    if (showRedeemModal) {
      commands.setOverlayInteractive(true);
      setTimeout(() => redeemInputRef.current?.focus(), 100);
    }
    if (showRenameModal) {
      commands.setOverlayInteractive(true);
      setRenameInput(settings.name);
      setTimeout(() => renameInputRef.current?.focus(), 100);
    }
  }, [showMiniChat, showRedeemModal, showRenameModal, settings.name]);

  // Click 1 lần: Petting + Bật/tắt Pose Bubbles
  const handleSingleClick = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setShowPoseBubbles(prev => !prev);
    setShowMenu(false);
    setShowMiniChat(false);
    setShowRedeemModal(false);
    setShowRenameModal(false);

    // Tăng EXP và bắn tim
    const updated = addCatExp(5);
    setSettings(updated);

    const newHeart = { id: Date.now(), x: Math.random() * 40 - 20, y: -20 };
    setHearts(prev => [...prev.slice(-4), newHeart]);

    const profile = getStoredProfile();
    const pronoun = profile?.pronoun || 'anh';
    const greetings = [
      `Meow~ ${pronoun} vuốt lông em thích quá! 💖`,
      `Em đang túc trực sẵn sàng rồi ${pronoun} ơi! ✨`,
      `Meo meo~ Chúc ${pronoun} một ngày làm việc năng suất! 🚀`,
      `Purrr... Nhấn 2 lần vào em để mở Mini Chat nhé!`
    ];
    triggerSpeech(greetings[Math.floor(Math.random() * greetings.length)], 3500);

    const happyClip = Math.random() > 0.5 ? '39-idle-stand-alert-paw-wave' : '38-tr-drink-to-sit-water-bowl-meow';
    setCurrentClip(happyClip);
    loadClip(happyClip);
  };

  // Click 2 lần (Double click): Mở Mini Bubble Chat capsule
  const handleDoubleClick = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    setShowMiniChat(prev => !prev);
    setShowPoseBubbles(false);
    setShowMenu(false);
    setShowRedeemModal(false);
    setShowRenameModal(false);
    commands.setOverlayInteractive(true);
  };

  const handleCatClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Nếu vừa kéo thả chuột thì bỏ qua sự kiện click
    if (hasMovedRef.current) {
      hasMovedRef.current = false;
      return;
    }
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      handleDoubleClick(e);
      return;
    }
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      handleSingleClick(e);
    }, 220);
  };

  // Chọn tư thế từ Pose Bubbles
  const handleSelectPose = (pose: PoseBubbleItem) => {
    loadClip(pose.clip);
    setCurrentClip(pose.clip);
    triggerSpeech(pose.speech, 4000);
    const updated = addCatExp(5);
    setSettings(updated);

    const newHeart = { id: Date.now(), x: Math.random() * 40 - 20, y: -20 };
    setHearts(prev => [...prev.slice(-4), newHeart]);
  };

  // Gửi lệnh từ Mini Bubble Chat
  const handleSendMiniChat = async (presetPrompt?: string) => {
    const text = (presetPrompt || miniChatPrompt).trim();
    if (!text || isChatBusy) return;

    setMiniChatPrompt('');
    setIsChatBusy(true);
    setShowPoseBubbles(false);
    commands.setOverlayInteractive(true);

    // Chuyển tư thế suy nghĩ (thiền)
    const thinkClip = '34-idle-meditation-breath';
    setCurrentClip(thinkClip);
    loadClip(thinkClip);
    triggerSpeech(`Đang suy luận: "${text}"...`, 6000);

    try {
      // 1. Chụp màn hình để AI có ngữ cảnh
      let screenData: string | undefined = undefined;
      try {
        const layout = await commands.getOverlayLayout();
        if (layout && layout.monitors.length > 0) {
          const p = layout.monitors.find(m => m.primary) || layout.monitors[0];
          screenData = await commands.captureScreenRegion(p.x, p.y, p.width, p.height);
        }
      } catch (capErr) {
        console.warn("MiniChat screen capture error:", capErr);
      }

      // 2. Gọi AgentBrain lập kế hoạch
      const brain = new AgentBrain();
      const plan = await brain.planNextMove(text, screenData);

      // 3. Thực thi hành động nếu cần thao tác máy tính
      if (plan.action && plan.action.type !== 'done') {
        const execClip = '11-idle-crouch-wiggle';
        setCurrentClip(execClip);
        loadClip(execClip);
        triggerSpeech(`Đang thực hiện: ${plan.action.type}...`, 3000);
        await brain.executeAction(plan.action);
      }

      // 4. Báo cáo hoàn tất + thưởng 10 Treats và 15 EXP
      const doneClip = '39-idle-stand-alert-paw-wave';
      setCurrentClip(doneClip);
      loadClip(doneClip);
      const reply = plan.message || plan.thought || "Tác vụ đã hoàn tất!";
      triggerSpeech(reply, 8000);

      const withExp = addCatExp(15);
      const withTreats = addCatTreats(10);
      setSettings(withTreats);
    } catch (err: any) {
      console.error("MiniChat error:", err);
      triggerSpeech(`Lỗi: ${err?.message || err}`, 6000);
    } finally {
      setIsChatBusy(false);
    }
  };

  // Cho mèo ăn bánh thưởng (tiêu Treats)
  const handleFeedTreat = () => {
    setShowMenu(false);
    const result = spendCatTreats(5);
    if (!result.success) {
      triggerSpeech("Anh ơi em hết bánh thưởng rồi! Nhập Redeem Code để nhận thêm Treats nhé! 🐟", 4500);
      return;
    }
    setSettings(result.settings);
    const updated = addCatExp(15);
    setSettings(updated);
    triggerSpeech("Măm măm... Bánh thưởng thơm ngon quá! 🐟 (+15 EXP)", 4500);
    loadClip('09-idle-sit-eat-bowl');
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

  // Xử lý đổi tên mèo (Yêu cầu Lv. 10)
  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = renameCat(renameInput);
    if (res.success) {
      setSettings(res.settings);
      setRenameMsg(null);
      setShowRenameModal(false);
      triggerSpeech(`Từ giờ hãy gọi em là ${res.settings.name} nha anh! Meow~ 💖`, 4500);
    } else {
      setRenameMsg(res.message);
    }
  };

  // Xử lý nhập Redeem Code
  const handleRedeemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res: RedeemResult = await redeemCode(redeemInput);
    if (res.success) {
      setRedeemMsg({ text: res.message, success: true });
      if (res.updatedSettings) setSettings(res.updatedSettings);
      setRedeemInput('');
      triggerSpeech("Yeah! Đã đổi mã nhận quà thành công! ✨", 4500);
      loadClip('39-idle-stand-alert-paw-wave');
    } else {
      setRedeemMsg({ text: res.message, success: false });
    }
  };

  // Kéo thả vị trí tự do như tab desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Chỉ kéo chuột trái
    isPointerDownRef.current = true;
    hasMovedRef.current = false;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: settings.position.x,
      origY: settings.position.y
    };
    commands.setOverlayInteractive(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isPointerDownRef.current) return;
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;

      // Ngưỡng di chuyển để xác định là đang kéo thả
      if (!hasMovedRef.current && Math.hypot(dx, dy) > 3) {
        hasMovedRef.current = true;
        setIsDragging(true);
      }

      if (hasMovedRef.current) {
        // Cho phép đặt tự do khắp màn hình
        const newX = Math.max(-50, Math.min(window.innerWidth - 80, dragStartRef.current.origX + dx));
        const newY = Math.max(0, Math.min(window.innerHeight - 80, dragStartRef.current.origY + dy));
        setSettings(prev => ({ ...prev, position: { x: newX, y: newY } }));
      }
    };

    const handleMouseUp = () => {
      if (!isPointerDownRef.current) return;
      isPointerDownRef.current = false;
      if (hasMovedRef.current) {
        setIsDragging(false);
        saveStoredCatSettings(settings);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [settings]);

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

  const isAnyModalOpen = showMenu || showPoseBubbles || showMiniChat || showRedeemModal || showRenameModal;

  return (
    <div 
      className={`pointer-events-auto absolute select-none ${
        isDragging ? 'cursor-grabbing transition-none' : 'transition-all duration-75 ease-out'
      }`}
      style={{
        left: `${settings.position.x}px`,
        top: `${settings.position.y}px`,
        transform: `scale(${isDragging ? settings.scale * 1.05 : settings.scale})`,
        transformOrigin: 'bottom center',
        zIndex: 9999
      }}
      onMouseEnter={() => commands.setOverlayInteractive(true)}
      onMouseLeave={() => {
        if (!isAnyModalOpen && !isDragging) {
          commands.setOverlayInteractive(false);
        }
      }}
    >
      {/* 1. Bong bóng thoại Hologram trên đầu mèo */}
      {speechText && (
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 whitespace-nowrap z-30 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="rounded-2xl border border-cyan-400/50 bg-zinc-950/90 px-3.5 py-2 text-xs font-medium text-cyan-200 shadow-[0_0_20px_rgba(0,240,255,0.25)] backdrop-blur-md flex items-center gap-1.5 max-w-xs truncate">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400 animate-pulse shrink-0" />
            <span className="truncate">{speechText}</span>
          </div>
          <div className="mx-auto h-2 w-2 -translate-y-1 rotate-45 border-b border-r border-cyan-400/50 bg-zinc-950/90" />
        </div>
      )}

      {/* 2. Hiệu ứng tim bay khi tương tác */}
      {hearts.map((h) => (
        <div 
          key={h.id}
          className="absolute pointer-events-none text-pink-400 animate-out fade-out slide-out-to-top-8 duration-1000 z-40"
          style={{ left: `calc(50% + ${h.x}px)`, top: `${h.y}px` }}
        >
          <Heart className="h-5 w-5 fill-current filter drop-shadow-[0_0_8px_rgba(244,114,182,0.8)]" />
        </div>
      ))}

      {/* 3. Vòng Pose Bubbles (Hiển thị khi click đơn vào mèo) */}
      {showPoseBubbles && (
        <div 
          className="absolute -top-14 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-zinc-950/85 p-1.5 rounded-full border border-cyan-400/40 shadow-[0_0_20px_rgba(0,240,255,0.25)] backdrop-blur-xl z-40 animate-in fade-in zoom-in-90 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {POSE_BUBBLES.map((pose) => (
            <button
              key={pose.id}
              onClick={() => handleSelectPose(pose)}
              title={pose.label}
              className="relative group h-8 w-8 rounded-full bg-zinc-900/90 hover:bg-cyan-500/20 border border-zinc-700 hover:border-cyan-400 flex items-center justify-center text-sm transition-all duration-150 hover:scale-115"
            >
              <span>{pose.icon}</span>
              <span className="pointer-events-none absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/90 text-cyan-300 text-[10px] font-medium px-1.5 py-0.5 rounded shadow whitespace-nowrap z-50">
                {pose.label}
              </span>
            </button>
          ))}
          <button
            onClick={() => setShowPoseBubbles(false)}
            className="h-7 w-7 rounded-full bg-zinc-900 hover:bg-red-500/20 border border-zinc-700 hover:border-red-400 flex items-center justify-center text-zinc-400 hover:text-red-300 transition"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* 4. Video Mèo Xanh Trong Suốt - Cầm kéo như Tab Desktop */}
      <div 
        className="relative cursor-grab active:cursor-grabbing group"
        onMouseDown={handleMouseDown}
        onClick={handleCatClick}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowMenu(!showMenu);
          setShowPoseBubbles(false);
          setShowMiniChat(false);
          setShowRedeemModal(false);
          setShowRenameModal(false);
          commands.setOverlayInteractive(true);
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
            className={`w-48 h-48 object-contain pointer-events-auto transition-transform duration-200 ${
              isDragging ? 'scale-105 drop-shadow-[0_20px_30px_rgba(0,0,0,0.6)]' : 'group-hover:scale-105'
            }`}
            style={{
              filter: getColorFilter()
            }}
          />
        ) : (
          <div className="w-48 h-48 flex items-center justify-center">
            <div className="h-10 w-10 rounded-full border-2 border-cyan-400/40 border-t-cyan-400 animate-spin" />
          </div>
        )}

        {/* Level & Treats Badge */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-zinc-900/90 px-2 py-0.5 text-[10px] font-mono text-cyan-300 shadow-md backdrop-blur-sm">
          <span>Lv.{settings.bondLevel}</span>
          <span className="text-zinc-600">•</span>
          <span className="flex items-center gap-0.5 text-amber-300 font-semibold">
            🐟 {settings.treats || 0}
          </span>
        </div>
      </div>

      {/* 5. Mini Bubble Chat Capsule (Bấm 2 lần vào mèo) */}
      {showMiniChat && (
        <div 
          className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-84 md:w-96 rounded-2xl border border-cyan-500/40 bg-zinc-950/92 p-3 shadow-[0_0_35px_rgba(0,240,255,0.3)] backdrop-blur-xl text-zinc-100 z-50 animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800 text-[11px] font-semibold text-cyan-400">
            <span className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-cyan-400" />
              <span>Hỏi {settings.name} (Mini Agent Chat)</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[10px] text-amber-300 font-mono">
                🐟 {settings.treats || 0} Treats
              </span>
              <button
                onClick={() => {
                  setShowMiniChat(false);
                  if (onOpenDashboard) onOpenDashboard();
                  else commands.openDashboard().catch(() => {});
                }}
                title="Mở toàn bộ Dashboard"
                className="p-1 rounded text-zinc-400 hover:text-cyan-300 hover:bg-zinc-800 transition"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
              <button 
                onClick={() => {
                  setShowMiniChat(false);
                  commands.setOverlayInteractive(false);
                }}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Ô nhập prompt */}
          <div className="relative flex items-center bg-zinc-900/90 rounded-xl border border-zinc-700/80 focus-within:border-cyan-400 focus-within:ring-1 focus-within:ring-cyan-400/50 px-3 py-1.5 text-xs transition">
            <input
              ref={miniChatInputRef}
              type="text"
              placeholder={`Hỏi ${settings.name} hoặc yêu cầu tự động hoá...`}
              value={miniChatPrompt}
              disabled={isChatBusy}
              onChange={(e) => setMiniChatPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMiniChat();
                }
              }}
              className="w-full bg-transparent text-white placeholder-zinc-500 focus:outline-none text-xs pr-7"
            />
            <button
              onClick={() => handleSendMiniChat()}
              disabled={!miniChatPrompt.trim() || isChatBusy}
              className={`absolute right-1.5 p-1.5 rounded-lg transition ${
                miniChatPrompt.trim() && !isChatBusy
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold shadow-[0_0_10px_rgba(0,240,255,0.4)]'
                  : 'text-zinc-600 cursor-not-allowed'
              }`}
            >
              {isChatBusy ? (
                <div className="h-3 w-3 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
            </button>
          </div>

          {/* Quick Suggestion Pills */}
          <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px]">
            <button
              disabled={isChatBusy}
              onClick={() => handleSendMiniChat('Phân tích màn hình hiện tại và gợi ý việc cần làm')}
              className="rounded-full bg-zinc-900/90 hover:bg-cyan-500/20 border border-zinc-800 hover:border-cyan-400/50 px-2 py-0.5 text-zinc-300 hover:text-cyan-300 transition"
            >
              🔍 Đọc màn hình
            </button>
            <button
              disabled={isChatBusy}
              onClick={() => handleSendMiniChat('Tối ưu bộ nhớ RAM và dọn dẹp tiến trình rác')}
              className="rounded-full bg-zinc-900/90 hover:bg-cyan-500/20 border border-zinc-800 hover:border-cyan-400/50 px-2 py-0.5 text-zinc-300 hover:text-cyan-300 transition"
            >
              ⚡ Dọn dẹp RAM
            </button>
            <button
              disabled={isChatBusy}
              onClick={() => handleSendMiniChat('Nhắc nhở tôi uống nước và thư giãn mắt 30 giây')}
              className="rounded-full bg-zinc-900/90 hover:bg-cyan-500/20 border border-zinc-800 hover:border-cyan-400/50 px-2 py-0.5 text-zinc-300 hover:text-cyan-300 transition"
            >
              🍵 Nhắc nghỉ ngơi
            </button>
          </div>
        </div>
      )}

      {/* 6. Quick Menu Chuột Phải của Orbis */}
      {showMenu && (
        <div 
          className="absolute left-full top-0 ml-2 w-52 rounded-xl border border-zinc-700 bg-zinc-900/95 p-1.5 shadow-2xl backdrop-blur-xl text-zinc-200 z-50 text-xs animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Quick Menu */}
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-zinc-800 text-[11px] font-semibold text-cyan-400">
            <span className="flex items-center gap-1.5 truncate">
              <Sparkles className="h-3 w-3 text-cyan-400 shrink-0" />
              <span className="truncate">{settings.name} (Lv.{settings.bondLevel})</span>
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] text-amber-300 font-mono">🐟 {settings.treats || 0}</span>
              <button 
                onClick={() => {
                  setShowMenu(false);
                  commands.setOverlayInteractive(false);
                }}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="py-1 space-y-0.5">
            {/* Nút Cho mèo ngủ / Đánh thức */}
            <button
              onClick={handleSleep}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-indigo-500/20 hover:text-indigo-300 text-indigo-400 transition text-left font-medium"
            >
              <Moon className="h-3.5 w-3.5" />
              <span>Cho mèo đi ngủ cuộn tròn 💤</span>
            </button>

            <button
              onClick={handleWake}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-yellow-500/20 hover:text-yellow-300 text-yellow-400 transition text-left font-medium"
            >
              <Sun className="h-3.5 w-3.5" />
              <span>Đánh thức mèo dậy ⚡</span>
            </button>

            <div className="my-1 border-t border-zinc-800" />

            {/* Mở Mini Chat */}
            <button
              onClick={() => {
                setShowMenu(false);
                setShowMiniChat(true);
                commands.setOverlayInteractive(true);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-cyan-500/20 hover:text-cyan-300 text-cyan-400 transition text-left"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Mở Mini Bubble Chat</span>
            </button>

            {/* Nhập Redeem Code */}
            <button
              onClick={() => {
                setShowMenu(false);
                setShowRedeemModal(true);
                commands.setOverlayInteractive(true);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-amber-500/20 hover:text-amber-300 text-amber-400 transition text-left"
            >
              <Gift className="h-3.5 w-3.5" />
              <span>Nhập Redeem Code (Nhận quà)</span>
            </button>

            {/* Thưởng bánh Treat */}
            <button
              onClick={handleFeedTreat}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 hover:text-amber-300 transition text-left"
            >
              <span className="flex items-center gap-2">
                <Utensils className="h-3.5 w-3.5 text-amber-400" />
                <span>Thưởng bánh Treat (+15 EXP)</span>
              </span>
              <span className="text-[10px] text-zinc-500">-5 🐟</span>
            </button>

            {/* Đổi tư thế */}
            <button
              onClick={() => {
                setShowMenu(false);
                setShowPoseBubbles(true);
                commands.setOverlayInteractive(true);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 hover:text-cyan-300 transition text-left"
            >
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              <span>Đổi tư thế mèo (Pose Bubbles)</span>
            </button>

            {/* Xoa đầu */}
            <button
              onClick={(e) => {
                handleSingleClick(e);
                setShowMenu(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-zinc-800 hover:text-pink-300 transition text-left"
            >
              <Heart className="h-3.5 w-3.5 text-pink-400" />
              <span>Xoa đầu cưng nựng (+5 EXP)</span>
            </button>

            {/* Đổi tên mèo (Yêu cầu Lv. 10) */}
            <button
              onClick={() => {
                if (settings.bondLevel >= 10) {
                  setShowMenu(false);
                  setShowRenameModal(true);
                  commands.setOverlayInteractive(true);
                } else {
                  triggerSpeech(`Cần đạt Thân thiết Lv.10 để đổi tên cho em nha anh! (Hiện tại: Lv.${settings.bondLevel}/10)`, 4500);
                  setShowMenu(false);
                }
              }}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 transition text-left ${
                settings.bondLevel >= 10 
                  ? 'hover:bg-zinc-800 text-cyan-300 font-medium' 
                  : 'text-zinc-500 hover:text-zinc-400'
              }`}
            >
              <span className="flex items-center gap-2">
                {settings.bondLevel >= 10 ? (
                  <Edit3 className="h-3.5 w-3.5 text-cyan-400" />
                ) : (
                  <Lock className="h-3.5 w-3.5 text-zinc-500" />
                )}
                <span>Đổi tên Mèo</span>
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                {settings.bondLevel >= 10 ? 'Mở khóa' : `Lv.${settings.bondLevel}/10`}
              </span>
            </button>

            <div className="my-1 border-t border-zinc-800" />

            <button
              onClick={() => {
                setShowMenu(false);
                if (onOpenTeach) onOpenTeach();
                else commands.openDashboard().catch(() => {});
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

      {/* 7. Modal Nhập Redeem Code */}
      {showRedeemModal && (
        <div 
          className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-80 rounded-2xl border border-amber-500/40 bg-zinc-950/95 p-3.5 shadow-[0_0_35px_rgba(245,158,11,0.25)] backdrop-blur-xl text-zinc-100 z-50 animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800 text-xs font-semibold text-amber-400">
            <span className="flex items-center gap-1.5">
              <Gift className="h-4 w-4" />
              <span>Nhập Mã Đổi Thưởng (Redeem)</span>
            </span>
            <button 
              onClick={() => {
                setShowRedeemModal(false);
                setRedeemMsg(null);
                commands.setOverlayInteractive(false);
              }}
              className="text-zinc-500 hover:text-white p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <form onSubmit={handleRedeemSubmit} className="space-y-2">
            <div className="relative">
              <input
                ref={redeemInputRef}
                type="text"
                placeholder="Nhập mã (ví dụ: orbis-welcome-2026)..."
                value={redeemInput}
                onChange={(e) => setRedeemInput(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-amber-400 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none"
              />
            </div>

            {redeemMsg && (
              <div className={`p-2 rounded-lg text-[11px] ${
                redeemMsg.success 
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' 
                  : 'bg-red-500/10 border border-red-500/30 text-red-300'
              }`}>
                {redeemMsg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={!redeemInput.trim()}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-zinc-950 font-bold py-1.5 rounded-xl text-xs transition shadow"
            >
              Đổi mã nhận quà
            </button>
          </form>
        </div>
      )}

      {/* 8. Modal Đổi Tên Mèo (Khi đạt Lv. 10) */}
      {showRenameModal && (
        <div 
          className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-72 rounded-2xl border border-cyan-500/40 bg-zinc-950/95 p-3.5 shadow-[0_0_35px_rgba(0,240,255,0.25)] backdrop-blur-xl text-zinc-100 z-50 animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800 text-xs font-semibold text-cyan-400">
            <span className="flex items-center gap-1.5">
              <Edit3 className="h-4 w-4" />
              <span>Đổi tên Mèo (Mở khóa Lv.10)</span>
            </span>
            <button 
              onClick={() => {
                setShowRenameModal(false);
                setRenameMsg(null);
                commands.setOverlayInteractive(false);
              }}
              className="text-zinc-500 hover:text-white p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <form onSubmit={handleRenameSubmit} className="space-y-2">
            <input
              ref={renameInputRef}
              type="text"
              placeholder="Nhập tên mới cho mèo..."
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none"
            />

            {renameMsg && (
              <div className="p-2 rounded-lg text-[11px] bg-red-500/10 border border-red-500/30 text-red-300">
                {renameMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={!renameInput.trim()}
              className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-zinc-950 font-bold py-1.5 rounded-xl text-xs transition shadow"
            >
              Lưu tên mới
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
