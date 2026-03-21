import type { SongListItem } from '../types';
import { languageName } from '../lib/languages';

interface SongCardProps {
  song: SongListItem;
  isOwner?: boolean;
  onClick: () => void;
  onEdit?: () => void;
}

export function SongCard({ song, isOwner, onClick, onEdit }: SongCardProps) {
  return (
    <div className="song-card" onClick={onClick}>
      <div className="song-card-info">
        <div className="song-card-title">{song.title}</div>
        {song.artist && <div className="song-card-meta">{song.artist}</div>}
        {song.tags && (
          <div className="song-card-tags">
            {song.tags.split(',').map((tag) => (
              <span key={tag} className="badge badge-tag">{tag}</span>
            ))}
          </div>
        )}
      </div>
      <div className="song-card-actions">
        {song.language && <span className="badge badge-lang" title={languageName(song.language)}>{song.language.toUpperCase()}</span>}
        {song.visibility === 'private' && <span className="badge badge-private" title="Private">&#128274;</span>}
        {song.key && <span className="badge badge-key">{song.key}</span>}
        {song.bpm && <span className="badge badge-bpm">{song.bpm}</span>}
        {isOwner && onEdit && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
}
