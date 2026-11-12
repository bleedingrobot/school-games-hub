/**
 * Kiwi's Beanstalk in the hub, on the school's `beanstalk` server function (src/data/beanstalk.ts). The preview plays the
 * same screens on the browser-only trial backend instead.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { liveBeanstalk } from '../../data/beanstalk';
import { fetchMyLadder } from '../../data/ladder';
import { useGameSwitch } from '../../data/classSwitches';
import { BeanstalkGame } from './BeanstalkGame';
import { sumSecure, type Signpost } from './signpost';

export function BeanstalkPlay() {
  const navigate = useNavigate();
  const wekaOn = useGameSwitch('weka');
  // The card on to Weka (maths review R8): Weka's switch for this class, and this child's own records for the sum.
  const signpost = useMemo<Signpost>(
    () => ({
      wekaOn,
      secure: async (target) => sumSecure((await fetchMyLadder()).facts, target),
      open: () => navigate('/weka'),
    }),
    [wekaOn, navigate],
  );
  return <BeanstalkGame backend={liveBeanstalk} onExit={() => navigate('/')} signpost={signpost} />;
}
