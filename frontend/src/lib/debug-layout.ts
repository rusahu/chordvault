import ChordSheetJS, { Song, Paragraph, Line } from 'chordsheetjs';
import { escHtml } from './util';

// Mocking the ResponsiveHtmlFormatter from chords.ts
class ResponsiveHtmlFormatter {
  format(song: Song): string {
    return song.paragraphs.map((p: Paragraph) => this.renderParagraph(p)).join('');
  }

  private renderParagraph(p: Paragraph): string {
    const cls = `paragraph ${p.type}`;
    const content = p.lines.map((l: Line) => this.renderLine(l)).join('');
    return `<div class="${cls}">${content}</div>`;
  }

  private renderLine(l: Line): string {
    console.log('ITEMS:', JSON.stringify(l.items));
    if (l.type === 'comment') {
      const firstItem = l.items[0] as any;
      const content = firstItem && 'content' in firstItem ? firstItem.content : 
                     (firstItem && 'lyrics' in firstItem ? firstItem.lyrics : '');
      return `<div class="comment">${escHtml(content || '')}</div>`;
    }
    const firstItem = l.items[0] as any;
    if (firstItem && 'lyrics' in firstItem && !firstItem.chords && 
        firstItem.lyrics && /^(Verse|Chorus|Bridge|Intro|Outro|Interlude|Pre-?Chorus|Ending|Tag|Coda|Break|Solo|Instrumental|Refrain)\s*\d*$/i.test(firstItem.lyrics.trim())) {
      return `<div class="row"><h3 class="label">${escHtml(firstItem.lyrics.trim())}</h3></div>`;
    }

    const content = l.items.map((it: any) => this.renderItem(it)).join('');
    return `<div class="row">${content}</div>`;
  }

  private renderItem(it: any): string {
    const lyrics = it.lyrics || '';
    if (!lyrics) {
      const chords = it.chords ? `<span class="chord">${escHtml(it.chords)}</span>` : '<span class="chord"></span>';
      return `<span class="column">${chords}<span class="lyrics"></span></span>`;
    }
    const chunks = lyrics.split(/(\s+)/).filter((chunk: string) => chunk !== '');
    let chordPlaced = false;
    return chunks.map((chunk: string) => {
      const isSpace = /\s+/.test(chunk);
      if (isSpace && chordPlaced) return escHtml(chunk);
      const currentChord = chordPlaced ? '' : (it.chords || '');
      chordPlaced = true;
      const chords = `<span class="chord">${escHtml(currentChord)}</span>`;
      const lyricText = escHtml(chunk);
      return `<span class="column">${chords}<span class="lyrics">${lyricText}</span></span>`;
    }).join('');
  }
}

const content = 'Intro\n[A]  [F#m]   [E]  [D]';
const parser = new ChordSheetJS.ChordProParser();
const song = parser.parse(content);
const formatter = new ResponsiveHtmlFormatter();
const html = formatter.format(song);

console.log('--- GENERATED HTML ---');
console.log(html);
console.log('----------------------');
