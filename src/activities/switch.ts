/**
 * Is the Activities page on? Activities are calm practice of one skill, not games (docs/ORDERUP-PLAN.md, "What an Activity
 * is"). While this is false there is no Activities link in the top menu and no /activities page, so pupils never see an empty
 * page. Turn it on in the PR that makes the first activity (Order Up! levels 1 to 3) live.
 *
 * To try it on your own computer without changing this file, put VITE_ACTIVITIES_ON=true in .env.local.
 */
const ACTIVITIES_ON = false;

export const activitiesOn = (): boolean => ACTIVITIES_ON || import.meta.env.VITE_ACTIVITIES_ON === 'true';
