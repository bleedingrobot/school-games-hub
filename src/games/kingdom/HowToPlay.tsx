/**
 * How to play, in plain words. Every number comes from shared/kingdom/config.ts, so changing a rule changes this page.
 */
import {
  ACRES_PER_BUSHEL, ACRES_PER_PERSON, BUILD_BOON, COUNCIL_SIZE, FOOD_PER_PERSON, HARD_TIMES, HARVEST_BOON, HARVEST_MOST, HUNGRY_LIMIT,
  PRICE_LOW, PRICE_SPREAD, RATINGS, START, TRADE_BOON, YEARS,
} from '../../../shared/kingdom/config';

export function HowToPlayBody() {
  return (
    <div className="kk-howto">
      <h3>Your job</h3>
      <p>
        Rule the river city of Riverstone for {YEARS} years. You start with {START.people + START.newcomers} people, {START.grain.toLocaleString('en-NZ')} bushels of grain and{' '}
        {START.land.toLocaleString('en-NZ')} acres of land. Keep your people fed and help the city grow.
      </p>

      <h3>Each year</h3>
      <ul>
        <li><strong>The steward’s report</strong> tells you what happened last year.</li>
        <li><strong>The council:</strong> {COUNCIL_SIZE} advisers each ask you a maths question. A right answer wins their boon for the year. A wrong answer just means no boon: you never lose anything.</li>
        <li><strong>The Market:</strong> buy or sell land. Land costs {PRICE_LOW} to {PRICE_LOW + PRICE_SPREAD - 1} bushels an acre, and the price changes every year.</li>
        <li><strong>The Granary:</strong> each person eats {FOOD_PER_PERSON} bushels a year. People who aren’t fed go hungry and leave the city.</li>
        <li><strong>The Fields:</strong> one bushel of seed plants {ACRES_PER_BUSHEL} acres, and one person can farm {ACRES_PER_PERSON} acres. Each acre grows 1 to {HARVEST_MOST} bushels.</li>
      </ul>

      <h3>The council’s boons</h3>
      <ul>
        <li><strong>Marigold the reeve:</strong> {HARVEST_BOON} more bushel from every acre at harvest.</li>
        <li><strong>Nettle the rat catcher:</strong> no rats in the granary.</li>
        <li><strong>Quince the trader:</strong> land {TRADE_BOON} bushels an acre cheaper to buy, and {TRADE_BOON} more when you sell.</li>
        <li><strong>Rowan the healer:</strong> no sickness.</li>
        <li><strong>Bram the builder:</strong> {BUILD_BOON === 1.5 ? 'half as many again' : `${BUILD_BOON} times as many`} new people come to live here.</li>
      </ul>

      <h3>Watch out for</h3>
      <ul>
        <li><strong>Rats</strong> sometimes get into the granary and eat some of the grain.</li>
        <li><strong>Sickness</strong> sometimes comes, and half the people leave until it passes.</li>
        <li>If more than {Math.round(HUNGRY_LIMIT * 100)}% of the people go hungry in one year, they warn you. If it happens again, they ask for a new ruler and your reign ends.</li>
      </ul>

      <h3>How your reign is remembered</h3>
      <ul>
        {RATINGS.map((r) => (
          <li key={r.id}><strong>{r.name}:</strong> on average no more than {r.hungryAtMost}% went hungry each year, and at least {r.peopleAtLeast} people at the end.</li>
        ))}
        <li><strong>{HARD_TIMES.name}:</strong> anything else, or a reign that ended early.</li>
      </ul>
    </div>
  );
}
