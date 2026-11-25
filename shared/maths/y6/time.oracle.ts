/** Card L2: right answers to the negative numbers and time questions, from the screen text alone (not the generators). */
const num = (text: string) => Number(text.replace(/[°C,]/g, '').replace('−', '-'));
const clock = (text: string) => {
  const [, h, m] = /^(\d+):(\d\d) /.exec(text)!;
  return Number(h) * 60 + Number(m);
};

export function oracle(key: string, parts: string[], _prompt: string | undefined): number | null {
  if (key === 'cz:back' || key === 'cz:on') {
    const [a, b, c] = parts.slice(0, 3).map(num);
    return c + (b - a);
  }
  if (key === 'cz:temp') return parts[1] === '+' ? num(parts[0]) + num(parts[2]) : num(parts[0]) - num(parts[2]);
  if (key === 'tunit:hmin') {
    const m = /^(\d*)(½?)(?: h)?(?: (\d+) min)?$/.exec(parts[0].replace(/ h$/, ''));
    const text = parts[0];
    if (text.endsWith('min')) return Number(text.split(' ')[0]) * 60 + Number(text.split(' ')[2]);
    return m ? (Number(m[1] || 0) + (m[2] ? 0.5 : 0)) * 60 : null;
  }
  if (key === 'tunit:mins') return parts[0] === '½ min' ? 30 : Number(parts[0].split(' ')[0]) * 60;
  if (key === 'tunit:minh') return Number(parts[0].split(' ')[0]) / 60;
  if (key === 'elap:tohour' || key === 'elap:gap') return clock(parts[2]) - clock(parts[0]);
  return null; // t24:* are checked in time.picks.ts
}
