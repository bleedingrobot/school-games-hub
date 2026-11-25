/**
 * Printing some badges, not every card on the page: a whole sheet (one class, or the pupils just added) or a single card.
 * The chosen sheet and card are marked for the print styles in badges.css; the marks come off after printing.
 */
const MARKS = ['badges-picked', 'badges-pick-sheet', 'badges-one', 'badges-pick'];

function clearMarks() {
  for (const mark of MARKS) document.querySelectorAll(`.${mark}`).forEach((el) => el.classList.remove(mark));
}

/** Prints the sheet or card this element is (or is in). */
export function printBadges(target: Element | null) {
  clearMarks();
  const card = target?.closest('.badge-card');
  const sheet = target?.closest('.badges__sheet');
  if (sheet) {
    document.body.classList.add('badges-picked');
    sheet.classList.add('badges-pick-sheet');
    if (card) {
      sheet.classList.add('badges-one');
      card.classList.add('badges-pick');
    }
  }
  window.addEventListener('afterprint', clearMarks, { once: true });
  window.print();
}
