import React, { useState, useRef } from 'react';
import {
  Film,
  Music,
  Mic,
  Upload,
  Play,
  Plus,
  Volume2,
  Check,
  StopCircle,
  Radio,
  Search,
  FolderOpen,
} from 'lucide-react';
import { SAMPLE_VIDEOS, SOUND_FX_LIBRARY } from '../utils/sampleData';
import { audioEngine } from '../utils/audioEngine';
import { VideoClip, AudioClip, SubtitleSegment, SoundFxItem } from '../types/editor';
import { readMediaFullDuration, formatFullTimecode } from '../utils/mediaUtils';

interface AssetSidebarProps {
  onAddVideoClip: (clip: VideoClip) => void;
  onAddAudioClip: (clip: AudioClip) => void;
  onSetSubtitles?: (subtitles: SubtitleSegment[]) => void;
  currentTime: number;
}

export const AssetSidebar: React.FC<AssetSidebarProps> = ({
  onAddVideoClip,
  onAddAudioClip,
  currentTime,
}) => {
  const [activeTab, setActiveTab] = useState<'video' | 'audio' | 'sfx' | 'record'>('video');
  const [searchQuery, setSearchQuery] = useState('');

  // Voiceover Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const timerRef = useRef<any>(null);

  // File upload input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Audio preview playing key
  const [playingSfxKey, setPlayingSfxKey] = useState<string | null>(null);

  // Start Mic Voiceover Recording
  const handleStartRecording = async () => {
    try {
      await audioEngine.startVoiceoverRecording();
      setIsRecording(true);
      setRecordDuration(0);
      timerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      alert('Không thể mở micro: ' + (err?.message || 'Vui lòng cấp quyền micro trong trình duyệt'));
    }
  };

  // Stop Mic Voiceover Recording & insert to timeline
  const handleStopRecording = async () => {
    clearInterval(timerRef.current);
    setIsRecording(false);
    const { url, duration } = await audioEngine.stopVoiceoverRecording();

    if (url && duration > 0.2) {
      const newAudioClip: AudioClip = {
        id: `voiceover_${Date.now()}`,
        name: `Thu âm (${Math.round(duration)}s)`,
        type: 'voiceover',
        src: url,
        startTime: currentTime,
        duration: Math.max(1, Number(duration.toFixed(2))),
        volume: 120,
        isMuted: false,
        color: '#10b981',
        waveform: [40, 70, 95, 80, 60, 85, 50, 30],
      };
      onAddAudioClip(newAudioClip);
      audioEngine.playSfx('ding');
    }
  };

  // Insert Sound FX at playhead
  const handleInsertSfx = async (item: SoundFxItem) => {
    const { url, duration } = await audioEngine.renderSfxBufferUrl(item.sfxKey);
    const newAudioClip: AudioClip = {
      id: `sfx_${Date.now()}_${item.id}`,
      name: item.name,
      type: 'sfx',
      src: url,
      startTime: currentTime,
      duration: duration,
      volume: 100,
      isMuted: false,
      color: '#38bdf8',
      waveform: [30, 60, 90, 70, 40, 20],
    };
    onAddAudioClip(newAudioClip);
    audioEngine.playSfx(item.sfxKey);
  };

  const handlePreviewSfx = (sfxKey: any) => {
    setPlayingSfxKey(sfxKey);
    audioEngine.playSfx(sfxKey);
    setTimeout(() => setPlayingSfxKey(null), 800);
  };

  // BGM Library
  const bgmLibrary = [
    {
      id: 'bgm_1',
      name: 'Chill Lo-Fi Sunset',
      genre: 'Lo-Fi',
      duration: 38,
      bpm: 82,
      color: '#ec4899',
    },
    {
      id: 'bgm_2',
      name: 'Cinematic Orchestral Rise',
      genre: 'Cinematic',
      duration: 45,
      bpm: 110,
      color: '#a855f7',
    },
    {
      id: 'bgm_3',
      name: 'Acoustic Travel Morning',
      genre: 'Acoustic',
      duration: 32,
      bpm: 95,
      color: '#10b981',
    },
    {
      id: 'bgm_4',
      name: 'Tech Future Horizon',
      genre: 'Electronic',
      duration: 50,
      bpm: 124,
      color: '#06b6d4',
    },
  ];

  const handleAddBgm = (bgm: typeof bgmLibrary[0]) => {
    const newAudio: AudioClip = {
      id: `bgm_${Date.now()}_${bgm.id}`,
      name: bgm.name,
      type: 'music',
      src: `sample_bgm_${bgm.id}`,
      startTime: currentTime,
      duration: bgm.duration,
      volume: 60,
      isMuted: false,
      color: bgm.color,
      waveform: [35, 55, 75, 90, 70, 45, 60, 80, 65, 40, 50, 70],
    };
    onAddAudioClip(newAudio);
    audioEngine.playSfx('ding');
  };

  // Upload custom file (Video / Audio / Image) with FULL DURATION support
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    try {
      const mediaInfo = await readMediaFullDuration(file);

      if (mediaInfo.type === 'video' || mediaInfo.type === 'image') {
        const newClip: VideoClip = {
          id: `uploaded_${Date.now()}`,
          type: mediaInfo.type,
          name: file.name,
          src: mediaInfo.url,
          thumbnail: mediaInfo.thumbnail,
          startTime: currentTime,
          duration: mediaInfo.duration,
          sourceStart: 0,
          sourceDuration: mediaInfo.duration,
          volume: 100,
          isMuted: false,
          transform: { rotation: 0, flipH: false, flipV: false, scale: 1, x: 0, y: 0 },
          filter: {
            preset: 'none',
            brightness: 100,
            contrast: 100,
            saturation: 100,
            temperature: 0,
            vignette: 0,
          },
          transition: { type: 'none', duration: 0.5 },
        };
        onAddVideoClip(newClip);
        audioEngine.playSfx('ding');
      } else if (mediaInfo.type === 'audio') {
        const newAudio: AudioClip = {
          id: `uploaded_audio_${Date.now()}`,
          name: file.name,
          type: 'music',
          src: mediaInfo.url,
          startTime: currentTime,
          duration: mediaInfo.duration,
          volume: 90,
          isMuted: false,
          color: '#06b6d4',
          waveform: [40, 60, 85, 95, 75, 50, 30, 70, 90, 65, 45, 80, 55],
        };
        onAddAudioClip(newAudio);
        audioEngine.playSfx('ding');
      }
    } catch (err) {
      console.error('Failed to load media with full duration:', err);
    }
  };

  const filteredVideos = SAMPLE_VIDEOS.filter((v) =>
    v.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredSfx = SOUND_FX_LIBRARY.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredBgm = bgmLibrary.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="w-56 lg:w-60 xl:w-64 bg-[#0f172a] border border-slate-800/80 rounded-xl flex flex-col shrink-0 select-none overflow-hidden text-slate-200 shadow-lg shadow-black/20">
      {/* Top Header: Narrow Media Pool Bin */}
      <div className="h-10 px-3 bg-[#111c35] border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <FolderOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="font-semibold text-xs text-slate-100 truncate">
            Media Assets
          </span>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] transition-colors shrink-0 shadow-sm"
          title="Tải lên video hoặc âm thanh"
        >
          <Upload className="w-3 h-3" />
          <span>Tải tệp</span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*,image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Narrow Tab Navigation */}
      <div className="p-1 bg-[#0b1120] border-b border-slate-800 flex items-center gap-0.5 shrink-0">
        <button
          onClick={() => setActiveTab('video')}
          className={`flex-1 py-1 px-1 rounded text-[11px] font-medium flex items-center justify-center gap-1 transition-colors ${
            activeTab === 'video'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Film className="w-3 h-3 text-cyan-400" />
          <span>Video</span>
        </button>

        <button
          onClick={() => setActiveTab('audio')}
          className={`flex-1 py-1 px-1 rounded text-[11px] font-medium flex items-center justify-center gap-1 transition-colors ${
            activeTab === 'audio'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Music className="w-3 h-3 text-pink-400" />
          <span>Nhạc</span>
        </button>

        <button
          onClick={() => setActiveTab('sfx')}
          className={`flex-1 py-1 px-1 rounded text-[11px] font-medium flex items-center justify-center gap-1 transition-colors ${
            activeTab === 'sfx'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Volume2 className="w-3 h-3 text-amber-400" />
          <span>SFX</span>
        </button>

        <button
          onClick={() => setActiveTab('record')}
          className={`flex-1 py-1 px-1 rounded text-[11px] font-medium flex items-center justify-center gap-1 transition-colors ${
            activeTab === 'record'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Mic className="w-3 h-3 text-emerald-400" />
          <span>Mic</span>
        </button>
      </div>

      {/* Search Input */}
      {activeTab !== 'record' && (
        <div className="p-2 border-b border-slate-800/80 bg-[#0b1120]/40">
          <div className="relative">
            <Search className="w-3 h-3 text-slate-500 absolute left-2 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tài nguyên..."
              className="w-full bg-slate-900 border border-slate-800 rounded-md pl-6 pr-2 py-1 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      )}

      {/* Asset Content List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-[#0b1120]/30">
        {/* TAB 1: VIDEO ASSETS */}
        {activeTab === 'video' && (
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase font-bold text-slate-400 px-1 py-0.5">
              Kho Video Mẫu ({filteredVideos.length})
            </div>

            {filteredVideos.map((video) => (
              <div
                key={video.id}
                className="group relative bg-[#0f172a] hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg p-1.5 flex items-center gap-2 transition-colors cursor-pointer"
                onClick={() => {
                  const newClip: VideoClip = {
                    id: `clip_${Date.now()}_${video.id}`,
                    type: 'video',
                    name: video.title,
                    src: video.url,
                    thumbnail: video.thumbnail,
                    startTime: currentTime,
                    duration: video.duration,
                    sourceStart: 0,
                    sourceDuration: video.duration,
                    volume: 100,
                    isMuted: false,
                    transform: { rotation: 0, flipH: false, flipV: false, scale: 1, x: 0, y: 0 },
                    filter: {
                      preset: 'none',
                      brightness: 100,
                      contrast: 100,
                      saturation: 100,
                      temperature: 0,
                      vignette: 0,
                    },
                    transition: { type: 'none', duration: 0.5 },
                  };
                  onAddVideoClip(newClip);
                  audioEngine.playSfx('ding');
                }}
              >
                <div className="w-12 h-10 rounded bg-slate-950 overflow-hidden relative shrink-0 border border-slate-800 flex items-center justify-center">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Plus className="w-4 h-4 text-white" />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-slate-200 truncate leading-snug">
                    {video.title}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                    <span>{formatFullTimecode(video.duration)}</span>
                    <span>·</span>
                    <span className="text-cyan-400">1080p</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="opacity-0 group-hover:opacity-100 p-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-opacity shrink-0"
                  title="Thêm vào Timeline"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* TAB 2: AUDIO / BGM */}
        {activeTab === 'audio' && (
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase font-bold text-slate-400 px-1 py-0.5">
              Nhạc nền CapCut ({filteredBgm.length})
            </div>

            {filteredBgm.map((bgm) => (
              <div
                key={bgm.id}
                onClick={() => handleAddBgm(bgm)}
                className="group bg-[#0f172a] hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg p-2 flex items-center justify-between gap-2 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center text-white shrink-0 shadow-sm"
                    style={{ backgroundColor: `${bgm.color}30`, borderColor: bgm.color }}
                  >
                    <Music className="w-3.5 h-3.5" style={{ color: bgm.color }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium text-slate-200 truncate">
                      {bgm.name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                      <span>{bgm.genre}</span>
                      <span>·</span>
                      <span>{bgm.duration}s</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="p-1 rounded bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-400 transition-colors shrink-0"
                  title="Thêm track nhạc"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: SOUND FX */}
        {activeTab === 'sfx' && (
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase font-bold text-slate-400 px-1 py-0.5">
              Hiệu ứng âm thanh ({filteredSfx.length})
            </div>

            {filteredSfx.map((sfx) => (
              <div
                key={sfx.id}
                className="group bg-[#0f172a] hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg p-2 flex items-center justify-between gap-2 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={() => handlePreviewSfx(sfx.sfxKey)}
                    className="w-6 h-6 rounded-md bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-amber-400 transition-colors shrink-0"
                    title="Nghe thử"
                  >
                    {playingSfxKey === sfx.sfxKey ? (
                      <Radio className="w-3 h-3 animate-pulse text-amber-400" />
                    ) : (
                      <Play className="w-3 h-3 fill-current ml-0.5" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <div className="text-[11px] font-medium text-slate-200 truncate">
                      {sfx.name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {sfx.category}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleInsertSfx(sfx)}
                  className="p-1 rounded bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-400 transition-colors shrink-0"
                  title="Chèn vào timeline"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: LIVE MIC RECORD */}
        {activeTab === 'record' && (
          <div className="p-3 bg-[#0f172a] rounded-lg border border-slate-800 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
              <Mic className={`w-6 h-6 ${isRecording ? 'animate-bounce text-rose-500' : ''}`} />
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-200">
                {isRecording ? 'Đang thu âm...' : 'Thu âm trực tiếp'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {isRecording
                  ? `Thời lượng: ${recordDuration}s`
                  : 'Ghi âm giọng nói và chèn ngay vào Timeline'}
              </div>
            </div>

            {isRecording ? (
              <button
                onClick={handleStopRecording}
                className="w-full py-1.5 px-3 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-rose-600/20"
              >
                <StopCircle className="w-3.5 h-3.5" />
                <span>Dừng & Chèn ({recordDuration}s)</span>
              </button>
            ) : (
              <button
                onClick={handleStartRecording}
                className="w-full py-1.5 px-3 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-emerald-600/20"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Bắt đầu thu âm</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom Drop hint */}
      <div className="p-2 border-t border-slate-800 bg-[#0b1120] text-center">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-1.5 rounded border border-dashed border-slate-700 hover:border-indigo-500 text-slate-400 hover:text-slate-200 text-[10px] font-medium transition-colors"
        >
          + Thả tệp hoặc nhấp để tải lên
        </button>
      </div>
    </aside>
  );
};
