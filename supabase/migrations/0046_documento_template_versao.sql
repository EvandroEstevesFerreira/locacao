-- ============================================================================
-- Versão editável do template de documento.
--
-- O `.docx` original trazia "FRM-RH-001 • Versão 1.2 • Documento assinado na
-- admissão", e na primeira transcrição só o código sobreviveu. Num documento que
-- sustenta justa causa, saber QUAL versão o empregado assinou é o que sustenta a
-- prova — "ele assinou o termo" vale menos que "ele assinou a versão 1.2".
--
-- A versão é editada junto com o texto: quem revisa a cláusula bumpa a versão.
-- A DATA não é campo: sai de `updated_at`, então nunca fica desatualizada por
-- esquecimento. Foi a decisão de 2026-08-23.
-- ============================================================================
alter table public.documento_template
  add column if not exists versao text;

comment on column public.documento_template.versao is
  'Versão do texto, editada pelo RH junto com a cláusula. A data de publicação '
  'não é campo: vem de updated_at, para não depender de alguém lembrar.';

notify pgrst, 'reload schema';
