-- Diamond Drop: the rarest gem is now the Fablet Rose (James, 18 Nov 2026).
-- Only the names pupils see change; the ids (diamond-phoenix, diamond_phoenix) stay the same.
update public.achievement_types
  set name = 'Fablet Rose Finder', emoji = '🌹'
  where id = 'diamond-phoenix';

update public.trophy_types
  set name = 'Fablet Rose', how = 'Catch the Fablet Rose, the rarest gem in Diamond Drop (1 in 100 levels).'
  where id = 'diamond-phoenix';
