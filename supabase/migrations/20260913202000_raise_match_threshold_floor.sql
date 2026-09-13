-- Raise the similarity floor so unrelated topics stop auto-matching.
--
-- clamp_match_threshold pinned the minimum at 0.65. Measured over real topic
-- pairs embedded exactly as the app does (gemini-embedding-001, 768 dims,
-- SEMANTIC_SIMILARITY), that is below every score the model can produce:
--
--   unrelated pairs   0.671 - 0.788   ("software engineer" / "soccer" = 0.787)
--   related pairs     0.868 - 0.983   ("exam stress" / "stressed about finals")
--
-- So every pair cleared the floor and matched instantly, and the consent and
-- suggestion paths could never run. 0.83 sits in the gap between the two
-- groups.
create or replace function public.clamp_match_threshold(p_threshold float)
returns float
language sql
immutable
as $$
  select least(greatest(coalesce(p_threshold, 0.83), 0.83), 1.0);
$$;

comment on function public.clamp_match_threshold(float) is
  'Clamps a caller-supplied similarity threshold to [0.83, 1.0]. The floor is above the band unrelated topics score in, so it cannot be widened into matching strangers on unrelated topics.';
