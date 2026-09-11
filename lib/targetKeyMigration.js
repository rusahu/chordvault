const { songKeyFromContent } = require('./songKey');

/**
 * Migrates setlist_songs from an accumulated `transpose` delta to a stored
 * `target_key`.
 *
 * The whole body is guarded on the legacy column still existing: after the
 * DROP, any query naming `transpose` throws `no such column: transpose` and
 * the app would fail to boot on its next start.
 *
 * transpose = 0 rows become NULL, which means "as written" and lets later key
 * corrections apply. Only non-zero rows get a pinned key.
 *
 * The drop is gated on every non-zero row having converted. If any row could
 * not be derived the column stays, the app still runs (target_key is
 * authoritative and transpose is simply unread), and the next start retries.
 */
function migrateTargetKey(db) {
  const columns = () => db.prepare('PRAGMA table_info(setlist_songs)').all().map((c) => c.name);

  if (!columns().includes('target_key')) {
    db.exec('ALTER TABLE setlist_songs ADD COLUMN target_key TEXT DEFAULT NULL');
  }

  if (!columns().includes('transpose')) return;

  const rows = db.prepare(`
    SELECT ss.id, ss.transpose, COALESCE(ss.content_override, so.content) AS content
    FROM setlist_songs ss
    JOIN songs so ON so.id = ss.song_id
    WHERE ss.target_key IS NULL AND ss.transpose != 0
  `).all();

  if (rows.length) {
    const upd = db.prepare('UPDATE setlist_songs SET target_key = ? WHERE id = ?');
    db.transaction(() => {
      for (const r of rows) {
        const key = songKeyFromContent(r.content, r.transpose);
        if (key) upd.run(key, r.id);
      }
    })();
  }

  const unconverted = db.prepare(
    'SELECT count(*) AS n FROM setlist_songs WHERE transpose != 0 AND target_key IS NULL'
  ).get().n;

  if (unconverted > 0) {
    console.warn(
      `[migration] target_key backfill incomplete: ${unconverted} setlist entr(ies) have a non-zero ` +
      'transpose but no derivable key. Nothing reads transpose any more, so those entries PLAY AS ' +
      'WRITTEN from now on, not in the key they were set to. The transpose column is kept so the ' +
      'original value is recoverable: add a lowercase {key: ...} directive to those songs and ' +
      'restart to finish the backfill, or set each entry\'s key by hand in the setlist.'
    );
    return;
  }

  db.exec('ALTER TABLE setlist_songs DROP COLUMN transpose');
}

module.exports = { migrateTargetKey };
