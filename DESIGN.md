# Design

Same family as Vantage and the migraine diary: a fixed four-stop radial wash,
glass panes that blur it, a floating pill nav on phones and a tab row on
desktop, one gradient hero per screen, self-hosted Rubik split by
unicode-range, tabular numerals. The colours come from the DanDaShemesh logo:
navy `#083b68` (the box) carries actions and the hero, orange `#ff9d00` (the
sun) marks the one call to action, Post, and the "new with tag" badge. Dark
mode lifts navy to `#8bb8ef`.

- Every colour is a token on `:root`; dark mode redefines tokens only.
- White on navy is 11.6:1, navy on orange 5.4:1, light-blue accent on the dark canvas 9.4:1.
- Feed cards are 4:5 with the condition tag top-start and the source and
  problem as one pill under the title. The problem is the point of the board,
  so it is on every card.
- The middle nav item, Post, is the one solid accent disc on the screen.
- Over 900px the filters move to a sticky side panel and sheets become
  centred dialogs.
- RTL and LTR are both first class: logical properties (`inset-inline`,
  `margin-inline`) everywhere, `dir="auto"` on user text.
- `prefers-reduced-motion` and `prefers-reduced-transparency` are honoured.
- Plain hyphens only, never em dashes.
