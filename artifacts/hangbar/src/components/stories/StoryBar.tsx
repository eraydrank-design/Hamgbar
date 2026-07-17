import { useRef, useState } from 'react';
import { Plus, User } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { useStories, type StoryGroup } from '@/hooks/use-stories';
import { StoryViewer } from './StoryViewer';
import { StoryCreator } from './StoryCreator';

// ── Ring gradient constants ────────────────────────────────────────────────────
const RING_UNSEEN = 'conic-gradient(from 0deg, #C9A84C, #F5D78E, #8B6914, #C9A84C 360deg)';
const RING_SEEN   = 'conic-gradient(from 0deg, #3f3f46, #3f3f46 360deg)';
const RING_OWN    = 'conic-gradient(from 0deg, #C9A84C, #F5D78E, #8B6914, #C9A84C 360deg)';

// ── Single story circle ───────────────────────────────────────────────────────
function StoryCircle({
  photoUrl,
  displayName,
  ringStyle,
  onClick,
}: {
  photoUrl:    string;
  displayName: string;
  ringStyle:   string;
  onClick:     () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
    >
      <div
        className="w-[66px] h-[66px] rounded-full p-[2.5px] flex items-center justify-center"
        style={{ background: ringStyle }}
      >
        <div className="w-full h-full rounded-full bg-background border-2 border-background overflow-hidden flex items-center justify-center">
          {photoUrl ? (
            <img src={photoUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <User className="w-7 h-7 text-muted-foreground" />
          )}
        </div>
      </div>
      <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors truncate max-w-[66px] text-center leading-none">
        {displayName.split(' ')[0]}
      </span>
    </button>
  );
}

// ── StoryBar ──────────────────────────────────────────────────────────────────
export function StoryBar() {
  const { user, userData } = useAuth();
  const { storyGroups, loading, refetch } = useStories(user?.id);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [viewerOpen,    setViewerOpen]    = useState(false);
  const [viewerGroupIdx, setViewerGroupIdx] = useState(0);
  const [creatorOpen,   setCreatorOpen]   = useState(false);

  if (!user) return null;

  const myDisplayName = (userData?.display_name as string) ?? 'Ben';
  const myPhoto       = (userData?.photo_url    as string) ?? '';

  const myGroupIdx = storyGroups.findIndex((g) => g.userId === user.id);
  const hasMyStory = myGroupIdx >= 0;
  const otherGroups: Array<{ group: StoryGroup; globalIdx: number }> = storyGroups
    .map((g, i) => ({ group: g, globalIdx: i }))
    .filter(({ group }) => group.userId !== user.id);

  const openViewer = (groupIdx: number) => {
    setViewerGroupIdx(groupIdx);
    setViewerOpen(true);
  };

  const openMyViewer = () => {
    if (hasMyStory) openViewer(myGroupIdx);
    else setCreatorOpen(true);
  };

  const handleViewerClose = () => {
    setViewerOpen(false);
    refetch(); // refresh seen/unseen state after closing
  };

  return (
    <>
      {/* ── Horizontal scroll strip ───────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* ── My story ──────────────────────────────────────────────────── */}
        {hasMyStory ? (
          <StoryCircle
            photoUrl={myPhoto}
            displayName="Hikayem"
            ringStyle={RING_OWN}
            onClick={openMyViewer}
          />
        ) : (
          <button
            type="button"
            onClick={() => setCreatorOpen(true)}
            className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
          >
            <div
              className="w-[66px] h-[66px] rounded-full p-[2.5px] flex items-center justify-center"
              style={{ background: RING_SEEN }}
            >
              <div className="w-full h-full rounded-full bg-background border-2 border-background overflow-hidden relative flex items-center justify-center">
                {myPhoto ? (
                  <img src={myPhoto} alt="" className="w-full h-full object-cover opacity-40" />
                ) : (
                  <User className="w-7 h-7 text-muted-foreground opacity-40" />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Plus className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
            <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors truncate max-w-[66px] text-center leading-none">
              Hikaye ekle
            </span>
          </button>
        )}

        {/* ── Skeletons while loading ──────────────────────────────────── */}
        {loading &&
          [1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div className="w-[66px] h-[66px] rounded-full bg-white/5 animate-pulse" />
              <div className="w-10 h-2 rounded bg-white/5 animate-pulse" />
            </div>
          ))}

        {/* ── Other users ─────────────────────────────────────────────── */}
        {!loading &&
          otherGroups.map(({ group, globalIdx }) => (
            <StoryCircle
              key={group.userId}
              photoUrl={group.photo_url}
              displayName={group.display_name}
              ringStyle={group.hasUnseen ? RING_UNSEEN : RING_SEEN}
              onClick={() => openViewer(globalIdx)}
            />
          ))}
      </div>

      {/* ── Fullscreen viewer ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {viewerOpen && (
          <StoryViewer
            storyGroups={storyGroups}
            initialGroupIdx={viewerGroupIdx}
            myUserId={user.id}
            myDisplayName={myDisplayName}
            onViewRecorded={refetch}   /* ← triggers immediate UI refresh */
            onClose={handleViewerClose}
          />
        )}
      </AnimatePresence>

      {/* ── Story creator ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {creatorOpen && (
          <StoryCreator
            myUserId={user.id}
            myDisplayName={myDisplayName}
            myPhoto={myPhoto}
            onClose={() => { setCreatorOpen(false); refetch(); }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
