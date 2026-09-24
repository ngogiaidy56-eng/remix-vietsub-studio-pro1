import React, { useState } from 'react';
import {
  Subtitles,
  Volume2,
  VolumeX,
  Play,
  RotateCw,
  Sparkles,
  Zap,
  Check,
  Split,
  Music,
  Sliders,
  Maximize2,
  Mic,
  Film,
  Download,
  Headphones,
  CheckCircle2,
  Search,
  Plus,
  Trash2,
  Radio,
  Wand2,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  VideoClip,
  AudioClip,
  SubtitleSegment,
  SubtitleDisplayMode,
  MultiChannelAudioConfig,
} from '../types/editor';
import { audioEngine } from '../utils/audioEngine';
import {
  generateSrtContent,
  generateVttContent,
  generateAssKaraokeContent,
  downloadFile,
} from '../utils/subtitleExporter';
import { formatFullTimecode } from '../utils/mediaUtils';

interface InspectorPanelProps {
  activeClip?: VideoClip;
  onUpdateClip: (clipId: string, updater: (clip: VideoClip) => VideoClip) => void;
  onExtractAudio: (clip: VideoClip) => void;
  onApplyTransitionToAll?: (transitionType: any, duration: number) => void;
  onRunAiAudioMix?: () => void;
  isMixing?: boolean;
  subtitles: SubtitleSegment[];
  onUpdateSubtitles?: (subtitles: SubtitleSegment[]) => void;
  subtitleMode: SubtitleDisplayMode;
  setSubtitleMode: (mode: SubtitleDisplayMode) => void;
  subtitleOffset: number;
  setSubtitleOffset: (fn: (prev: number) => number) => void;
  onOpenVietsubStudio?: () => void;
  audioConfig?: MultiChannelAudioConfig;
  onChangeAudioConfig?: (config: MultiChannelAudioConfig) => void;
  onOpenAutoTranscription?: () => void;
  onOpenFullScreen?: () => void;
  currentTime?: number;
  onSeek?: (time: number) => void;
  onOpenBookmarklet?: () => void;
  onOpenAiCreation?: () => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  activeClip,
  onUpdateClip,
  onExtractAudio,
  subtitles,
  onUpdateSubtitles,
  subtitleMode,
  setSubtitleMode,
  subtitleOffset,
  setSubtitleOffset,
  audioConfig,
  onChangeAudioConfig,
  onOpenAutoTranscription,
  onOpenFullScreen,
  currentTime = 0,
  onSeek,
  onOpenBookmarklet,
  onOpenAiCreation,
}) => {
  const [activeTab, setActiveTab] = useState<
    'vietsub' | 'voiceover' | 'multichannel' | 'clip' | 'ai-tools'
  >('vietsub');

  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhanceSuccessMsg, setEnhanceSuccessMsg] = useState<string | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(
    subtitles.length > 0 ? subtitles[0].id : null
  );
  const [subSearchQuery, setSubSearchQuery] = useState('');

  // Selected subtitle cue
  const selectedSub = subtitles.find((s) => s.id === selectedSubId) || subtitles[0];

  // AI Polish: Restore diacritics / cinema phrasing / smart split
  const handleEnhanceVietnamese = async (
    mode: 'restore_diacritics' | 'cinema_tone' | 'smart_split'
  ) => {
    if (!onUpdateSubtitles || subtitles.length === 0) return;
    setIsEnhancing(true);
    audioEngine.playSfx('whoosh');

    try {
      const res = await fetch('/api/gemini/enhance-vietnamese', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subtitles, mode }),
      });
      const data = await res.json();
      if (data.success && data.subtitles) {
        onUpdateSubtitles(data.subtitles);
        audioEngine.playSfx('ding');
        setEnhanceSuccessMsg(
          mode === 'restore_diacritics'
            ? 'Đã sửa dấu tiếng Việt chuẩn xác'
            : mode === 'cinema_tone'
            ? 'Đã nâng cấp văn phong điện ảnh'
            : 'Đã phân tách câu phụ đề tự nhiên'
        );
        setTimeout(() => setEnhanceSuccessMsg(null), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsEnhancing(false);
    }
  };

  // Split selected subtitle cue in half
  const handleSplitCue = () => {
    if (!selectedSub || !onUpdateSubtitles) return;
    const mid = Number(((selectedSub.start + selectedSub.end) / 2).toFixed(1));
    const words = selectedSub.textVi.split(' ');
    const half = Math.ceil(words.length / 2);
    const text1 = words.slice(0, half).join(' ');
    const text2 = words.slice(half).join(' ');

    const newCue: SubtitleSegment = {
      id: `cue_split_${Date.now()}`,
      start: mid,
      end: selectedSub.end,
      textVi: text2 || 'Đoạn thoại tiếp theo...',
      textOriginal: selectedSub.textOriginal,
      speaker: selectedSub.speaker,
    };

    const updated = subtitles.map((s) =>
      s.id === selectedSub.id ? { ...s, end: mid, textVi: text1 } : s
    );
    onUpdateSubtitles([...updated, newCue].sort((a, b) => a.start - b.start));
    audioEngine.playSfx('ding');
  };

  // Add new subtitle cue at current playhead
  const handleAddCueAtPlayhead = () => {
    if (!onUpdateSubtitles) return;
    const newCue: SubtitleSegment = {
      id: `cue_${Date.now()}`,
      start: Number(currentTime.toFixed(1)),
      end: Number((currentTime + 3.0).toFixed(1)),
      textOriginal: 'Original speech dialogue...',
      textVi: 'Dòng phụ đề tiếng Việt mới...',
      speaker: 'Diễn viên',
    };
    onUpdateSubtitles([...subtitles, newCue].sort((a, b) => a.start - b.start));
    setSelectedSubId(newCue.id);
    audioEngine.playSfx('ding');
  };

  // Delete cue
  const handleDeleteCue = (id: string) => {
    if (!onUpdateSubtitles) return;
    onUpdateSubtitles(subtitles.filter((s) => s.id !== id));
    audioEngine.playSfx('pop');
  };

  // Test speaking Vietnamese voiceover
  const handleTestVoice = (text?: string) => {
    const speechText =
      text ||
      selectedSub?.textVi ||
      'Chào mừng bạn đến với hệ thống lồng tiếng tự động. Bạn không cần phải dán mắt đọc phụ đề.';
    const gender = audioConfig?.aiVoiceover?.voiceGender || 'female';
    audioEngine.speakVietnameseSpeech(speechText, gender);
  };

  // Export Subtitle File
  const handleExportSubs = (format: 'srt' | 'vtt' | 'ass' | 'txt') => {
    audioEngine.playSfx('ding');
    const title = 'CapCut_Vietsub_Project';
    if (format === 'srt') {
      const content = generateSrtContent(subtitles, subtitleMode);
      downloadFile(content, `${title}.srt`, 'text/plain;charset=utf-8');
    } else if (format === 'vtt') {
      const content = generateVttContent(subtitles, subtitleMode);
      downloadFile(content, `${title}.vtt`, 'text/vtt;charset=utf-8');
    } else if (format === 'ass') {
      const content = generateAssKaraokeContent(subtitles);
      downloadFile(content, `${title}.ass`, 'text/plain;charset=utf-8');
    } else {
      const content = subtitles.map((s) => `[${s.start}s - ${s.end}s] ${s.textVi}`).join('\n');
      downloadFile(content, `${title}.txt`, 'text/plain;charset=utf-8');
    }
  };

  // Helper for multi-channel audio update
  const updateAudioCh = (channel: keyof MultiChannelAudioConfig, field: string, val: any) => {
    if (!onChangeAudioConfig || !audioConfig) return;
    onChangeAudioConfig({
      ...audioConfig,
      [channel]: {
        ...(audioConfig[channel] as any),
        [field]: val,
      },
    });
  };

  const tabs: {
    id: 'vietsub' | 'voiceover' | 'multichannel' | 'clip' | 'ai-tools';
    label: string;
    icon: React.ReactNode;
  }[] = [
    { id: 'vietsub', label: 'Vietsub AI', icon: <Subtitles className="w-3.5 h-3.5" /> },
    { id: 'voiceover', label: 'Lồng tiếng', icon: <Headphones className="w-3.5 h-3.5" /> },
    { id: 'multichannel', label: 'Hòa âm', icon: <Volume2 className="w-3.5 h-3.5" /> },
    { id: 'clip', label: 'Clip & FX', icon: <Film className="w-3.5 h-3.5" /> },
    { id: 'ai-tools', label: 'Công cụ AI', icon: <Sparkles className="w-3.5 h-3.5" /> },
  ];

  const filteredSubs = subtitles.filter(
    (s) =>
      s.textVi.toLowerCase().includes(subSearchQuery.toLowerCase()) ||
      (s.textOriginal && s.textOriginal.toLowerCase().includes(subSearchQuery.toLowerCase()))
  );

  return (
    <aside className="w-80 lg:w-84 xl:w-96 bg-[#0f172a] border border-slate-800/80 rounded-xl flex flex-col shrink-0 select-none overflow-hidden text-slate-200 shadow-lg shadow-black/20">
      {/* Top Header: Clean, Uncluttered Inspector */}
      <div className="h-10 px-3 bg-[#111c35] border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Sliders className="w-3 h-3" />
          </div>
          <span className="font-semibold text-xs text-slate-100 tracking-tight">
            AI Sub-Tools
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono tabular-nums text-[11px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
            {subtitles.length} câu thoại
          </span>
          {onOpenFullScreen && (
            <button
              onClick={onOpenFullScreen}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Toàn màn hình rạp chiếu (F)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Segmented Tab Navigation - Compact, Single-Line */}
      <div className="p-1 bg-[#0b1120] border-b border-slate-800 flex items-center gap-0.5 shrink-0 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-1.5 px-1 rounded-md text-[11px] font-medium flex items-center justify-center gap-1 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
            }`}
          >
            {tab.icon}
            <span className="truncate">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Structured Content Area - Smaller Text Padding & Tight Layout */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 text-xs bg-[#0b1120]/40">
        {/* ========================================================= */}
        {/* TAB 1: VIETSUB AI & CUES LIST                             */}
        {/* ========================================================= */}
        {activeTab === 'vietsub' && (
          <div className="space-y-2.5">
            {/* Quick Display Mode & Sync Bar */}
            <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-[#0f172a] border border-slate-800 text-[11px]">
              <div className="flex items-center gap-1">
                <span className="text-slate-400 text-[10px]">Hiển thị:</span>
                <select
                  value={subtitleMode}
                  onChange={(e) => setSubtitleMode(e.target.value as any)}
                  className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[11px] text-slate-200 font-medium focus:outline-none"
                >
                  <option value="bilingual">Song ngữ (Việt - Anh)</option>
                  <option value="vi-only">Chỉ Tiếng Việt</option>
                  <option value="original-only">Chỉ Ngôn ngữ gốc</option>
                </select>
              </div>

              <div className="flex items-center gap-1 font-mono text-[10px]">
                <span className="text-slate-500">Khớp:</span>
                <button
                  onClick={() => setSubtitleOffset((o) => Number((o - 0.5).toFixed(1)))}
                  className="px-1 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  -0.5s
                </button>
                <span className="text-indigo-400 font-semibold">{subtitleOffset}s</span>
                <button
                  onClick={() => setSubtitleOffset((o) => Number((o + 0.5).toFixed(1)))}
                  className="px-1 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  +0.5s
                </button>
              </div>
            </div>

            {/* AI Polish Actions Strip */}
            <div className="p-2 rounded-lg bg-[#0f172a] border border-slate-800 space-y-1.5">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Xử lý Phụ đề Thông minh (Gemini AI)
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => handleEnhanceVietnamese('restore_diacritics')}
                  disabled={isEnhancing || subtitles.length === 0}
                  className="h-7 px-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-indigo-300 text-[11px] font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40"
                  title="Tự động thêm dấu tiếng Việt chuẩn xác"
                >
                  <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span className="truncate">Sửa dấu tiếng Việt</span>
                </button>

                <button
                  onClick={() => handleEnhanceVietnamese('cinema_tone')}
                  disabled={isEnhancing || subtitles.length === 0}
                  className="h-7 px-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-300 text-[11px] font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40"
                  title="Văn phong điện ảnh Hollywood"
                >
                  <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="truncate">Văn phong Điện ảnh</span>
                </button>

                <button
                  onClick={() => handleEnhanceVietnamese('smart_split')}
                  disabled={isEnhancing || subtitles.length === 0}
                  className="h-7 px-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-300 text-[11px] font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40"
                  title="Tách câu theo nhịp thoại"
                >
                  <Split className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span className="truncate">Tách câu chuẩn</span>
                </button>

                {onOpenAutoTranscription && (
                  <button
                    onClick={onOpenAutoTranscription}
                    className="h-7 px-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-rose-300 text-[11px] font-medium flex items-center gap-1.5 transition-colors"
                    title="Chuyển âm thanh thành phụ đề"
                  >
                    <Mic className="w-3 h-3 text-rose-400 shrink-0" />
                    <span className="truncate">Tạo từ âm thanh</span>
                  </button>
                )}
              </div>

              {enhanceSuccessMsg && (
                <div className="py-1 px-2 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-[10px] font-medium flex items-center gap-1 animate-in fade-in">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>{enhanceSuccessMsg}</span>
                </div>
              )}
            </div>

            {/* Subtitle Cue List Header */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search className="w-3 h-3 text-slate-500 absolute left-2 top-2" />
                  <input
                    type="text"
                    value={subSearchQuery}
                    onChange={(e) => setSubSearchQuery(e.target.value)}
                    placeholder="Tìm câu thoại..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-md pl-6 pr-2 py-1 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  onClick={handleAddCueAtPlayhead}
                  className="h-6 px-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] flex items-center gap-1 transition-colors shrink-0 shadow-sm"
                  title="Thêm câu phụ đề tại vị trí con trỏ hiện tại"
                >
                  <Plus className="w-3 h-3" />
                  <span>Thêm câu</span>
                </button>
              </div>

              {/* Subtitle Cues List - Compact Height, Small Padding */}
              <div className="space-y-1 max-h-[300px] overflow-y-auto pr-0.5">
                {filteredSubs.length > 0 ? (
                  filteredSubs.map((sub, idx) => {
                    const isSelected = sub.id === selectedSub?.id;
                    const isAtPlayhead = currentTime >= sub.start && currentTime <= sub.end;

                    return (
                      <div
                        key={sub.id}
                        onClick={() => {
                          setSelectedSubId(sub.id);
                          if (onSeek) onSeek(sub.start);
                        }}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-slate-800/90 border-indigo-500/70 shadow-sm ring-1 ring-indigo-500/30'
                            : isAtPlayhead
                            ? 'bg-indigo-950/40 border-indigo-500/40'
                            : 'bg-[#0f172a] hover:bg-slate-900 border-slate-800/80'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 font-sans">#{idx + 1}</span>
                            <span className="text-indigo-400 font-semibold tabular-nums">
                              {sub.start.toFixed(1)}s — {sub.end.toFixed(1)}s
                            </span>
                          </div>

                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleTestVoice(sub.textVi)}
                              className="p-1 rounded text-slate-400 hover:text-indigo-400 hover:bg-slate-800"
                              title="Nghe đọc thử"
                            >
                              <Play className="w-2.5 h-2.5 fill-current" />
                            </button>

                            <button
                              onClick={() => handleDeleteCue(sub.id)}
                              className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800"
                              title="Xóa câu"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>

                        {/* Inline Edit Vietnamese Text */}
                        <input
                          type="text"
                          value={sub.textVi}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            if (onUpdateSubtitles) {
                              onUpdateSubtitles(
                                subtitles.map((s) =>
                                  s.id === sub.id ? { ...s, textVi: e.target.value } : s
                                )
                              );
                            }
                          }}
                          className="w-full bg-transparent border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:bg-slate-900 rounded px-1 py-0.5 text-xs text-white font-medium focus:outline-none transition-colors"
                          placeholder="Nhập phụ đề tiếng Việt..."
                        />

                        {sub.textOriginal && (
                          <div className="text-[10px] text-slate-400 truncate px-1 mt-0.5">
                            {sub.textOriginal}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-slate-400 text-[11px] bg-[#0f172a] rounded-lg border border-slate-800">
                    Không tìm thấy câu phụ đề nào.
                  </div>
                )}
              </div>
            </div>

            {/* Subtitle Export Row */}
            <div className="pt-1 flex items-center justify-between gap-1 border-t border-slate-800 text-[10px]">
              <span className="text-slate-400">Xuất tệp:</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleExportSubs('srt')}
                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-mono"
                >
                  .SRT
                </button>
                <button
                  onClick={() => handleExportSubs('vtt')}
                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-mono"
                >
                  .VTT
                </button>
                <button
                  onClick={() => handleExportSubs('ass')}
                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-mono"
                >
                  .ASS (Karaoke)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: AI VOICEOVER & DUBBING                             */}
        {/* ========================================================= */}
        {activeTab === 'voiceover' && audioConfig && (
          <div className="space-y-2.5">
            {/* Hands-Free Auto Voiceover Mode Banner */}
            <div className="p-2.5 rounded-lg bg-gradient-to-r from-purple-950/70 to-indigo-950/70 border border-purple-500/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-xs text-purple-200">
                  <Headphones className="w-3.5 h-3.5 text-purple-400" />
                  <span>Thuyết Minh Tự Động (Hands-Free)</span>
                </div>
                <input
                  type="checkbox"
                  checked={audioConfig.aiVoiceover.handsFreeAutoRead}
                  onChange={(e) => updateAudioCh('aiVoiceover', 'handsFreeAutoRead', e.target.checked)}
                  className="rounded bg-slate-900 text-purple-600 focus:ring-0 w-3.5 h-3.5"
                />
              </div>
              <p className="text-[10px] text-purple-300/80 leading-snug">
                Hệ thống tự động phát âm thanh tiếng Việt khớp theo thời gian thực phụ đề. Bạn không cần phải dán mắt đọc từng dòng.
              </p>
            </div>

            {/* Voice Gender & Region Settings */}
            <div className="p-2.5 rounded-lg bg-[#0f172a] border border-slate-800 space-y-2">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Chọn Giọng Đọc AI Tiếng Việt
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => updateAudioCh('aiVoiceover', 'voiceGender', 'female')}
                  className={`py-1.5 px-2 rounded border text-[11px] font-medium transition-colors ${
                    audioConfig.aiVoiceover.voiceGender === 'female'
                      ? 'bg-purple-900/50 border-purple-500 text-purple-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Giọng Nữ (Lan / Mai)
                </button>

                <button
                  onClick={() => updateAudioCh('aiVoiceover', 'voiceGender', 'male')}
                  className={`py-1.5 px-2 rounded border text-[11px] font-medium transition-colors ${
                    audioConfig.aiVoiceover.voiceGender === 'male'
                      ? 'bg-purple-900/50 border-purple-500 text-purple-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Giọng Nam (Minh / Nam)
                </button>
              </div>

              {/* Accent Selector */}
              <div>
                <label className="text-[10px] font-medium text-slate-400 block mb-1">
                  Vùng miền:
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {(['north', 'central', 'south'] as const).map((region) => (
                    <button
                      key={region}
                      onClick={() => updateAudioCh('aiVoiceover', 'accentRegion', region)}
                      className={`py-1 rounded text-[10px] font-medium border capitalize ${
                        audioConfig.aiVoiceover.accentRegion === region
                          ? 'bg-slate-800 border-indigo-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {region === 'north' ? 'Miền Bắc' : region === 'central' ? 'Miền Trung' : 'Miền Nam'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Volume & Ducking */}
              <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Âm lượng lồng tiếng:</span>
                  <span className="font-mono text-purple-400 font-semibold">
                    {audioConfig.aiVoiceover.volume}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={audioConfig.aiVoiceover.volume}
                  onChange={(e) => updateAudioCh('aiVoiceover', 'volume', Number(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded"
                />

                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-400 text-[10px]">Tự động hạ nhạc nền khi nói (Auto-Ducking):</span>
                  <input
                    type="checkbox"
                    checked={audioConfig.originalVideo.autoDucking ?? true}
                    onChange={(e) => updateAudioCh('originalVideo', 'autoDucking', e.target.checked)}
                    className="rounded bg-slate-900 text-indigo-600 focus:ring-0 w-3.5 h-3.5"
                  />
                </div>
              </div>

              {/* Test Voice Button */}
              <div className="pt-1">
                <button
                  onClick={() => handleTestVoice()}
                  className="w-full h-7 rounded bg-purple-600 hover:bg-purple-500 text-white font-medium text-[11px] flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Nghe thử giọng đọc mẫu</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: MULTI-CHANNEL AUDIO MIXER                          */}
        {/* ========================================================= */}
        {activeTab === 'multichannel' && audioConfig && (
          <div className="space-y-2">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-0.5">
              Bàn Hòa Âm 4 Kênh Độc Lập
            </div>

            {/* Matrix of Channels */}
            <div className="space-y-1.5">
              {/* Channel 1: Video Gốc */}
              <div className="p-2 rounded-lg bg-[#0f172a] border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 font-medium text-slate-200">
                    <Film className="w-3 h-3 text-cyan-400" />
                    <span>Kênh 1: Video Gốc</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-[10px]">
                    <button
                      onClick={() => updateAudioCh('originalVideo', 'isMuted', !audioConfig.originalVideo.isMuted)}
                      className={`px-1.5 py-0.5 rounded font-semibold ${
                        audioConfig.originalVideo.isMuted
                          ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      MUTE
                    </button>
                    <span className="text-cyan-400 w-8 text-right font-semibold">
                      {audioConfig.originalVideo.isMuted ? '0%' : `${audioConfig.originalVideo.volume}%`}
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="150"
                  value={audioConfig.originalVideo.volume}
                  onChange={(e) => updateAudioCh('originalVideo', 'volume', Number(e.target.value))}
                  className="w-full accent-cyan-500 h-1 bg-slate-800 rounded"
                />
              </div>

              {/* Channel 2: AI Dubbing */}
              <div className="p-2 rounded-lg bg-[#0f172a] border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 font-medium text-slate-200">
                    <Headphones className="w-3 h-3 text-purple-400" />
                    <span>Kênh 2: Lồng Tiếng AI</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-[10px]">
                    <button
                      onClick={() => updateAudioCh('aiVoiceover', 'isMuted', !audioConfig.aiVoiceover.isMuted)}
                      className={`px-1.5 py-0.5 rounded font-semibold ${
                        audioConfig.aiVoiceover.isMuted
                          ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      MUTE
                    </button>
                    <span className="text-purple-400 w-8 text-right font-semibold">
                      {audioConfig.aiVoiceover.isMuted ? '0%' : `${audioConfig.aiVoiceover.volume}%`}
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={audioConfig.aiVoiceover.volume}
                  onChange={(e) => updateAudioCh('aiVoiceover', 'volume', Number(e.target.value))}
                  className="w-full accent-purple-500 h-1 bg-slate-800 rounded"
                />
              </div>

              {/* Channel 3: Nhạc nền BGM */}
              <div className="p-2 rounded-lg bg-[#0f172a] border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 font-medium text-slate-200">
                    <Music className="w-3 h-3 text-pink-400" />
                    <span>Kênh 3: Nhạc Nền (BGM)</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-[10px]">
                    <button
                      onClick={() => updateAudioCh('bgm', 'isMuted', !audioConfig.bgm.isMuted)}
                      className={`px-1.5 py-0.5 rounded font-semibold ${
                        audioConfig.bgm.isMuted
                          ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      MUTE
                    </button>
                    <span className="text-pink-400 w-8 text-right font-semibold">
                      {audioConfig.bgm.isMuted ? '0%' : `${audioConfig.bgm.volume}%`}
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={audioConfig.bgm.volume}
                  onChange={(e) => updateAudioCh('bgm', 'volume', Number(e.target.value))}
                  className="w-full accent-pink-500 h-1 bg-slate-800 rounded"
                />
              </div>

              {/* Channel 4: Sound FX */}
              <div className="p-2 rounded-lg bg-[#0f172a] border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 font-medium text-slate-200">
                    <Volume2 className="w-3 h-3 text-amber-400" />
                    <span>Kênh 4: Hiệu Ứng (SFX)</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-[10px]">
                    <button
                      onClick={() => updateAudioCh('sfx', 'isMuted', !audioConfig.sfx.isMuted)}
                      className={`px-1.5 py-0.5 rounded font-semibold ${
                        audioConfig.sfx.isMuted
                          ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      MUTE
                    </button>
                    <span className="text-amber-400 w-8 text-right font-semibold">
                      {audioConfig.sfx.isMuted ? '0%' : `${audioConfig.sfx.volume}%`}
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="150"
                  value={audioConfig.sfx.volume}
                  onChange={(e) => updateAudioCh('sfx', 'volume', Number(e.target.value))}
                  className="w-full accent-amber-500 h-1 bg-slate-800 rounded"
                />
              </div>

              {/* Master Volume */}
              <div className="p-2 rounded-lg bg-[#111c35] border border-indigo-500/30 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-white">
                  <span>Kênh Tổng (Master Output)</span>
                  <span className="font-mono text-indigo-300">{audioConfig.master.volume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="150"
                  value={audioConfig.master.volume}
                  onChange={(e) => updateAudioCh('master', 'volume', Number(e.target.value))}
                  className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded"
                />
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: CLIP PROPERTIES & EFFECTS                          */}
        {/* ========================================================= */}
        {activeTab === 'clip' && (
          <div className="space-y-2.5">
            {activeClip ? (
              <div className="space-y-2">
                {/* Clip Meta */}
                <div className="p-2 rounded-lg bg-[#0f172a] border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-white truncate max-w-[180px]">
                      {activeClip.name}
                    </span>
                    <span className="text-[10px] font-mono uppercase bg-slate-800 px-1 rounded text-cyan-400">
                      {activeClip.type}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-0.5">
                    <span>Độ dài: {formatFullTimecode(activeClip.duration)}</span>
                    <button
                      onClick={() => onExtractAudio(activeClip)}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[10px] font-semibold transition-colors"
                    >
                      Tách âm thanh
                    </button>
                  </div>
                </div>

                {/* Video Transform */}
                <div className="p-2 rounded-lg bg-[#0f172a] border border-slate-800 space-y-1.5">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Biến đổi hình ảnh (Transform)
                  </div>

                  {/* Scale */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Thu phóng (Scale):</span>
                      <span className="font-mono text-slate-200">
                        {Math.round(activeClip.transform.scale * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.05"
                      value={activeClip.transform.scale}
                      onChange={(e) =>
                        onUpdateClip(activeClip.id, (c) => ({
                          ...c,
                          transform: { ...c.transform, scale: Number(e.target.value) },
                        }))
                      }
                      className="w-full accent-indigo-500 h-1 bg-slate-800 rounded"
                    />
                  </div>

                  {/* Rotation & Flip */}
                  <div className="grid grid-cols-3 gap-1 pt-1">
                    <button
                      onClick={() =>
                        onUpdateClip(activeClip.id, (c) => ({
                          ...c,
                          transform: {
                            ...c.transform,
                            rotation: (c.transform.rotation + 90) % 360,
                          },
                        }))
                      }
                      className="py-1 px-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 flex items-center justify-center gap-1"
                    >
                      <RotateCw className="w-3 h-3" />
                      <span>Xoay 90°</span>
                    </button>

                    <button
                      onClick={() =>
                        onUpdateClip(activeClip.id, (c) => ({
                          ...c,
                          transform: { ...c.transform, flipH: !c.transform.flipH },
                        }))
                      }
                      className={`py-1 px-1.5 rounded border text-[10px] ${
                        activeClip.transform.flipH
                          ? 'bg-indigo-950 border-indigo-500 text-indigo-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      Lật Ngang
                    </button>

                    <button
                      onClick={() =>
                        onUpdateClip(activeClip.id, (c) => ({
                          ...c,
                          transform: { ...c.transform, flipV: !c.transform.flipV },
                        }))
                      }
                      className={`py-1 px-1.5 rounded border text-[10px] ${
                        activeClip.transform.flipV
                          ? 'bg-indigo-950 border-indigo-500 text-indigo-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      Lật Dọc
                    </button>
                  </div>
                </div>

                {/* Color Filters */}
                <div className="p-2 rounded-lg bg-[#0f172a] border border-slate-800 space-y-1.5">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Bộ lọc màu sắc (Cinema LUTs)
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    {[
                      { id: 'none', label: 'Tự nhiên' },
                      { id: 'cinematic-teal-orange', label: 'Teal & Orange' },
                      { id: 'sunset-glow', label: 'Hoàng hôn ấm' },
                      { id: 'black-white-noir', label: 'Đen trắng Noir' },
                      { id: 'vivid-hdr', label: 'Vivid HDR' },
                      { id: 'vintage-90s', label: 'Cổ điển Vintage' },
                    ].map((filt) => (
                      <button
                        key={filt.id}
                        onClick={() =>
                          onUpdateClip(activeClip.id, (c) => ({
                            ...c,
                            filter: { ...c.filter, preset: filt.id as any },
                          }))
                        }
                        className={`py-1 px-1.5 rounded border truncate text-left ${
                          activeClip.filter.preset === filt.id
                            ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300 font-medium'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {filt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-[#0f172a] border border-slate-800 text-center text-slate-400 text-xs">
                Chưa chọn clip nào trên timeline. Nhấp vào một clip để điều chỉnh hiệu ứng.
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: AI SMART TOOLS & CREATION                          */}
        {/* ========================================================= */}
        {activeTab === 'ai-tools' && (
          <div className="space-y-2">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-0.5">
              Hệ Sinh Thái AI CapCut Pro
            </div>

            {/* Speech to text */}
            {onOpenAutoTranscription && (
              <div
                onClick={onOpenAutoTranscription}
                className="p-2.5 rounded-lg bg-[#0f172a] hover:bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer space-y-1"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-rose-400" />
                    <span className="font-semibold text-xs text-white">
                      Phiên Âm Tự Động (Speech-to-Text)
                    </span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <p className="text-[10px] text-slate-400 leading-snug">
                  Gemini AI nhận diện giọng nói từ âm thanh/video và tạo ra các câu phụ đề tiếng Việt chính xác.
                </p>
              </div>
            )}

            {/* Prompt to video creation */}
            {onOpenAiCreation && (
              <div
                onClick={onOpenAiCreation}
                className="p-2.5 rounded-lg bg-[#0f172a] hover:bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer space-y-1"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-amber-400" />
                    <span className="font-semibold text-xs text-white">
                      Tạo Dự Án Video từ Câu Lệnh (Prompt)
                    </span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <p className="text-[10px] text-slate-400 leading-snug">
                  Mô tả kịch bản mong muốn để AI sinh clip, phân cảnh và thoại song ngữ tự động.
                </p>
              </div>
            )}

            {/* 1-Click Vietsub Bookmarklet */}
            {onOpenBookmarklet && (
              <div
                onClick={onOpenBookmarklet}
                className="p-2.5 rounded-lg bg-[#0f172a] hover:bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer space-y-1"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Subtitles className="w-4 h-4 text-cyan-400" />
                    <span className="font-semibold text-xs text-white">
                      Bookmarklet Vietsub 1-Click
                    </span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <p className="text-[10px] text-slate-400 leading-snug">
                  Kéo nút vào bookmark trình duyệt để hiển thị phụ đề song ngữ trực tiếp trên YouTube, Netflix, Coursera.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
