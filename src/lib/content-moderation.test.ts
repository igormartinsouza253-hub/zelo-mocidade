import { describe, expect, it } from "vitest";

import { containsInappropriateLanguage } from "./content-moderation";

describe("containsInappropriateLanguage", () => {
  it.each([
    "Esse texto contém p0rra no meio.",
    "Não escreva c@r@lho aqui.",
    "Que sujeito arrombaaado.",
    "Ele digitou f.d.p para disfarçar.",
    "A expressão p u t a está separada.",
    "Conteúdo pornográfico não é permitido.",
    "Texto com conotação sexual.",
    "A palavra masturbação deve ser recusada.",
    "Tentativa com s3x0 também deve falhar.",
    "Nudes e sexting são proibidos.",
    "Explicit content with blowjob must fail.",
  ])("blocks profanity, sexual terms and obfuscation: %s", (value) => {
    expect(containsInappropriateLanguage(value)).toBe(true);
  });

  it.each([
    "Vamos discutir o documento e a cultura do grupo.",
    "A computação ajuda na organização.",
    "A análise do encontro foi positiva.",
    "A sexta reunião acontecerá amanhã.",
    "A transação foi registrada corretamente.",
    "O grupo demonstrou muita satisfação.",
    "Estudaremos a carta aos Filipenses.",
  ])("does not block safe words containing similar letter sequences: %s", (value) => {
    expect(containsInappropriateLanguage(value)).toBe(false);
  });
});
