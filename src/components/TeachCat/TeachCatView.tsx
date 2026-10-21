import React, { useState } from 'react';
import { 
  CatSettings, 
  CatSkill, 
  getStoredCatSettings, 
  saveStoredCatSettings, 
  addCatExp,
  renameCat,
  CatColorTheme
} from '@/state/agentStore';
import { redeemCode, RedeemResult } from '@/services/redeemService';
import { events } from '@/ipc/events';
import { 
  GraduationCap, 
  Sparkles, 
  Plus, 
  Check, 
  Trash2, 
  Heart, 
  Utensils, 
  Droplets, 
  Moon, 
  ShieldCheck, 
  Sliders,
  Palette,
  Edit3,
  Lock,
  Gift,
  Crown,
  X
} from 'lucide-react';

interface TeachCatViewProps {
  onSettingsChange?: (settings: CatSettings) => void;
}

export const TeachCatView: React.FC<TeachCatViewProps> = ({ onSettingsChange }) => {
  const [settings, setSettings] = useState<CatSettings>(getStoredCatSettings());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);

  // Form thêm kỹ năng mới (Creator only)
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillTrigger, setNewSkillTrigger] = useState('');
  const [newSkillAction, setNewSkillAction] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState<CatSkill['category']>('habit');

  // Form đổi tên mèo
  const [renameInput, setRenameInput] = useState(settings.name);
  const [renameMsg, setRenameMsg] = useState<string | null>(null);

  // Form redeem code
  const [redeemInput, setRedeemInput] = useState('');
  const [redeemMsg, setRedeemMsg] = useState<{ text: string; success: boolean } | null>(null);

  const updateSettings = (updated: CatSettings) => {
    setSettings(updated);
    saveStoredCatSettings(updated);
    if (onSettingsChange) onSettingsChange(updated);
  };

  const handleToggleSkill = (id: string) => {
    const updatedSkills = settings.taughtSkills.map((s) =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    );
    const updated = { ...settings, taughtSkills: updatedSkills };
    updateSettings(updated);
  };

  const handleDeleteSkill = (id: string) => {
    const updatedSkills = settings.taughtSkills.filter((s) => s.id !== id);
    const updated = { ...settings, taughtSkills: updatedSkills };
    updateSettings(updated);
  };

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillName.trim() || !newSkillAction.trim()) return;

    const newSkill: CatSkill = {
      id: `skill-${Date.now()}`,
      name: newSkillName.trim(),
      trigger: newSkillTrigger.trim() || 'Khi nhận lệnh liên quan',
      actionPrompt: newSkillAction.trim(),
      enabled: true,
      category: newSkillCategory,
    };

    const updated = {
      ...settings,
      taughtSkills: [newSkill, ...settings.taughtSkills],
    };
    // Dạy bài học mới được thưởng 20 EXP!
    const withExp = addCatExp(20);
    const finalSettings = { ...updated, bondLevel: withExp.bondLevel, bondExp: withExp.bondExp };
    updateSettings(finalSettings);

    // Phát sự kiện mèo vui
    events.emitPetState({
      state: 'petting',
      message: `Meow! Em đã tiếp thu bài học "${newSkill.name}" rồi ạ! ✨`
    }).catch(() => {});

    setNewSkillName('');
    setNewSkillTrigger('');
    setNewSkillAction('');
    setShowAddModal(false);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = renameCat(renameInput);
    if (res.success) {
      updateSettings(res.settings);
      setRenameMsg(null);
      setShowRenameModal(false);
      events.emitPetState({
        state: 'done',
        message: `Từ giờ hãy gọi em là "${res.settings.name}" nha anh! 💖`
      }).catch(() => {});
    } else {
      setRenameMsg(res.message);
    }
  };

  const handleRedeemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res: RedeemResult = await redeemCode(redeemInput);
    if (res.success) {
      setRedeemMsg({ text: res.message, success: true });
      if (res.updatedSettings) updateSettings(res.updatedSettings);
      setRedeemInput('');
      events.emitPetState({
        state: 'done',
        message: 'Đã nhận thưởng mã thành công! ✨'
      }).catch(() => {});
    } else {
      setRedeemMsg({ text: res.message, success: false });
    }
  };

  const handleColorChange = (color: CatColorTheme) => {
    const updated = { ...settings, colorTheme: color };
    updateSettings(updated);
  };

  const handlePetCat = () => {
    const withExp = addCatExp(5);
    updateSettings({ ...settings, bondLevel: withExp.bondLevel, bondExp: withExp.bondExp });
    events.emitPetState({
      state: 'petting',
      message: 'Purrr... Em thích xoa đầu lắm! 💖'
    }).catch(() => {});
  };

  const handleFeedCat = () => {
    const withExp = addCatExp(10);
    updateSettings({ ...settings, bondLevel: withExp.bondLevel, bondExp: withExp.bondExp });
    events.emitPetState({
      state: 'feed',
      message: 'Măm măm... Cá ngừ ngon quá! 🐟'
    }).catch(() => {});
  };

  const handleDrinkCat = () => {
    const withExp = addCatExp(5);
    updateSettings({ ...settings, bondLevel: withExp.bondLevel, bondExp: withExp.bondExp });
    events.emitPetState({
      state: 'drink',
      message: 'Nước mát ngọt lành! 💧'
    }).catch(() => {});
  };

  const handleNapCat = () => {
    events.emitPetState({
      state: 'sleep',
      message: 'Khò khò... Em đi ngủ đây! 💤'
    }).catch(() => {});
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* 1. Pet Profile & Bond Level Header */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-r from-zinc-900/90 via-cyan-950/20 to-zinc-900/90 p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Avatar Preview */}
            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-cyan-500/40 bg-zinc-950/80 shadow-[0_0_25px_rgba(0,240,255,0.2)]">
              <span className="text-3xl">🐱</span>
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500 text-[11px] font-bold text-black shadow-md">
                {settings.bondLevel}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-bold text-white tracking-wide">{settings.name}</h3>
                
                {/* Đổi tên Mèo (Mở khóa nếu Lv >= 10) */}
                {settings.bondLevel >= 10 ? (
                  <button
                    onClick={() => {
                      setRenameInput(settings.name);
                      setRenameMsg(null);
                      setShowRenameModal(true);
                    }}
                    title="Đổi tên cho Mèo (Đã mở khóa Lv.10)"
                    className="p-1 rounded text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                ) : (
                  <span 
                    title={`Đạt Cấp độ thân thiết Lv.10 để mở khóa đổi tên! (Hiện tại: ${settings.bondLevel}/10)`}
                    className="flex items-center gap-1 rounded-full bg-zinc-800/80 px-2 py-0.5 text-[10px] text-zinc-400 border border-zinc-700/60"
                  >
                    <Lock className="h-2.5 w-2.5" /> Lv.10 đổi tên
                  </span>
                )}

                {/* Treats Balance */}
                <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  🐟 {settings.treats || 0} Treats
                </span>

                {/* Creator Badge */}
                {settings.isCreator && (
                  <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                    <Crown className="h-3 w-3 text-cyan-400" /> Creator
                  </span>
                )}
              </div>

              <p className="text-xs text-zinc-400 max-w-md">
                Linh vật đồng hành kiêm trợ lý ảo của Orbis. Càng tương tác và học bài mới, mèo càng thông minh và thân thiết với bạn.
              </p>

              {/* Progress bar */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-zinc-400">Độ thân thiết (Bond Level {settings.bondLevel}/10)</span>
                  <span className="text-cyan-400 font-semibold">{settings.bondExp}/100 EXP</span>
                </div>
                <div className="h-2 w-64 rounded-full bg-zinc-800 overflow-hidden border border-zinc-700/60">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500"
                    style={{ width: `${settings.bondExp}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Pet Interaction Buttons + Redeem */}
          <div className="flex flex-col gap-2 shrink-0">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handlePetCat}
                className="flex items-center gap-2 rounded-xl border border-pink-500/30 bg-pink-500/10 px-3 py-2 text-xs font-semibold text-pink-300 hover:bg-pink-500/20 active:scale-95 transition"
              >
                <Heart className="h-4 w-4 fill-pink-400 text-pink-400" />
                <span>Xoa đầu (+5 EXP)</span>
              </button>

              <button
                type="button"
                onClick={handleFeedCat}
                className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 active:scale-95 transition"
              >
                <Utensils className="h-4 w-4 text-amber-400" />
                <span>Cho ăn (+10)</span>
              </button>

              <button
                type="button"
                onClick={handleDrinkCat}
                className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 active:scale-95 transition"
              >
                <Droplets className="h-4 w-4 text-cyan-400" />
                <span>Uống nước (+5)</span>
              </button>

              <button
                type="button"
                onClick={handleNapCat}
                className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 active:scale-95 transition"
              >
                <Moon className="h-4 w-4 text-indigo-400" />
                <span>Cho mèo ngủ</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setRedeemMsg(null);
                setShowRedeemModal(true);
              }}
              className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 px-3 py-2 text-xs font-bold text-amber-300 shadow-sm transition"
            >
              <Gift className="h-4 w-4 text-amber-400" />
              <span>🎁 Nhập Mã Redeem Code (Nhận Treats & Kỹ Năng)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Visual & Customization Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Color Theme Selector */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
            <Palette className="h-4 w-4 text-cyan-400" />
            <span>Sơn màu áo cho Mèo</span>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {[
              { id: 'cyan', label: 'Cyber Cyan', bg: 'bg-cyan-400', border: 'border-cyan-400' },
              { id: 'emerald', label: 'Matrix Green', bg: 'bg-emerald-400', border: 'border-emerald-400' },
              { id: 'violet', label: 'Neon Violet', bg: 'bg-purple-400', border: 'border-purple-400' },
              { id: 'amber', label: 'Amber Glow', bg: 'bg-amber-400', border: 'border-amber-400' },
              { id: 'gold', label: 'Gold Silo', bg: 'bg-yellow-400', border: 'border-yellow-400' },
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleColorChange(c.id as any)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 text-[10px] transition ${
                  settings.colorTheme === c.id
                    ? `${c.border} bg-zinc-800 text-white shadow-md`
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
                }`}
              >
                <span className={`h-4 w-4 rounded-full ${c.bg} shadow-sm`} />
                <span>{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Display Settings */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
            <Sliders className="h-4 w-4 text-cyan-400" />
            <span>Kích thước & Bong bóng thoại</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Kích thước mèo trên màn hình:</span>
              <span className="font-mono text-cyan-300 font-semibold">{Math.round(settings.scale * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.6"
              max="1.4"
              step="0.05"
              value={settings.scale}
              onChange={(e) => updateSettings({ ...settings, scale: parseFloat(e.target.value) })}
              className="w-full accent-cyan-400"
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-zinc-400">Bật bóng thoại suy nghĩ & meow:</span>
              <input
                type="checkbox"
                checked={settings.speechBubbleEnabled}
                onChange={(e) => updateSettings({ ...settings, speechBubbleEnabled: e.target.checked })}
                className="h-4 w-4 rounded border-zinc-700 text-cyan-500 focus:ring-cyan-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Taught Skills Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-cyan-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              Bài học & Kỹ năng đã sở hữu ({settings.taughtSkills.length})
            </h4>
          </div>

          {/* Phân quyền Creator vs Public */}
          {settings.isCreator ? (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 active:scale-95 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Dạy kỹ năng mới (Creator Mode)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowRedeemModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-amber-500/40 text-amber-300 px-4 py-2 text-xs font-semibold transition"
            >
              <Gift className="h-4 w-4 text-amber-400" />
              <span>Nhập Redeem Code để mở khóa Kỹ năng</span>
            </button>
          )}
        </div>

        {/* Skills Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {settings.taughtSkills.map((skill) => (
            <div
              key={skill.id}
              className={`rounded-2xl border p-4 transition ${
                skill.enabled
                  ? 'border-zinc-700 bg-zinc-900/80 shadow-md'
                  : 'border-zinc-800/80 bg-zinc-900/30 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm">{skill.name}</span>
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase font-mono text-zinc-400 border border-zinc-700">
                      {skill.category}
                    </span>
                  </div>
                  <div className="text-xs text-cyan-400 font-mono">
                    Kích hoạt: "{skill.trigger}"
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={skill.enabled}
                    onChange={() => handleToggleSkill(skill.id)}
                    className="h-4 w-4 rounded border-zinc-700 text-cyan-500 focus:ring-cyan-400"
                    title={skill.enabled ? 'Đang bật' : 'Đang tắt'}
                  />
                  {settings.isCreator && (
                    <button
                      type="button"
                      onClick={() => handleDeleteSkill(skill.id)}
                      className="rounded p-1 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition"
                      title="Xóa kỹ năng này"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-3 rounded-xl bg-zinc-950/60 p-2.5 text-xs text-zinc-300 border border-zinc-800/60">
                <span className="text-zinc-500 font-medium">Chỉ dẫn cho Agent:</span> {skill.actionPrompt}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Modal Thêm Kỹ Năng Mới (Creator Mode) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl text-zinc-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-cyan-400" />
                Dạy kỹ năng mới cho Mèo (Creator)
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSkill} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-zinc-300 font-medium">Tên kỹ năng / bài học:</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Dọn dẹp thư mục Downloads"
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-zinc-300 font-medium">Điều kiện kích hoạt (Trigger):</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Khi tôi bảo 'dọn máy' hoặc mỗi cuối tuần"
                  value={newSkillTrigger}
                  onChange={(e) => setNewSkillTrigger(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-zinc-300 font-medium">Chỉ dẫn hành động cho Agent (Action):</label>
                <textarea
                  rows={3}
                  placeholder="Ví dụ: Tự động gom các file .zip, .exe cũ hơn 7 ngày vào thư mục Archive..."
                  value={newSkillAction}
                  onChange={(e) => setNewSkillAction(e.target.value)}
                  required
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-zinc-300 font-medium">Phân loại:</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['habit', 'safety', 'personality', 'macro'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setNewSkillCategory(cat)}
                      className={`rounded-lg border py-1.5 text-center capitalize transition ${
                        newSkillCategory === cat
                          ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300 font-semibold'
                          : 'border-zinc-800 bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg px-4 py-2 text-zinc-400 hover:text-white"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-4 py-2 font-semibold text-white shadow-lg transition"
                >
                  <Check className="h-4 w-4" />
                  Lưu bài học (+20 EXP)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Modal Đổi Tên Mèo (Lv.10+) */}
      {showRenameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-cyan-500/50 bg-zinc-900 p-5 shadow-2xl text-zinc-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
                <Edit3 className="h-4 w-4" />
                Đổi tên cho Mèo (Đã mở khóa Lv.10)
              </h3>
              <button
                type="button"
                onClick={() => setShowRenameModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRenameSubmit} className="space-y-3 text-xs">
              <input
                type="text"
                placeholder="Nhập tên mới cho mèo..."
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
              />

              {renameMsg && (
                <div className="p-2 rounded-lg text-xs bg-red-500/10 border border-red-500/30 text-red-300">
                  {renameMsg}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRenameModal(false)}
                  className="rounded-lg px-3 py-1.5 text-zinc-400 hover:text-white"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!renameInput.trim()}
                  className="rounded-lg bg-cyan-600 hover:bg-cyan-500 px-4 py-1.5 font-semibold text-white shadow transition"
                >
                  Lưu tên mới
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal Nhập Redeem Code */}
      {showRedeemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-amber-500/50 bg-zinc-900 p-5 shadow-2xl text-zinc-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <Gift className="h-4 w-4" />
                Nhập Mã Redeem Code
              </h3>
              <button
                type="button"
                onClick={() => setShowRedeemModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRedeemSubmit} className="space-y-3 text-xs">
              <input
                type="text"
                placeholder="Nhập mã (ví dụ: orbis-welcome-2026)..."
                value={redeemInput}
                onChange={(e) => setRedeemInput(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-mono text-white placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
              />

              {redeemMsg && (
                <div className={`p-2.5 rounded-lg text-xs leading-relaxed ${
                  redeemMsg.success 
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' 
                    : 'bg-red-500/10 border border-red-500/30 text-red-300'
                }`}>
                  {redeemMsg.text}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRedeemModal(false)}
                  className="rounded-lg px-3 py-1.5 text-zinc-400 hover:text-white"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={!redeemInput.trim()}
                  className="rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 px-4 py-1.5 font-bold text-zinc-950 shadow transition"
                >
                  Đổi mã nhận quà
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
