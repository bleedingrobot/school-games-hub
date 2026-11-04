-- Star Trader: the Star Forge starts switched ON for new classes (James, 4 Nov 2026: "turn it on").
-- Every existing class was switched on the same day (update app_settings set trader_forge = true).
-- Teachers can still turn it off on the Star Trader settings.
alter table public.app_settings alter column trader_forge set default true;
update public.app_settings set trader_forge = true where trader_forge = false;
