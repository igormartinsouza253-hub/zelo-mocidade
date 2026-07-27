const BLOCKED_WORDS = [
  // Palavrões, insultos e termos discriminatórios em português.
  "arrombado",
  "babaca",
  "bicha",
  "bosta",
  "buceta",
  "cacete",
  "caralho",
  "corna",
  "cornas",
  "corno",
  "cornos",
  "cu",
  "cuzão",
  "desgraçado",
  "fdp",
  "filha da puta",
  "filho da puta",
  "foda-se",
  "idiota",
  "imbecil",
  "merda",
  "otário",
  "piranha",
  "piroca",
  "porra",
  "puta",
  "puto",
  "retardado",
  "rola",
  "sapatão",
  "trouxa",
  "vadia",
  "vagabunda",
  "vagabundo",
  "viado",

  // Conteúdo sexual explícito ou de conotação sexual.
  "anal",
  "ânus",
  "boquete",
  "clitóris",
  "coito",
  "ejaculação",
  "ereção",
  "esperma",
  "fetiche",
  "genitália",
  "gozar",
  "incesto",
  "libido",
  "masturbação",
  "nude",
  "nudes",
  "nudez",
  "orgasmo",
  "orgia",
  "pau",
  "pedofilia",
  "pênis",
  "pornografia",
  "prostituição",
  "punheta",
  "sêmen",
  "sexo",
  "sexting",
  "siririca",
  "transa",
  "transando",
  "transar",
  "vagina",
  "vulva",
  "zoofilia",

  // Equivalentes explícitos comuns em inglês e espanhol.
  "asshole",
  "bitch",
  "blowjob",
  "cock",
  "culo",
  "cum",
  "dick",
  "fuck",
  "handjob",
  "joder",
  "mierda",
  "naked",
  "pene",
  "porn",
  "pussy",
  "rape",
  "sex",
  "shit",
] as const;

const BLOCKED_PREFIXES = [
  "arrombad",
  "babac",
  "bost",
  "bucet",
  "cacet",
  "caralh",
  "clitor",
  "cuza",
  "desgrac",
  "ejacul",
  "erot",
  "escrot",
  "esperma",
  "estupr",
  "fetich",
  "fod",
  "genital",
  "idiot",
  "imbec",
  "incest",
  "masturb",
  "merd",
  "necrofil",
  "nud",
  "orgasm",
  "otari",
  "pedofil",
  "penetr",
  "piranh",
  "piroc",
  "porn",
  "prostitut",
  "putari",
  "puteir",
  "retardad",
  "safad",
  "sexu",
  "sodomi",
  "testicul",
  "vagabund",
  "vagin",
  "viad",
  "vulv",
  "zoofil",
] as const;

const normalizeForModeration = (value: string) => value
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
  .toLowerCase()
  .replace(/[@4]/g, "a")
  .replace(/8/g, "b")
  .replace(/3/g, "e")
  .replace(/[1!|]/g, "i")
  .replace(/[0]/g, "o")
  .replace(/[$5]/g, "s")
  .replace(/7/g, "t")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const collapseRepeatedCharacters = (value: string) => value.replace(/([a-z0-9])\1+/g, "$1");

const normalizedBlockedWords = new Set(
  BLOCKED_WORDS.flatMap((term) => {
    const normalized = normalizeForModeration(term);
    return [normalized, collapseRepeatedCharacters(normalized)];
  }),
);

const normalizedBlockedPrefixes = BLOCKED_PREFIXES.map((term) => collapseRepeatedCharacters(normalizeForModeration(term)));

function isBlockedCandidate(value: string): boolean {
  const normalized = normalizeForModeration(value);
  if (!normalized) return false;

  const collapsed = collapseRepeatedCharacters(normalized);
  return normalizedBlockedWords.has(normalized)
    || normalizedBlockedWords.has(collapsed)
    || normalizedBlockedPrefixes.some((prefix) => collapsed.startsWith(prefix));
}

function buildCandidates(value: string): string[] {
  const normalized = normalizeForModeration(value);
  if (!normalized) return [];

  const words = normalized.split(/\s+/).filter(Boolean);
  const candidates = new Set(words);

  // Detecta tentativas como "p.o.r.r.a", "p orra" e "s 3 x o" sem
  // juntar frases comuns inteiras, o que causaria falsos positivos.
  for (let start = 0; start < words.length; start += 1) {
    let compact = words[start];
    let containsSingleCharacterPart = words[start].length === 1;

    for (let end = start + 1; end < Math.min(words.length, start + 12); end += 1) {
      compact += words[end];
      containsSingleCharacterPart ||= words[end].length === 1;
      if (compact.length > 32) break;
      if (containsSingleCharacterPart) candidates.add(compact);
    }
  }

  return Array.from(candidates);
}

export function containsInappropriateLanguage(value: string): boolean {
  const normalized = normalizeForModeration(value);
  if (!normalized) return false;

  if (normalizedBlockedWords.has(normalized) || normalizedBlockedWords.has(collapseRepeatedCharacters(normalized))) {
    return true;
  }

  return buildCandidates(normalized).some(isBlockedCandidate);
}
