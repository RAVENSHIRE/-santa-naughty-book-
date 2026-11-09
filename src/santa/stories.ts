import type { Guest } from '../demoData';
import type { SantaLanguage } from '../content';
import { lines as cleanLines } from '../three/tex/pageArt';

type Locale = SantaLanguage;

/** Alles, was Santa sagt – auf Deutsch und Englisch */

export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** Deterministische Auswahl (pro Name immer gleich) – damit vorgerenderte Stimmen passen */
export const pickBy = <T,>(key: string, arr: T[]): T => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return arr[(h >>> 0) % arr.length];
};

const listJoin = (names: string[], locale: Locale) => {
  if (names.length <= 1) return names.join('');
  const and = locale === 'en' ? 'and' : 'und';
  return `${names.slice(0, -1).join(', ')} ${and} ${names[names.length - 1]}`;
};

export function santaLines(locale: Locale) {
  if (locale === 'gsw') {
    return {
      prologue: () =>
        'Es isch e chalti, klari Nacht gsi. De Schnee isch liislig uf d Dächer abegrieslet, und d Stärne händ glitzeret wie tuusig chliini Cherzli. ' +
        'Wiit obe, über de Alpe, isch en Schlitte dur d Nacht gfloge – zoge vo nüün Rentier. Und drin bin ich gsässe. ' +
        'Under em Arm: mis grosse, alte Buech. Und i dem Buech staht alles drin. Alles, wo ihr das Jahr gmacht händ – s Gueti … und s weniger Gueti. ' +
        'Hüt Abig isch es sowiit.',
      greeting: (event: string, count: number) =>
        `Ho ho ho! Grüezi mitenand und härzlich willkomme i minere warme Stube! Ich bi de Samichlaus. ` +
        `Hüt Abig${event ? ` a de ${event}` : ''} schlah ich mis grosse Buech uf und lies jedem vo eu sini ganz eigeti Gschicht vor.` +
        (count ? ` Uf minere Lischte stönd ${count} Näme.` : ''),
      firstCall: (camera: boolean) =>
        camera ? 'Wer wott als Erschts zu mir cho? Stand vor d Kamera, dass ich di gseh!' : 'Wer wott als Erschts? Säg mir eifach din Name!',
      nextCall: (remaining: string[], camera: boolean) => {
        const hint = remaining.length
          ? ` I mim Buech warted no ${listJoin(remaining.slice(0, 3), 'gsw')}${remaining.length > 3 ? ` und ${remaining.length - 3} wiiteri` : ''}.`
          : '';
        return `${pick(['Wer isch als Nächschts dra?', 'Wer wott als Nächschts?', 'De Nächscht, bitte!'])}${hint} ${camera ? 'Chum vor d Kamera!' : 'Säg mir din Name!'}`;
      },
      anyoneThere: 'Hallo? Isch no öpper da? Chum nume nöcher, ich biisse nöd. Ho ho!',
      seePerson: ['Ah, da isch ja öpper!', 'Oh, sali! Chum ruhig echli nöcher.', 'Ho ho, ich gseh di!'],
      askName: ['Wie heissisch du?', 'Und wie heissisch du, mis Chind?', 'Verrätsch mir din Name?'],
      notUnderstood: 'Ho ho, mini Ohre sind nümm di jüngschte. Säg mir bitte nume din Name.',
      hostHelp: 'De Gaschtgeber cha mir din Name au iitippe.',
      dearGuest: 'liebe Gascht',
      hello: (name: string) => pickBy(name, [`Sali ${name}!`, `Schön, dass du da bisch, ${name}!`, `${name}! Härzlich willkomme!`]),
      lookup: (name = '') => pickBy(name, ['Momänt, ich lueg i mim Buech na …', 'Lass mich churz blettere …', 'Mal luege, was mini Wichtel ufgschribe händ …']),
      alreadyDone: (name: string) => `${name}, dini Gschicht han ich hüt scho vorgläse! Wer isch no nöd bi mir gsi?`,
      unknown: (name: string) => `Hm, ${name} … dich find ich no gar nöd i mim Buech. Denn schrib ich dich jetzt grad ine!`,
      verdictIntro: (name: string) => `Und jetzt, ${name}, s Urteil vom Samichlaus …`,
      verdict: (v: Guest['verdict']) =>
        v === 'nice'
          ? 'Brav! Ho ho ho! Du dörfsch di uf es Gschänkli freue.'
          : v === 'naughty'
            ? 'Unartig! Ho ho ho … Aber kei Angscht: De Schmutzli lan ich hüt dihei. Und es bitzeli Chole git im Winter schön warm. Nächscht Jahr klappts sicher!'
            : 'Hm … das isch knapp. Das entscheid ich nächscht Jahr!',
      epilogue: () =>
        'Und so isch de Samichlaus wieder i sini Stube zrugg. S Buech isch zue, s Füür glüeht no echli. ' +
        'Und wänn ihr hüt Nacht ganz guet losed, ghöred ihr vilicht d Glöggli vo mine Rentier, wiit obe über de Dächer.',
      farewell: (event: string) =>
        `Das sind alli gsi! Ich danke eu für dä wunderbari Abig${event ? ` a de ${event}` : ''}. Blibed schön brav – ich gseh alles! Schöni Wiehnachte! Ho ho ho!`,
      farewellEarly: 'Für hüt hämmer gnueg gläse. Ich danke eu allne, blibed brav – und schöni Wiehnachte! Ho ho ho!',
      chapter: 'Kapitel',
      presents: (brand: string) => `${brand} präsentiert`,
      endTitle: 'Schöni Wiehnachte',
    };
  }
  if (locale === 'en') {
    return {
      prologue: () =>
        'It was a cold, clear night. Snow drifted softly onto the rooftops, and the stars sparkled like a thousand tiny candles. ' +
        'High above the Alps, a sleigh flew through the night – pulled by nine reindeer. And in it, there was me. ' +
        'Under my arm: my big, old book. And in that book, everything is written down. Everything you did this year – the good … and the not-so-good. ' +
        'Tonight is the night.',
      epilogue: () =>
        'And so Santa returned to his little room. The book is closed, the fire still glows a little. ' +
        'And if you listen very closely tonight, you might hear the bells of my reindeer, high above the rooftops.',
      chapter: 'Chapter',
      presents: (brand: string) => `${brand} presents`,
      endTitle: 'Merry Christmas',
      greeting: (event: string, count: number) =>
        `Ho ho ho! Welcome, welcome to my cosy little room! I am Santa Claus. ` +
        `Tonight${event ? ` at the ${event}` : ''} I will open my big book and read each of you your very own story.` +
        (count ? ` There are ${count} names on my list.` : ''),
      firstCall: (camera: boolean) =>
        camera
          ? 'Who would like to come to me first? Step in front of the camera so I can see you!'
          : 'Who would like to go first? Just tell me your name!',
      nextCall: (remaining: string[], camera: boolean) => {
        const hint = remaining.length
          ? ` My book still has ${listJoin(remaining.slice(0, 3), 'en')}${remaining.length > 3 ? ` and ${remaining.length - 3} more` : ''}.`
          : '';
        return `${pick(['Who is next?', 'Who wants to come next?', 'Next one, please!'])}${hint} ${camera ? 'Step in front of the camera!' : 'Tell me your name!'}`;
      },
      anyoneThere: 'Hello? Is anybody there? Come closer, I don’t bite. Ho ho!',
      seePerson: ['Ah, there you are!', 'Oh, hello! Come a little closer.', 'Ho ho, I can see you!'],
      askName: ['What is your name?', 'And what is your name, my dear?', 'Will you tell me your name?'],
      notUnderstood: 'Ho ho, my ears are not the youngest anymore. Please tell me just your name.',
      hostHelp: 'The host can also type your name for me.',
      dearGuest: 'dear guest',
      hello: (name: string) => pickBy(name, [`Hello ${name}!`, `How lovely to see you, ${name}!`, `${name}! Welcome!`]),
      lookup: (name = '') => pickBy(name, ['Let me look in my book …', 'One moment, I am turning the pages …', 'Let me see what my elves wrote down …']),
      alreadyDone: (name: string) => `${name}, I already read your story tonight! Who has not been with me yet?`,
      unknown: (name: string) => `Hmm, ${name} … I cannot find you in my book yet. Then I will write you in right now!`,
      verdictIntro: (name: string) => `And now, ${name}, Santa's verdict …`,
      verdict: (v: Guest['verdict']) =>
        v === 'nice'
          ? 'Nice! Ho ho ho! You can look forward to a present.'
          : v === 'naughty'
            ? 'Naughty! Ho ho ho … But don’t worry: a little coal keeps you warm in winter. Next year you will make it!'
            : 'Hmm … that is a close one. I will decide next year!',
      farewell: (event: string) =>
        `That was everyone! Thank you for this wonderful evening${event ? ` at the ${event}` : ''}. Stay nice – I see everything! Merry Christmas! Ho ho ho!`,
      farewellEarly: 'That’s enough reading for tonight. Thank you all, stay nice – and Merry Christmas! Ho ho ho!',
    };
  }
  return {
    prologue: () =>
      'Es war eine kalte, klare Nacht. Der Schnee rieselte leise auf die Dächer, und die Sterne funkelten wie tausend kleine Kerzen. ' +
      'Hoch über den Alpen flog ein Schlitten durch die Nacht – gezogen von neun Rentieren. Und darin sass ich. ' +
      'Unter dem Arm: mein grosses, altes Buch. Und in diesem Buch steht alles. Alles, was ihr dieses Jahr getan habt – das Gute … und das weniger Gute. ' +
      'Heute Abend ist es so weit.',
    epilogue: () =>
      'Und so kehrte der Weihnachtsmann in seine Stube zurück. Das Buch ist zu, das Feuer glüht noch ein wenig. ' +
      'Und wenn ihr heute Nacht ganz genau hinhört, hört ihr vielleicht die Glöckchen meiner Rentiere, hoch über den Dächern.',
    chapter: 'Kapitel',
    presents: (brand: string) => `${brand} präsentiert`,
    endTitle: 'Frohe Weihnachten',
    greeting: (event: string, count: number) =>
      `Ho ho ho! Herzlich willkommen in meiner warmen Stube! Ich bin der Weihnachtsmann. ` +
      `Heute Abend${event ? ` an der ${event}` : ''} schlage ich mein grosses Buch auf und lese jedem von euch seine ganz eigene Geschichte vor.` +
      (count ? ` Auf meiner Liste stehen ${count} Namen.` : ''),
    firstCall: (camera: boolean) =>
      camera
        ? 'Wer möchte als Erstes zu mir kommen? Stell dich vor die Kamera, damit ich dich sehen kann!'
        : 'Wer möchte als Erstes? Sag mir einfach deinen Namen!',
    nextCall: (remaining: string[], camera: boolean) => {
      const hint = remaining.length
        ? ` In meinem Buch warten noch ${listJoin(remaining.slice(0, 3), 'de')}${remaining.length > 3 ? ` und ${remaining.length - 3} weitere` : ''}.`
        : '';
      return `${pick(['Wer ist als Nächstes dran?', 'Wer möchte als Nächstes?', 'Der Nächste, bitte!'])}${hint} ${camera ? 'Komm vor die Kamera!' : 'Sag mir deinen Namen!'}`;
    },
    anyoneThere: 'Hallo? Ist da noch jemand? Komm ruhig näher, ich beisse nicht. Ho ho!',
    seePerson: ['Ah, da ist ja jemand!', 'Oh, hallo! Komm ruhig ein bisschen näher.', 'Ho ho, ich sehe dich!'],
    askName: ['Wie heisst du denn?', 'Und wie heisst du, mein Kind?', 'Verrätst du mir deinen Namen?'],
    notUnderstood: 'Ho ho, meine Ohren sind nicht mehr die jüngsten. Sag mir bitte nur deinen Namen.',
    hostHelp: 'Der Gastgeber kann mir deinen Namen auch eintippen.',
    dearGuest: 'lieber Gast',
    hello: (name: string) => pickBy(name, [`Hallo ${name}!`, `Schön, dass du da bist, ${name}!`, `${name}! Herzlich willkommen!`]),
    lookup: (name = '') => pickBy(name, ['Moment, ich schaue in meinem Buch nach …', 'Lass mich kurz blättern …', 'Mal sehen, was meine Wichtel aufgeschrieben haben …']),
    alreadyDone: (name: string) => `${name}, deine Geschichte habe ich heute schon vorgelesen! Wer war noch nicht bei mir?`,
    unknown: (name: string) => `Hm, ${name} … dich finde ich noch gar nicht in meinem Buch. Dann schreibe ich dich jetzt gleich hinein!`,
    verdictIntro: (name: string) => `Und nun, ${name}, das Urteil des Weihnachtsmanns …`,
    verdict: (v: Guest['verdict']) =>
      v === 'nice'
        ? 'Brav! Ho ho ho! Du darfst dich auf ein Geschenk freuen.'
        : v === 'naughty'
          ? 'Unartig! Ho ho ho … Aber keine Sorge: Ein bisschen Kohle hält im Winter schön warm. Nächstes Jahr klappt es bestimmt!'
          : 'Hm … das ist knapp. Das entscheide ich nächstes Jahr!',
    farewell: (event: string) =>
      `Das waren alle! Ich danke euch für diesen wunderbaren Abend${event ? ` an der ${event}` : ''}. Bleibt schön brav – ich sehe alles! Frohe Weihnachten! Ho ho ho!`,
    farewellEarly: 'Für heute ist genug gelesen. Ich danke euch allen, bleibt brav – und frohe Weihnachten! Ho ho ho!',
  };
}

const EN_IRREGULAR =
  /^(put|ate|wrote|brought|forgot|made|took|gave|sang|ran|came|sent|kept|left|lost|found|told|said|got|did|had|was|knew|thought|bought|built|caught|drew|drove|fell|flew|grew|hid|held|led|let|lit|met|paid|read|rode|saw|sold|shook|shut|slept|spent|stood|stole|swam|taught|threw|woke|won|wore|is|has|can|will|never|always|often|sometimes|still|really|just|even|secretly|accidentally|apparently)$/i;
const DE_VERBS = /^(hat|ist|war|kann|will|muss|darf|soll|mag|weiss|weiß|isst|liest|vergisst)$/i;

/** Wandelt einen Eintrag aus dem Buch in einen Satz über die Person um */
function deedSentence(name: string, deed: string, locale: Locale): string {
  const d = deed.trim().replace(/[.!]+$/, '');
  const first = d.split(/\s+/)[0] ?? '';
  if (locale === 'gsw') return `«${d}».`;
  const quoted = /^[«»"“”„‘'(]/.test(first);
  let verbLike = false;
  if (!quoted) {
    if (locale === 'de') verbLike = DE_VERBS.test(first) || /^[A-ZÄÖÜ][a-zäöüß]+t$/.test(first);
    else verbLike = EN_IRREGULAR.test(first) || /^[A-Z][a-z]+(s|ed|ly)$/.test(first);
  }
  if (verbLike) return `${name} ${first.toLowerCase()}${d.slice(first.length)}.`;
  return locale === 'de' ? `In meinem Buch steht: ${d}.` : `My book says: ${d}.`;
}

/** Die Geschichte, die Santa vorliest (aus den Einträgen im Buch) */
export function buildStory(g: Guest, locale: Locale): string {
  if (g.story?.trim()) return g.story.trim();
  const name = g.name || (locale === 'en' ? 'dear guest' : locale === 'gsw' ? 'liebe Gascht' : 'lieber Gast');
  const nice = cleanLines(g.nice);
  const naughty = cleanLines(g.naughty);
  if (locale === 'gsw') return buildStoryGsw(name, nice, naughty);
  const de = locale === 'de';
  const parts: string[] = [];
  if (!nice.length && !naughty.length) {
    parts.push(
      de
        ? `Es war einmal ${name}. ${name} kam heute Abend in meine warme Stube, mit roten Wangen und einem Lächeln im Gesicht. ` +
            `Meine Wichtel haben mir erzählt, dass ${name} das ganze Jahr kleine Freuden verteilt hat – ein freundliches Wort hier, eine helfende Hand dort. ` +
            `Und genau solche Geschichten mag ich am allerliebsten.`
        : `Once upon a time there was ${name}. Tonight ${name} came into my warm little room with rosy cheeks and a big smile. ` +
            `My elves told me that ${name} spread little joys all year long – a kind word here, a helping hand there. ` +
            `And those are exactly the stories I love the most.`,
    );
    return parts.join(' ');
  }
  parts.push(
    pickBy(name + '1', 
      de
        ? [`Es war einmal, in einer kalten Winternacht, ${name}.`, `Hör gut zu, ${name}. Das hier ist deine Geschichte.`, `Mein Buch erzählt von ${name} …`]
        : [`Once upon a time, on a cold winter night, there was ${name}.`, `Listen closely, ${name}. This is your story.`, `My book tells the story of ${name} …`],
    ),
  );
  if (nice.length) {
    parts.push(de ? 'Das ganze Jahr habe ich zugeschaut.' : 'I have been watching all year long.');
    nice.forEach((d, i) => parts.push((i === 0 ? '' : de ? 'Und ' : 'And ') + deedSentence(name, d, locale)));
    parts.push(pickBy(name + '2', de ? ['Das hat mich sehr gefreut!', 'Wunderbar, ho ho!', 'Da hat mein Herz gelacht.'] : ['That made me very happy!', 'Wonderful, ho ho!', 'That warmed my heart.']));
  }
  if (naughty.length) {
    parts.push(pickBy(name + '3', de ? ['Aber …', 'Doch dann …', 'Allerdings …'] : ['But …', 'And then …', 'However …']));
    naughty.forEach((d) => parts.push(deedSentence(name, d, locale)));
    parts.push(pickBy(name + '4', de ? ['Ho ho, das habe ich ganz genau gesehen!', 'Tststs …', 'Meine Wichtel haben alles aufgeschrieben!'] : ['Ho ho, I saw that very clearly!', 'Tut tut …', 'My elves wrote it all down!']));
  }
  return parts.join(' ');
}

function buildStoryGsw(name: string, nice: string[], naughty: string[]) {
  const parts: string[] = [];
  if (!nice.length && !naughty.length) {
    return (
      `Es isch einisch gsi: ${name}. ${name} isch hüt Abig i mini warmi Stube cho, mit rote Bagge und emne Lächle im Gsicht. ` +
      `Mini Wichtel händ mir verzellt, dass ${name} s ganze Jahr chliini Fröide verteilt het – es fründlichs Wort da, e hälfendi Hand det. ` +
      `Und genau settigi Gschichte han ich am allerliebschte.`
    );
  }
  parts.push(pickBy(name + '1', [`Es isch einisch gsi, i de-n-e chalte Winternacht: ${name}.`, `Los guet zue, ${name}. Das isch dini Gschicht.`, `Mis Buech verzellt vo ${name} …`]));
  if (nice.length) {
    parts.push('Ich ha s ganze Jahr zuegluegt. I mim Buech staht:');
    nice.forEach((d, i) => parts.push((i === 0 ? '' : 'Und: ') + deedSentence(name, d, 'gsw')));
    parts.push(pickBy(name + '2', ['Das het mich mega gfreut!', 'Wunderbar, ho ho!', 'Da het mis Härz glachet.']));
  }
  if (naughty.length) {
    parts.push(pickBy(name + '3', ['Aber …', 'Doch dänn …', 'Allerdings …']));
    parts.push('Da staht au:');
    naughty.forEach((d) => parts.push(deedSentence(name, d, 'gsw')));
    parts.push(pickBy(name + '4', ['Ho ho, das han ich ganz genau gseh!', 'Tststs …', 'Mini Wichtel händ alles ufgschribe!']));
  }
  return parts.join(' ');
}

/** Text in Sätze teilen (für Untertitel und Sprachausgabe) */
/** Zerlegt Text in Sätze (für Untertitel und Stimme). Ordinalzahlen wie „2. Liga“ trennen nicht. */
export function sentences(text: string): string[] {
  const out: string[] = [];
  const re = /[.!?…]+["»“”']?(?=\s|$)/g;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[0] === '.' && /(^|\D)\d{1,2}$/.test(text.slice(Math.max(start, m.index - 3), m.index))) continue;
    const end = m.index + m[0].length;
    out.push(text.slice(start, end).trim());
    start = end;
  }
  if (start < text.length) out.push(text.slice(start).trim());
  const res = out.filter(Boolean);
  return res.length ? res : [text];
}
