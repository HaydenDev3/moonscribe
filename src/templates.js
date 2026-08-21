// Starter structures for a new novel. Each template seeds a handful of
// chapters so the skeleton is ready before the first sentence is written.
// The `blank` template is the implicit default (a single quiet chapter).

export const NOVEL_TEMPLATES = [
  {
    key: 'blank',
    label: 'Blank page',
    blurb: 'One quiet chapter, nothing assumed.',
    chapters: [{ kind: 'chapter', title: 'Chapter One', content: '' }]
  },
  {
    key: 'three-act',
    label: 'Three-act',
    blurb: 'Set up, confrontation, resolution — with room to move inside each.',
    chapters: [
      { kind: 'book', part: 'Act One', title: 'Act One' },
      { kind: 'chapter', part: 'Act One', title: 'The Ordinary World', content: '<p></p>' },
      { kind: 'chapter', part: 'Act One', title: 'An Inciting Incident', content: '<p></p>' },
      { kind: 'book', part: 'Act Two', title: 'Act Two' },
      { kind: 'chapter', part: 'Act Two', title: 'Rising Tension', content: '<p></p>' },
      { kind: 'chapter', part: 'Act Two', title: 'The Midpoint Reversal', content: '<p></p>' },
      { kind: 'chapter', part: 'Act Two', title: 'The Worst Moment', content: '<p></p>' },
      { kind: 'book', part: 'Act Three', title: 'Act Three' },
      { kind: 'chapter', part: 'Act Three', title: 'The Final Confrontation', content: '<p></p>' },
      { kind: 'chapter', part: 'Act Three', title: 'A New Equilibrium', content: '<p></p>' }
    ]
  },
  {
    key: 'heros-journey',
    label: 'Hero’s journey',
    blurb: 'The classic twelve-beat arc, from the call to the return.',
    chapters: [
      { kind: 'book', part: 'Part One', title: 'Part One' },
      { kind: 'chapter', part: 'Part One', title: 'The Ordinary World', content: '<p></p>' },
      { kind: 'chapter', part: 'Part One', title: 'The Call to Adventure', content: '<p></p>' },
      { kind: 'chapter', part: 'Part One', title: 'Refusing the Call', content: '<p></p>' },
      { kind: 'chapter', part: 'Part One', title: 'Meeting the Mentor', content: '<p></p>' },
      { kind: 'chapter', part: 'Part One', title: 'Crossing the Threshold', content: '<p></p>' },
      { kind: 'book', part: 'Part Two', title: 'Part Two' },
      { kind: 'chapter', part: 'Part Two', title: 'Tests, Allies and Enemies', content: '<p></p>' },
      { kind: 'chapter', part: 'Part Two', title: 'Approach to the Inmost Cave', content: '<p></p>' },
      { kind: 'chapter', part: 'Part Two', title: 'The Ordeal', content: '<p></p>' },
      { kind: 'chapter', part: 'Part Two', title: 'The Reward', content: '<p></p>' },
      { kind: 'book', part: 'Part Three', title: 'Part Three' },
      { kind: 'chapter', part: 'Part Three', title: 'The Road Back', content: '<p></p>' },
      { kind: 'chapter', part: 'Part Three', title: 'The Resurrection', content: '<p></p>' },
      { kind: 'chapter', part: 'Part Three', title: 'Return with the Elixir', content: '<p></p>' }
    ]
  },
  {
    key: 'mystery',
    label: 'Mystery',
    blurb: 'A body, a detective, and a trail of red herrings.',
    chapters: [
      { kind: 'book', part: 'Book One', title: 'Book One' },
      { kind: 'chapter', part: 'Book One', title: 'The Discovery', content: '<p></p>' },
      { kind: 'chapter', part: 'Book One', title: 'The First Suspect', content: '<p></p>' },
      { kind: 'chapter', part: 'Book One', title: 'A False Lead', content: '<p></p>' },
      { kind: 'book', part: 'Book Two', title: 'Book Two' },
      { kind: 'chapter', part: 'Book Two', title: 'The Hidden Motive', content: '<p></p>' },
      { kind: 'chapter', part: 'Book Two', title: 'The Confession That Isn’t', content: '<p></p>' },
      { kind: 'book', part: 'Book Three', title: 'Book Three' },
      { kind: 'chapter', part: 'Book Three', title: 'The Reveal', content: '<p></p>' },
      { kind: 'chapter', part: 'Book Three', title: 'The Aftermath', content: '<p></p>' }
    ]
  }
]
