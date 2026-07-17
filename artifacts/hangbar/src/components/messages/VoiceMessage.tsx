import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';

interface Props {
  url: string;
  /** Stored duration in seconds */
  duration: number;
  isMine: boolean;
}

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// Fixed waveform heights for visual variety (20 bars)
const WAVEFORM_HEIGHTS = [3, 6, 9, 7, 4, 8, 11, 6, 3, 9, 7, 5, 8, 4, 10, 6, 4, 9, 7, 5];

export function VoiceMessage({ url, duration, isMine }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0–100
  const [currentTime, setCurrentTime] = useState(0);
  const [realDuration, setRealDuration] = useState(duration);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onMeta = () => {
      if (isFinite(audio.duration)) setRealDuration(Math.floor(audio.duration));
    };
    const onTime = () => {
      setCurrentTime(audio.currentTime);
      setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
    };
    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().catch(() => {});
      setPlaying(true);
    }
  };

  const displayTime = playing ? fmtDuration(currentTime) : fmtDuration(realDuration);

  return (
    <div className="flex items-center gap-2 min-w-[180px] max-w-[220px] py-0.5">
      <audio ref={audioRef} src={url} preload="metadata" />

      {/* Play / Pause */}
      <button
        type="button"
        onClick={toggle}
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
          isMine ? 'bg-primary-foreground/20 hover:bg-primary-foreground/30' : 'bg-primary/20 hover:bg-primary/30'
        }`}
      >
        {playing
          ? <Pause className="w-3.5 h-3.5" />
          : <Play className="w-3.5 h-3.5 ml-0.5" />
        }
      </button>

      {/* Waveform + time */}
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-center gap-px h-[14px]">
          {WAVEFORM_HEIGHTS.map((h, i) => {
            const barPct = (i / WAVEFORM_HEIGHTS.length) * 100;
            const active = barPct <= progress;
            return (
              <div
                key={i}
                className={`w-[3px] rounded-full transition-colors flex-shrink-0 ${
                  active
                    ? (isMine ? 'bg-primary-foreground' : 'bg-primary')
                    : (isMine ? 'bg-primary-foreground/30' : 'bg-white/25')
                }`}
                style={{ height: `${h}px` }}
              />
            );
          })}
        </div>
        <span className={`text-[10px] leading-none ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          {displayTime}
        </span>
      </div>
    </div>
  );
}
