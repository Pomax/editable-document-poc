export const Keys = {
  up: `ArrowUp`,
  down: `ArrowDown`,
  left: `ArrowLeft`,
  right: `ArrowRight`,
  backspace: `Backspace`,
  delete: `Delete`,
  enter: `Enter`,
};

// Directly editable elements "root" elements.
export const Editable = [`pre`, `p`, `h1`, `h2`, `h3`, `h4`, `ul`, `ol`, `img`];

// Alements where leading and trailing white space can be safely removed.
export const Trimmable = [`main`, `header`, `div`, `section`, `li`];

// Cosmetic markup that may be nested in any order
export const Cosmetic = [`strong`, `em`, `b`, `i`, `s`, `code`, `a`];

// Which OS are we in? Because we need to know which hotkeys to intercept
export const OS = navigator.userAgent.includes("Mac OS") ? `mac` : `pc`;
