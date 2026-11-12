import { copy } from "#src/lib/copy.ts";
import { Label } from "#src/ui/2049/base/Label.tsx";
import { buttonVariants } from "#src/ui/shadcn/button.tsx";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "#src/ui/shadcn/dialog.tsx";

const KEY_ROWS = [
  ["?", "keyboard.cheatsheet.row.toggle"],
  ["d", "keyboard.cheatsheet.row.day"],
  ["w", "keyboard.cheatsheet.row.week"],
  ["m", "keyboard.cheatsheet.row.month"],
  ["t", "keyboard.cheatsheet.row.total"],
  ["r", "keyboard.cheatsheet.row.refresh"],
  ["s", "keyboard.cheatsheet.row.share"],
  ["esc", "keyboard.cheatsheet.row.close"],
] as const;

export function KeyboardCheatsheet({ open, onClose }: { open: boolean; onClose?: () => void }) {
  return (
    <Dialog open={!!open} onOpenChange={(next) => !next && onClose?.()}>
      <DialogContent aria-label={copy("keyboard.cheatsheet.aria_label")} className="max-w-md">
        <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
          <DialogTitle>{copy("keyboard.cheatsheet.title")}</DialogTitle>
          <div className="flex items-center gap-3">
            <span aria-hidden="true">
              <Label text={copy("keyboard.cheatsheet.dismiss_hint")} />
            </span>
            <DialogClose
              aria-label={copy("keyboard.cheatsheet.close_aria")}
              className={buttonVariants({ variant: "ghost" })}
            >
              {copy("keyboard.cheatsheet.close_label")}
            </DialogClose>
          </div>
        </div>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {KEY_ROWS.map(([key, descKey]) => (
            <li key={key} className="flex items-center gap-4">
              <kbd className="inline-flex h-control min-w-12 items-center justify-center rounded-sm border border-input px-2 font-command text-label-lg/none text-hero uppercase">
                {key}
              </kbd>
              <span className="font-sans text-copy-s/normal font-medium text-foreground">{copy(descKey)}</span>
            </li>
          ))}
        </ul>
        <div className="border-t border-border pt-3">
          <Label text={copy("keyboard.cheatsheet.footer_note")} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
