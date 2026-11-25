-- Year 6 maths tagged in the database too (James, 26 Nov 2026: "please make sure these are tagged as year 6 skills in the
-- database"). One row per question type of the Year 6 ladder skills (docs/plans/ladder-y6/PLAN.md, PR #878) in
-- maths_content_years, beside the Year 7 and 8 rows, so pupils' records (gem_keep_facts) can be read as Year 6 work by
-- joining on the key. Kept in step with shared/maths/skillPacks/y6.ts by shared/maths/y78.test.ts.

-- The table took Year 7 and 8 only; it now takes Year 6 as well. Nothing in it changes.
alter table public.maths_content_years drop constraint maths_content_years_year_check;
alter table public.maths_content_years add constraint maths_content_years_year_check check (year in (6, 7, 8));

insert into public.maths_content_years (question_key, skill, skill_label, year) values
  ('huge:tenk', 'round-huge', 'Rounding to the nearest 10 000 and 100 000', 6),
  ('huge:hundredk', 'round-huge', 'Rounding to the nearest 10 000 and 100 000', 6),
  ('rem:left', 'remainders', 'Division with a remainder (38 ÷ 5)', 6),
  ('rem:times', 'remainders', 'Division with a remainder (38 ÷ 5)', 6),
  ('cz:back', 'count-zero', 'Counting through zero (−6, −8, −10, …)', 6),
  ('cz:on', 'count-zero', 'Counting through zero (−6, −8, −10, …)', 6),
  ('cz:temp', 'count-zero', 'Counting through zero (−6, −8, −10, …)', 6),
  ('tunit:hmin', 'time-y6', 'Hours, minutes and seconds', 6),
  ('tunit:mins', 'time-y6', 'Hours, minutes and seconds', 6),
  ('tunit:minh', 'time-y6', 'Hours, minutes and seconds', 6),
  ('t24:to12', 'time-24', '24-hour time', 6),
  ('t24:to24', 'time-24', '24-hour time', 6),
  ('elap:tohour', 'elapsed', 'Time across the hour', 6),
  ('elap:gap', 'elapsed', 'Time across the hour', 6),
  ('thou:times', 'thousandths', 'Times and divide by 1000, and thousandths', 6),
  ('thou:divide', 'thousandths', 'Times and divide by 1000, and thousandths', 6),
  ('thou:frac', 'thousandths', 'Times and divide by 1000, and thousandths', 6),
  ('dorder:biggest', 'decimal-order', 'Ordering decimals to 3 places', 6),
  ('dorder:smallest', 'decimal-order', 'Ordering decimals to 3 places', 6),
  ('m6:small', 'metric-y6', 'Metric units: kg and g, m and cm, L and mL', 6),
  ('m6:big', 'metric-y6', 'Metric units: kg and g, m and cm, L and mL', 6),
  ('m6:mixed', 'metric-y6', 'Metric units: kg and g, m and cm, L and mL', 6),
  ('fa6:same', 'fraction-add-y6', 'Adding simple fractions (½ + ¼)', 6),
  ('fa6:double', 'fraction-add-y6', 'Adding simple fractions (½ + ¼)', 6),
  ('area6:rect', 'area-y6', 'Area of rectangles and right-angled triangles, volume of boxes', 6),
  ('area6:tri', 'area-y6', 'Area of rectangles and right-angled triangles, volume of boxes', 6),
  ('area6:box', 'area-y6', 'Area of rectangles and right-angled triangles, volume of boxes', 6),
  ('ang6:line', 'angles-y6', 'Angles on a line, at a point and vertically opposite', 6),
  ('ang6:point', 'angles-y6', 'Angles on a line, at a point and vertically opposite', 6),
  ('ang6:opposite', 'angles-y6', 'Angles on a line, at a point and vertically opposite', 6),
  ('shp:quad', 'shape-clue', 'Naming shapes from a clue', 6),
  ('shp:tri', 'shape-clue', 'Naming shapes from a clue', 6),
  ('shp:faces', 'shape-clue', 'Naming shapes from a clue', 6),
  ('rot:order', 'rot-symmetry', 'Order of rotational symmetry', 6),
  ('coord:move', 'coordinates', 'Coordinates (x, y)', 6),
  ('coord:axis', 'coordinates', 'Coordinates (x, y)', 6),
  ('chw:event', 'chance-words', 'Chance words and the 0 to 1 scale', 6),
  ('chw:number', 'chance-words', 'Chance words and the 0 to 1 scale', 6),
  ('spin:part', 'spinner', 'Chance on a spinner', 6),
  ('spin:rest', 'spinner', 'Chance on a spinner', 6),
  ('mr6:range', 'mean-range-y6', 'Mean and range', 6),
  ('mr6:mean', 'mean-range-y6', 'Mean and range', 6),
  ('pat6:next', 'pattern-next', 'Growing patterns', 6),
  ('pat6:step', 'pattern-next', 'Growing patterns', 6),
  ('pat6:gap', 'pattern-next', 'Growing patterns', 6),
  ('tf6:fact', 'true-false-y6', 'True or false with < > ≤ ≥', 6),
  ('tf6:sides', 'true-false-y6', 'True or false with < > ≤ ≥', 6);
