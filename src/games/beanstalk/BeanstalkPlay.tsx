/**
 * Kiwi's Beanstalk in the hub, on the school's `beanstalk` server function (src/data/beanstalk.ts). The preview plays the
 * same screens on the browser-only trial backend instead.
 */
import { useNavigate } from 'react-router';
import { liveBeanstalk } from '../../data/beanstalk';
import { BeanstalkGame } from './BeanstalkGame';

export function BeanstalkPlay() {
  const navigate = useNavigate();
  return <BeanstalkGame backend={liveBeanstalk} onExit={() => navigate('/')} />;
}
