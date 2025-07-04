// Which OS are we in? Because we need to know which hotkeys to intercept
export const OS = navigator.userAgent.includes("Mac OS") ? `mac` : `pc`;

// Directly editable elements "root" elements.
export const Editable = [
  `blockquote`,
  `h1`,
  `h2`,
  `h3`,
  `h4`,
  `img`,
  `ol`,
  `p`,
  `pre`,
  `table`,
  `ul`,
  `figure`,
];

export const cosmeticsMaster = [
  `strong`,
  `em`,
  `code`,
  `del`,
  `a`,
  `sup`,
  `sub`,
];

// Used for tracking the caret across html<->markdown conversions
export const caretMarker = `<mark>cursor goes here</mark>`;
