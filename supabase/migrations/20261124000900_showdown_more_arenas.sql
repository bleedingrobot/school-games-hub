-- Class Showdown stage 7 (docs/SHOWDOWN-PLAN.md section 4): four more arenas, Sky Climb, Shrinking Island, King of the
-- Hill and Auction House. Like Gold Rush, each round lives in the room's hidden round and pays through showdown_finish
-- with roster false, so the only change is letting a room be one of them. Nothing is deleted.
alter table public.showdown_rooms drop constraint showdown_rooms_arena_check,
  add constraint showdown_rooms_arena_check check (arena in ('boss', 'goldrush', 'skyclimb', 'island', 'hill', 'auction'));
