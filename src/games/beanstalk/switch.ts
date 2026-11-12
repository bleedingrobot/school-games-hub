
/**
 * Is Kiwi's Beanstalk in the hub at all? On since 4 Nov 2026 (docs/BEANSTALK-PLAN.md, Stage 5).
 * `VITE_BEANSTALK_ON=true` in .env.local shows it on your own computer. Even when on, the card hides until the teacher
 * switches the game on for the class.
 */
const ON = true;

export const beanstalkOn = (): boolean => ON || import.meta.env.VITE_BEANSTALK_ON === 'true';
