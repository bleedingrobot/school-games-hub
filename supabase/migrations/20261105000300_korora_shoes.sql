-- Penguin Pairs: the penguin is now Two-Shoes, and the prize is a pair of dancing shoes (James, 4 Nov 2026). Each
-- crossing of the ten stepping stones wins a pair: bronze, then silver, then dazzling gold after thirty days. Only the
-- gold pair is an achievement, and it comes on the same day the Golden Fish did, so nothing a pupil has changes: this
-- only renames the achievements and the How points work line. The measure keeps its old name, korora_fish.

update public.achievement_types set name = v.name, emoji = v.emoji
from (values
  ('korora-korora', 'Two-Shoes’ gold dancing shoes', '🩰'),
  ('korora-hoiho', 'Hoiho’s gold dancing shoes', '🩰'),
  ('korora-kiwi', 'Kiwi’s gold dancing shoes', '🩰'),
  ('korora-pukeko', 'Pūkeko’s gold dancing shoes', '🩰'),
  ('korora-kereru', 'Kererū’s gold dancing shoes', '🩰'),
  ('korora-takahe', 'Takahē’s gold dancing shoes', '🩰')
) as v(id, name, emoji)
where achievement_types.id = v.id;

create or replace function public.korora_point_rules()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('lines', jsonb_build_array(
    'No points: each pair of dazzling gold dancing shoes is the prize, and an achievement.'))
$$;
