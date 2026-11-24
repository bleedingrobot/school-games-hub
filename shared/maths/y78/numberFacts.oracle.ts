/** Card Y5: the right answer to a number fact question, from the screen text alone (not the generators). Plain arithmetic on whole numbers where it can. */

/** "0.07" → { n: 7, dp: 2 }: a decimal as a whole number and its decimal places, so the arithmetic is exact. */
const scaled = (text: string) => {
  const [whole, frac = ''] = text.replace(/^\$/, '').split('.');
  return { n: Number(whole + frac), dp: frac.length };
};
const ratioWord = (text: string) => Number(text);
const fraction = (text: string) => {
  const [top, bottom] = text.split('/').map(Number);
  return { top, bottom };
};

export function oracle(key: string, parts: string[], prompt: string | undefined): number | null {
  if (!key.startsWith('nf:')) return null;
  switch (key) {
    case 'nf:dec-tenth':
    case 'nf:dec-tens':
    case 'nf:dec-hund': {
      const a = scaled(parts[0]);
      const b = scaled(parts[2]);
      return (a.n * b.n) / 10 ** (a.dp + b.dp);
    }
    case 'nf:dec-div': {
      const a = scaled(parts[0]);
      return a.n / (10 ** a.dp * Number(parts[2]));
    }
    case 'nf:est-times':
      return Math.round(Number(parts[0]) / 10) * 10 * Number(parts[2]);
    case 'nf:fadd':
    case 'nf:fsub': {
      const x = fraction(parts[0]);
      const y = fraction(parts[2]);
      const sign = parts[1] === '+' ? 1 : -1;
      return (x.top * y.bottom + sign * y.top * x.bottom) / (x.bottom * y.bottom);
    }
    case 'nf:ftimes': {
      const x = fraction(parts[0]);
      const y = fraction(parts[2]);
      return (x.top * y.top) / (x.bottom * y.bottom);
    }
    case 'nf:fdiv-whole':
      return Number(parts[0]) / (1 / fraction(parts[2]).bottom); // dividing by 1/d is times d
    case 'nf:fdiv-frac': {
      const x = fraction(parts[0]);
      return x.top / (x.bottom * Number(parts[2]));
    }
    case 'nf:pc-off':
    case 'nf:pc-more': {
      // "20% off $40" or "10% more than $30", read from the line above the sum.
      const m = /^(\d+)% (off|more than) \$(\d+)$/.exec(prompt ?? '')!;
      return (Number(m[3]) * (100 + (m[2] === 'off' ? -1 : 1) * Number(m[1]))) / 100;
    }
    case 'nf:pc-swap': {
      // a% of b equals b% of a, so the blank is the first percent.
      const a = Number(parts[0].replace('%', ''));
      const b = Number(parts[2]);
      return (a * b) / b;
    }
    case 'nf:ratio-eq':
      return (ratioWord(parts[2]) * ratioWord(parts[4])) / ratioWord(parts[0]);
    case 'nf:ratio-share': {
      const m = /^Share (\d+) in the ratio (\d+) : (\d+)\.$/.exec(prompt ?? '')!;
      const [total, a, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
      return (total * Math.max(a, b)) / (a + b);
    }
    case 'nf:ratio-blue': {
      const m = /^(\d+) red to (\d+) blue\. There are (\d+) red\.$/.exec(prompt ?? '')!;
      return (Number(m[3]) * Number(m[2])) / Number(m[1]);
    }
    case 'nf:change': {
      const paid = scaled(parts[0]);
      const cost = scaled(parts[2]);
      return (paid.n * 100 - cost.n) / 100;
    }
    case 'nf:cash': {
      const cents = scaled(parts[0]).n;
      return Math.floor((cents + 5) / 10) / 10;
    }
    case 'nf:round-3dp': {
      const a = scaled(parts[0]); // 4 decimal places
      return Math.floor((a.n + 5) / 10) / 1000;
    }
    default:
      return null;
  }
}
