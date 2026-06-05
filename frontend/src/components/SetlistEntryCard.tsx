import { getSongKey } from '../lib/chords';
import type { SetlistEntry } from '../types';

interface SetlistEntryCardProps {
  entry: SetlistEntry;
  idx: number;
  isEditable: boolean;
  isLocal: boolean;
  onRemove: (entryId: number | string, idx: number) => void;
  onTranspose: (entryId: number | string, idx: number, delta: number) => void;
  onClick: (idx: number) => void;
  t: (key: string) => string;
  dragProps?: React.HTMLProps<HTMLDivElement>;
  handleProps?: React.HTMLProps<HTMLDivElement>;
  isDragging?: boolean;
}

export function SetlistEntryCard({
  entry,
  idx,
  isEditable,
  isLocal,
  onRemove,
  onTranspose,
  onClick,
  t,
  dragProps,
  handleProps,
  isDragging,
}: SetlistEntryCardProps) {
  const keyDisplay = getSongKey(entry.content_override || entry.content, entry.transpose);

  return (
    <div
      className={`song-card setlist-song-item ${isDragging ? 'dragging' : ''}`}
      onClick={() => onClick(idx)}
      {...dragProps}
    >
      {isEditable && (
        <div
          className="setlist-drag-handle"
          onClick={(e) => e.stopPropagation()}
          {...handleProps}
          title="Drag to reorder"
        >
          &#9776;
        </div>
      )}
      <div className="setlist-song-pos">{idx + 1}</div>
      <div className="song-card-info">
        <div className="song-card-title">
          {entry.title}
          {entry.visibility === 'private' && (
            <span className="badge badge-private" title="Private">
              &#128274;
            </span>
          )}
          {!isLocal && isEditable && entry.content_override && (
            <span className="badge badge-edited">{t('setlist.edited')}</span>
          )}
        </div>
        <div className="song-card-meta">
          {entry.artist ? `${entry.artist} · ` : ''}
          {keyDisplay}
        </div>
      </div>
      {isEditable && (
        <div className="setlist-entry-controls" onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-ghost btn-sm" onClick={() => onTranspose(entry.entry_id, idx, -1)}>
            &#9837;
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => onTranspose(entry.entry_id, idx, 1)}>
            &#9839;
          </button>
        </div>
      )}
      {isEditable && (
        <button
          className="setlist-remove-btn"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(entry.entry_id, idx);
          }}
          title="Remove"
        >
          &#10005;
        </button>
      )}
    </div>
  );
}

