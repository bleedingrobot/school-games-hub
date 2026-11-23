/**
 * Class Showdown's code switch (docs/SHOWDOWN-PLAN.md section 9): on since stage 4. Which classes see it is the database's
 * showdown_enabled setting (James's class only in stage 4, every class from stage 5).
 */
export const SHOWDOWN_ON = true;
export const showdownOn = () => SHOWDOWN_ON;
