/**
 * seed-data.mjs — Seeds ChordVault with demo data via API.
 *
 * Usage: node scripts/seed-data.mjs [base_url]
 * Default base URL: http://localhost:3100
 *
 * Expects a fresh DB (first user becomes owner).
 */

const BASE = process.argv[2] || 'http://localhost:3100';

let TOKEN = null;
async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (TOKEN) opts.headers['Authorization'] = `Bearer ${TOKEN}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  return res.json();
}

// Register first user (owner)
console.log('Registering owner: demo / demo123');
const reg = await api('POST', '/api/auth/register', {
  username: 'demo',
  password: 'demo123',
});
if (reg.error) {
  // Maybe already registered — try login
  console.log(`  Register returned: ${reg.error} — trying login...`);
  const login = await api('POST', '/api/auth/login', {
    username: 'demo',
    password: 'demo123',
  });
  if (login.error) { console.error('Cannot authenticate:', login.error); process.exit(1); }
  TOKEN = login.token;
  console.log(`  Logged in as ${login.username} (${login.role})`);
} else {
  TOKEN = reg.token;
  console.log(`  Registered as ${reg.username} (${reg.role})`);
}

// Songs
const songs = [
  {
    title: 'Amazing Grace',
    artist: 'John Newton',
    content: `{title: Amazing Grace}\n{artist: John Newton}\n{key: G}\n\n{start_of_verse: Verse 1}\n[G]Amazing grace, how [G7]sweet the [C]sound\nThat [C]saved a [G]wretch like [Em]me[D]\n[G]I once was lost, but [G7]now am [C]found\nWas [C]blind but [G]now [D]I [G]see\n{end_of_verse}\n\n{start_of_verse: Verse 2}\n[G]'Twas grace that [G7]taught my [C]heart to fear\nAnd [C]grace my [G]fears re[Em]lieved[D]\n[G]How precious [G7]did that [C]grace appear\nThe [C]hour I [G]first [D]be[G]lieved\n{end_of_verse}\n\n{start_of_verse: Verse 3}\n[G]Through many [G7]dangers, [C]toils and snares\nI [C]have al[G]ready [Em]come[D]\n[G]'Tis grace hath [G7]brought me [C]safe thus far\nAnd [C]grace will [G]lead [D]me [G]home\n{end_of_verse}`,
    key: 'G', language: 'en', tags: 'hymn,worship', bpm: 72, format_detected: 'ChordPro',
    youtube_url: 'https://www.youtube.com/watch?v=Jbe7OruLk8I',
  },
  {
    title: 'How Great Is Our God',
    artist: 'Chris Tomlin',
    content: `{title: How Great Is Our God}\n{artist: Chris Tomlin}\n{key: C}\n\n{start_of_verse: Verse 1}\n[C]The splendor of the King\n[Am7]Clothed in majesty\nLet all the [Fmaj7]earth rejoice\nAll the earth rejoice\n{end_of_verse}\n\n{start_of_verse: Verse 2}\n[C]He wraps Himself in light\n[Am7]And darkness tries to hide\nAnd trembles [Fmaj7]at His voice\nTrembles at His voice\n{end_of_verse}\n\n{start_of_chorus}\n[C]How great is our God\nSing with me [Am7]how great is our God\n[Fmaj7]And all will see how great\n[G]How great is our God\n{end_of_chorus}\n\n{start_of_bridge: Bridge}\n[Am7]Name above all [C]names\n[Fmaj7]Worthy of all [G]praise\n[Am7]My heart will sing\nHow [F]great [G]is our [C]God\n{end_of_bridge}`,
    key: 'C', language: 'en', tags: 'worship', bpm: 78, format_detected: 'ChordPro',
  },
  {
    title: '10,000 Reasons (Bless the Lord)',
    artist: 'Matt Redman',
    content: `{title: 10,000 Reasons (Bless the Lord)}\n{artist: Matt Redman}\n{key: G}\n\n{start_of_chorus}\n[G]Bless the [D/F#]Lord, O my [Em]soul, [C]O my soul\n[G]Worship His [D]holy [C]name\nSing like [Em]never be[C]fore, [G]O my [D]soul\nI'll [C]worship Your [D]holy [G]name\n{end_of_chorus}\n\n{start_of_verse: Verse 1}\nThe [G]sun comes [D/F#]up, it's a [Em]new day [C]dawning\n[G]It's time to [D]sing Your [Em]song a[C]gain\nWhat[G]ever may [D/F#]pass and what[Em]ever lies be[C]fore me\n[G]Let me be [D]singing when the [C]evening [D]comes\n{end_of_verse}\n\n{start_of_verse: Verse 2}\nYou're [G]rich in [D/F#]love and You're [Em]slow to [C]anger\nYour [G]name is [D]great and Your [Em]heart is [C]kind\nFor [G]all Your [D/F#]goodness I will [Em]keep on [C]singing\n[G]Ten thousand [D]reasons for my [C]heart to [D]find\n{end_of_verse}`,
    key: 'G', language: 'en', tags: 'worship,opener', bpm: 74, format_detected: 'ChordPro',
    youtube_url: 'https://www.youtube.com/watch?v=DXDGE_lRI0E',
  },
  {
    title: 'Good Good Father',
    artist: 'Chris Tomlin',
    content: `{title: Good Good Father}\n{artist: Chris Tomlin}\n{key: A}\n\n{start_of_verse: Verse 1}\n[A]Oh, I've heard a [E/G#]thousand stories\nOf [F#m7]what they think You're [D]like\nBut [A]I've heard the [E/G#]tender whisper\nOf [F#m7]love in the dead of [D]night\nAnd [A]You tell me [E/G#]that You're pleased\nAnd [F#m7]that I'm never a[D]lone\n{end_of_verse}\n\n{start_of_chorus}\nYou're a [A]good, good [E]Father\nIt's [F#m7]who You are, [D]it's who You are\n[A]It's who You [E]are\nAnd [A]I'm loved by [E]You\nIt's [F#m7]who I am, [D]it's who I am\n[A]It's who I [E]am\n{end_of_chorus}\n\n{start_of_bridge: Bridge}\n[A]You are [E]perfect in [F#m7]all of Your [D]ways\n[A]You are [E]perfect in [F#m7]all of Your [D]ways\n[A]You are [E]perfect in [F#m7]all of Your [D]ways to us\n{end_of_bridge}`,
    key: 'A', language: 'en', tags: 'worship,closer', bpm: 68, format_detected: 'ChordPro',
  },
  {
    title: 'Build My Life',
    artist: 'Housefires',
    content: `{title: Build My Life}\n{artist: Housefires}\n{key: E}\n\n{start_of_verse: Verse 1}\n[E]Worthy of [B]every song we could [C#m7]ever sing\n[A2]Worthy of all the praise we could ever bring\n[E]Worthy of [B]every breath we could [C#m7]ever breathe\nWe [A2]live for You\n{end_of_verse}\n\n{start_of_verse: Verse 2}\n[E]Jesus, the [B]name above every [C#m7]other name\n[A2]Jesus, the only one who could ever save\n[E]Worthy of [B]every breath we could [C#m7]ever breathe\nWe [A2]live for You, we live for You\n{end_of_verse}\n\n{start_of_chorus}\n[E]Holy, there is [B]no one like You\n[C#m7]There is none be[A2]side You\n[E]Open up my [B]eyes in wonder and show me\n[C#m7]Who You are and [A2]fill me\nWith Your heart and [E]lead me in Your [B]love to those a[C#m7]round me[A2]\n{end_of_chorus}\n\n{start_of_bridge: Bridge}\nI will [E]build my [B]life upon Your love\nIt is a [C#m7]firm foun[A2]dation\nI will [E]put my [B]trust in You alone\nAnd I [C#m7]will not be [A2]shaken\n{end_of_bridge}`,
    key: 'E', language: 'en', tags: 'worship,communion', bpm: 68, format_detected: 'ChordPro',
    youtube_url: 'https://www.youtube.com/watch?v=Z2kpCMH1mKE',
  },
  {
    title: 'Silent Night',
    artist: 'Franz Gruber',
    content: `{title: Silent Night}\n{artist: Franz Gruber}\n{key: C}\n\n{start_of_verse: Verse 1}\n[C]Silent night, holy [C]night\n[G7]All is calm, [C]all is bright\n[F]Round yon Virgin [C]Mother and Child\n[F]Holy Infant so [C]tender and mild\n[G7]Sleep in heavenly [Am]peace[F]\n[C]Sleep [G7]in heavenly [C]peace\n{end_of_verse}\n\n{start_of_verse: Verse 2}\n[C]Silent night, holy [C]night\n[G7]Shepherds quake [C]at the sight\n[F]Glories stream from [C]heaven afar\n[F]Heavenly hosts sing [C]Alleluia\n[G7]Christ the Savior is [Am]born[F]\n[C]Christ [G7]the Savior is [C]born\n{end_of_verse}\n\n{start_of_verse: Verse 3}\n[C]Silent night, holy [C]night\n[G7]Son of God, [C]love's pure light\n[F]Radiant beams from [C]Thy holy face\n[F]With the dawn of re[C]deeming grace\n[G7]Jesus, Lord, at Thy [Am]birth[F]\n[C]Jesus, [G7]Lord, at Thy [C]birth\n{end_of_verse}`,
    key: 'C', language: 'en', tags: 'hymn,christmas', bpm: 60, format_detected: 'ChordPro',
  },
];

console.log('\nCreating songs...');
const songIds = [];
for (const s of songs) {
  const res = await api('POST', '/api/songs', s);
  if (res.error) { console.error(`  FAILED: ${s.title} — ${res.error}`); continue; }
  songIds.push(res.id);
  console.log(`  ✓ ${s.title} (id: ${res.id})`);
}

// Setlists
console.log('\nCreating setlists...');

const sl1 = await api('POST', '/api/setlists', {
  name: 'Sunday Morning Worship — March 23',
  event_date: '2026-03-23',
  visibility: 'public',
});
console.log(`  ✓ ${sl1.name} (id: ${sl1.id}, public)`);
for (let i = 0; i < 4 && i < songIds.length; i++) {
  await api('POST', `/api/setlists/${sl1.id}/songs`, {
    song_id: songIds[i], position: i, transpose: 0,
  });
}
console.log('    Added 4 songs');

const sl2 = await api('POST', '/api/setlists', {
  name: 'Christmas Eve Service',
  event_date: '2025-12-24',
  visibility: 'public',
});
console.log(`  ✓ ${sl2.name} (id: ${sl2.id}, public)`);
if (songIds[5]) {
  await api('POST', `/api/setlists/${sl2.id}/songs`, {
    song_id: songIds[5], position: 0, transpose: 0,
  });
}
if (songIds[0]) {
  await api('POST', `/api/setlists/${sl2.id}/songs`, {
    song_id: songIds[0], position: 1, transpose: 0,
  });
}
console.log('    Added 2 songs');

const sl3 = await api('POST', '/api/setlists', {
  name: 'Personal Practice',
  event_date: '2026-03-19',
  visibility: 'private',
});
console.log(`  ✓ ${sl3.name} (id: ${sl3.id}, private)`);
if (songIds[4]) {
  await api('POST', `/api/setlists/${sl3.id}/songs`, {
    song_id: songIds[4], position: 0, transpose: 0,
  });
}

console.log('\n✅ Seed complete!');
