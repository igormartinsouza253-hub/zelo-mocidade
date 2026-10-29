-- Enforce note moderation at the database boundary so direct API writes cannot
-- bypass the client-side validation.

CREATE OR REPLACE FUNCTION public.note_content_is_allowed(_value text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  normalized text;
  words text[];
  candidate text;
  collapsed text;
  contains_single_character_part boolean;
  start_index integer;
  end_index integer;
  word_count integer;
  blocked_words constant text[] := ARRAY[
    'arrombado', 'babaca', 'bicha', 'bosta', 'buceta', 'cacete',
    'caralho', 'corna', 'cornas', 'corno', 'cornos', 'cu', 'cuzao',
    'desgracado', 'fdp', 'fodase', 'idiota', 'imbecil', 'merda',
    'otario', 'piranha', 'piroca', 'porra', 'puta', 'puto',
    'retardado', 'rola', 'sapatao', 'trouxa', 'vadia', 'vagabunda',
    'vagabundo', 'viado', 'anal', 'anus', 'boquete', 'clitoris',
    'coito', 'ejaculacao', 'erecao', 'esperma', 'fetiche', 'genitalia',
    'gozar', 'incesto', 'libido', 'masturbacao', 'nude', 'nudes',
    'nudez', 'orgasmo', 'orgia', 'pau', 'pedofilia', 'penis',
    'pornografia', 'prostituicao', 'punheta', 'semen', 'sexo',
    'sexting', 'siririca', 'transa', 'transando', 'transar', 'vagina',
    'vulva', 'zoofilia', 'asshole', 'bitch', 'blowjob', 'cock', 'culo',
    'cum', 'dick', 'fuck', 'handjob', 'joder', 'mierda', 'naked',
    'pene', 'porn', 'pussy', 'rape', 'sex', 'shit'
  ];
  blocked_prefixes constant text[] := ARRAY[
    'arrombad', 'babac', 'bost', 'bucet', 'cacet', 'caralh', 'clitor',
    'cuza', 'desgrac', 'ejacul', 'erot', 'escrot', 'esperma', 'estupr',
    'fetich', 'fod', 'genital', 'idiot', 'imbec', 'incest', 'masturb',
    'merd', 'necrofil', 'nud', 'orgasm', 'otari', 'pedofil', 'penetr',
    'piranh', 'piroc', 'porn', 'prostitut', 'putari', 'puteir', 'retardad',
    'safad', 'sexu', 'sodomi', 'testicul', 'vagabund', 'vagin', 'viad',
    'vulv', 'zoofil'
  ];
BEGIN
  normalized := regexp_replace(coalesce(_value, ''), '<[^>]*>', ' ', 'g');
  normalized := lower(normalized);
  normalized := translate(
    normalized,
    'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
    'aaaaaaeeeeiiiiooooouuuucnyy'
  );
  normalized := replace(replace(replace(replace(normalized, chr(8203), ''), chr(8204), ''), chr(8205), ''), chr(65279), '');
  normalized := regexp_replace(normalized, '[@4]', 'a', 'g');
  normalized := replace(normalized, '8', 'b');
  normalized := replace(normalized, '3', 'e');
  normalized := regexp_replace(normalized, '[1!|]', 'i', 'g');
  normalized := replace(normalized, '0', 'o');
  normalized := regexp_replace(normalized, '[$5]', 's', 'g');
  normalized := replace(normalized, '7', 't');
  normalized := trim(regexp_replace(normalized, '[^a-z0-9]+', ' ', 'g'));

  IF normalized = '' THEN
    RETURN true;
  END IF;

  words := regexp_split_to_array(normalized, '\s+');
  word_count := coalesce(array_length(words, 1), 0);

  FOR start_index IN 1..word_count LOOP
    candidate := words[start_index];
    collapsed := regexp_replace(candidate, '([a-z0-9])\1+', E'\\1', 'g');

    IF candidate = ANY (blocked_words)
      OR EXISTS (
        SELECT 1
        FROM unnest(blocked_words) AS blocked_word
        WHERE collapsed = regexp_replace(blocked_word, '([a-z0-9])\1+', E'\\1', 'g')
      )
      OR EXISTS (
        SELECT 1
        FROM unnest(blocked_prefixes) AS blocked_prefix
        WHERE collapsed LIKE regexp_replace(blocked_prefix, '([a-z0-9])\1+', E'\\1', 'g') || '%'
      )
    THEN
      RETURN false;
    END IF;

    IF start_index < word_count THEN
      contains_single_character_part := length(candidate) = 1;

      FOR end_index IN (start_index + 1)..least(word_count, start_index + 11) LOOP
        candidate := candidate || words[end_index];
        contains_single_character_part := contains_single_character_part OR length(words[end_index]) = 1;
        EXIT WHEN length(candidate) > 32;

        IF contains_single_character_part THEN
          collapsed := regexp_replace(candidate, '([a-z0-9])\1+', E'\\1', 'g');

          IF candidate = ANY (blocked_words)
            OR EXISTS (
              SELECT 1
              FROM unnest(blocked_words) AS blocked_word
              WHERE collapsed = regexp_replace(blocked_word, '([a-z0-9])\1+', E'\\1', 'g')
            )
            OR EXISTS (
              SELECT 1
              FROM unnest(blocked_prefixes) AS blocked_prefix
              WHERE collapsed LIKE regexp_replace(blocked_prefix, '([a-z0-9])\1+', E'\\1', 'g') || '%'
            )
          THEN
            RETURN false;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_note_content_moderation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  row_data jsonb := to_jsonb(NEW);
  moderated_content text;
BEGIN
  moderated_content := concat_ws(
    ' ',
    row_data ->> 'titulo',
    coalesce(row_data ->> 'conteudo', row_data ->> 'body')
  );

  IF NOT public.note_content_is_allowed(moderated_content) THEN
    RAISE EXCEPTION 'note_content_contains_prohibited_language'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_note_content_moderation ON public.notas;
CREATE TRIGGER enforce_note_content_moderation
BEFORE INSERT OR UPDATE OF titulo, conteudo ON public.notas
FOR EACH ROW
EXECUTE FUNCTION public.enforce_note_content_moderation();

DROP TRIGGER IF EXISTS enforce_note_comment_moderation ON public.note_comments;
CREATE TRIGGER enforce_note_comment_moderation
BEFORE INSERT OR UPDATE OF body ON public.note_comments
FOR EACH ROW
EXECUTE FUNCTION public.enforce_note_content_moderation();
