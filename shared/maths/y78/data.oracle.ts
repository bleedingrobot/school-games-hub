/** Card Y8: the right answer to an averages or chance question, from the screen text alone (not the generators). */
const numbers = (text: string) => text.replace(/^The numbers /, '').split(', ').map(Number);

export function oracle(key: string, parts: string[], prompt: string | undefined): number | null {
  if (key.startsWith('avg:')) {
    const nums = numbers(prompt!);
    const sorted = [...nums].sort((a, b) => a - b);
    switch (parts[0]) {
      case 'Median':
        return sorted[(sorted.length - 1) / 2];
      case 'Range':
        return sorted[sorted.length - 1] - sorted[0];
      case 'Mean':
        return nums.reduce((a, b) => a + b, 0) / nums.length;
      case 'Mode': {
        let best = nums[0];
        for (const n of nums) if (nums.filter((x) => x === n).length > nums.filter((x) => x === best).length) best = n;
        return best;
      }
    }
    return null;
  }
  if (key === 'prob:bag') {
    const m = /^A bag has (\d+) (\w+) and (\d+) (\w+) counters\. Take one without looking\.$/.exec(prompt!)!;
    const colour = /^Chance of (\w+)$/.exec(parts[0])![1];
    const mine = colour === m[2] ? Number(m[1]) : Number(m[3]);
    return mine / (Number(m[1]) + Number(m[3]));
  }
  if (key === 'prob:dice') {
    const m = /^Chance of (not a|more than|less than) (\d)$/.exec(parts[0])!;
    const n = Number(m[2]);
    const faces = [1, 2, 3, 4, 5, 6].filter((f) => (m[1] === 'not a' ? f !== n : m[1] === 'more than' ? f > n : f < n));
    return faces.length / 6;
  }
  if (key === 'prob:not') {
    const p = Number(/is (\d\.\d)$/.exec(prompt!)![1]);
    return Math.round((1 - p) * 10) / 10;
  }
  if (key === 'prob:percent') {
    const m = /^(\d+) in (\d+)$/.exec(parts[0])!;
    return (Number(m[1]) * 100) / Number(m[2]);
  }
  return null;
}
