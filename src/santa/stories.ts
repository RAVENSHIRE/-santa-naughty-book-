import type { Guest } from '../demoData';
import type { Locale } from '../i18n';
import { lines as cleanLines } from '../three/tex/pageArt';

/** Alles, was Santa sagt – auf Deutsch und Englisch */

export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const listJoin = (names: string[], locale: Locale) => {
  if (names.length <= 1) return names.join('');
  const and = locale === 'de' ? 'und' : 'and';
  return `${names.slice(0, -1).join(', ')} ${and} ${names[names.length - 1]}`;
};

export function santaLines(locale: Locale) {
  if (locale === 'en') {
    return {
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
      hello: (name: string) => pick([`Hello ${name}!`, `How lovely to see you, ${name}!`, `${name}! Welcome!`]),
      lookup: () => pick(['Let me look in my book …', 'One moment, I am turning the pages …', 'Let me see what my elves wrote down …']),
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
    hello: (name: string) => pick([`Hallo ${name}!`, `Schön, dass du da bist, ${name}!`, `${name}! Herzlich willkommen!`]),
    lookup: () => pick(['Moment, ich schaue in meinem Buch nach …', 'Lass mich kurz blättern …', 'Mal sehen, was meine Wichtel aufgeschrieben haben …']),
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
  const name = g.name || (locale === 'de' ? 'lieber Gast' : 'dear guest');
  const nice = cleanLines(g.nice);
  const naughty = cleanLines(g.naughty);
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
    pick(
      de
        ? [`Es war einmal, in einer kalten Winternacht, ${name}.`, `Hör gut zu, ${name}. Das hier ist deine Geschichte.`, `Mein Buch erzählt von ${name} …`]
        : [`Once upon a time, on a cold winter night, there was ${name}.`, `Listen closely, ${name}. This is your story.`, `My book tells the story of ${name} …`],
    ),
  );
  if (nice.length) {
    parts.push(de ? 'Das ganze Jahr habe ich zugeschaut.' : 'I have been watching all year long.');
    nice.forEach((d, i) => parts.push((i === 0 ? '' : de ? 'Und ' : 'And ') + deedSentence(name, d, locale)));
    parts.push(pick(de ? ['Das hat mich sehr gefreut!', 'Wunderbar, ho ho!', 'Da hat mein Herz gelacht.'] : ['That made me very happy!', 'Wonderful, ho ho!', 'That warmed my heart.']));
  }
  if (naughty.length) {
    parts.push(pick(de ? ['Aber …', 'Doch dann …', 'Allerdings …'] : ['But …', 'And then …', 'However …']));
    naughty.forEach((d) => parts.push(deedSentence(name, d, locale)));
    parts.push(pick(de ? ['Ho ho, das habe ich ganz genau gesehen!', 'Tststs …', 'Meine Wichtel haben alles aufgeschrieben!'] : ['Ho ho, I saw that very clearly!', 'Tut tut …', 'My elves wrote it all down!']));
  }
  return parts.join(' ');
}

/** Text in Sätze teilen (für Untertitel und Sprachausgabe) */
export function sentences(text: string): string[] {
  return (text.match(/[^.!?…]+[.!?…]*["»“”]?\s*/g) ?? [text]).map((s) => s.trim()).filter(Boolean);
}
