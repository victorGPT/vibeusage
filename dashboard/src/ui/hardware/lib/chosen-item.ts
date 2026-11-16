import type * as React from "react"

// Marks the item a person chose, so it can blink while its menu closes;
// a menu closed any other way just fades.
const markChosen = (event: React.SyntheticEvent<HTMLElement>) => {
  event.currentTarget.dataset.chosen = ""
}
const chosenItem = {
  onClick: markChosen,
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") markChosen(event)
  },
}

export { chosenItem }
