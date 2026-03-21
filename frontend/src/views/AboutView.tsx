interface AboutViewProps {
  navigate: (view: string) => void;
}

export function AboutView({ navigate }: AboutViewProps) {
  return (
    <div className="about-page">
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('browse')} style={{ marginBottom: 20 }}>&#8592; Back</button>
      <h1 className="about-title">&#9833; ChordVault</h1>
      <p className="about-subtitle">Your chord sheet library</p>

      <div className="about-section">
        <h3>Browse &amp; Search</h3>
        <p>Browse the full chord library without an account. Search by title or artist to find what you need.</p>
      </div>

      <div className="about-section">
        <h3>Transpose &amp; Key Picker</h3>
        <p>Tap the key to open a picker with all 12 keys. Chords update instantly — no more counting semitones.</p>
      </div>

      <div className="about-section">
        <h3>Number Notation</h3>
        <p>Toggle number notation (Nashville numbers) to see chords as 1, 4, 5 instead of C, F, G. Useful for playing in any key.</p>
      </div>

      <div className="about-section">
        <h3>Setlists</h3>
        <p>Build setlists for worship sessions or gigs. Swipe or tap through songs, with per-song key and global settings for font size, multi-column layout, and more.</p>
      </div>

      <div className="about-section">
        <h3>Multi-Column &amp; Font Size</h3>
        <p>Toggle multi-column layout to fit more on screen. Use the Fit button to automatically adjust columns and font size for your device. Great for tablets on a music stand.</p>
      </div>

      <div className="about-section">
        <h3>With an Account</h3>
        <p>Sign in to add your own songs, build server-saved setlists, submit corrections to existing songs, and use photo-to-chords OCR.</p>
      </div>

      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <button className="btn" onClick={() => navigate('auth')}>Sign in</button>
      </div>
    </div>
  );
}
