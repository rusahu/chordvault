import ChordSheetJS from 'chordsheetjs';

const content = `{key: G#}\n[G#] [C#] [D#]`;
const parser = new ChordSheetJS.ChordProParser();
const song = parser.parse(content);
const formatter = new ChordSheetJS.ChordProFormatter();

console.log('--- Original Content ---');
console.log(content);

console.log('\n--- Formatted (No Transpose) ---');
console.log(formatter.format(song));

console.log('\n--- Formatted (Transposed +1 then -1) ---');
const transposed = song.transpose(1).transpose(-1);
console.log(formatter.format(transposed));

console.log('\n--- Key Object Inspection ---');
console.log('Metadata key:', song.getMetadataValue('key'));
console.log('Song key property:', song.key?.toString());
