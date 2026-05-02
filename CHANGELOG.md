# Changelog

All notable changes to this project will be documented in this file.

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

## [1.5.0] - 2026-04-25

### Features
- Admin Password Reset: Added functionality for administrators to reset user passwords from the admin dashboard.

### Documentation and Maintenance
- Password Hashing: Refactored hashPassword implementation for improved security and maintainability.

## [1.4.0] - 2026-04-18

### Features
- OCR Structured JSON: Switched OCR processing to structured JSON format to improve chord placement accuracy, specifically for CJK characters.

## [1.3.1] - 2026-04-10

### Documentation and Maintenance
- Docker CI: Fixed Dockerfile issues and added Docker build steps to the CI pipeline.

## [1.3.0] - 2026-04-05

### Documentation and Maintenance
- Pre-commit Hook: Added TypeScript type-checking to the pre-commit hook to ensure code quality before commits.

## [1.2.0] - 2026-03-28

### Features
- Docker Versioning: Implemented semantic version tagging for Docker images during the release workflow.

### Documentation and Maintenance
- README Updates: Added instructions for running tests to the README.

## [1.1.0] - 2026-03-20

### Features
- Metadata Sync: Implemented two-way synchronization between form fields and ChordPro directives. ChordPro content is now the source of truth for all song metadata (title, artist, BPM, etc.).
- Custom Directives: Added support for custom ChordPro directives including {tempo:}, {x_youtube:}, {x_tags:}, and {x_language:}.

## [1.0.1] - 2026-03-12

### Bug Fixes
- CJK Width Patch: Applied a patch to ChordSheetJS to correctly handle CJK character widths (2 visual columns per character) and fixed lyrics parsing logic.

## [1.0.0] - 2026-03-05

### Features
- Initial Release: Self-hosted chord sheet manager with transposition and ChordPro support.
- Tagging System: Added 'praise' to preset tags.
- Documentation: Initial README with PDF/OCR documentation and API reference.
