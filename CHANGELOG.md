# Changelog

All notable changes to this project will be documented in this file.

## [1.7.0] - 2026-05-02

### Features
- Automatic Chinese Search Conversion: Implemented seamless Traditional and Simplified Chinese search matching. Searching in either variant now automatically finds results in both, powered by opencc-js and centralized query generation.

### Documentation and Maintenance
- Centralized Search Utilities: Refactored search logic into a dedicated module to ensure consistent character conversion across songs and setlists.

## [1.6.0] - 2026-05-02

### Features
- Advanced Lyric Search: Implemented SQLite FTS5 with a trigram tokenizer to enable full-text search across song lyrics. This provides significant improvements for searching libraries, particularly for CJK (Chinese, Japanese, Korean) content.
- Deep-Linkable Setlist Playback: Updated the setlist playback view to support index-based deep-linking. The URL now reflects the current song position, allowing for direct navigation via browser history and bookmarks.
- Enhanced Setlist Navigation: Improved the navigation logic for setlist playback, ensuring more reliable transitions when using swipe gestures, side buttons, or keyboard shortcuts.

### Bug Fixes
- State Management: Resolved react-hooks immutability lint errors in the SetlistPlayView component to ensure reliable state updates during playback.

### Documentation and Maintenance
- README Updates: Added technical documentation for advanced search features and trigram tokenizer implementation.
- Dependency Management: Merged multiple security and maintenance updates for backend and frontend dependencies.
