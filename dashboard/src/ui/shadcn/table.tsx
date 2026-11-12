import type { ComponentProps } from "react";

import { cn } from "#src/lib/utils.ts";

// SSOT: design/2049/source/Table.dc.html. Rows are 40px (12px padding around 15px Saira), the
// header rule is the input color and body rules the border color. The wrapper scrolls sideways
// so a wide table never makes the page scroll.
function Table({ className, label, ...props }: ComponentProps<"table"> & { label: string }) {
  return (
    <div
      data-slot="table-container"
      tabIndex={0}
      role="region"
      aria-label={label}
      className="w-full overflow-x-auto outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <table
        data-slot="table"
        className={cn(
          "w-full border-collapse font-display text-[15px]/none font-normal text-foreground tabular-nums",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function TableHeader(props: ComponentProps<"thead">) {
  return <thead data-slot="table-header" {...props} />;
}

function TableBody(props: ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" {...props} />;
}

function TableRow(props: ComponentProps<"tr">) {
  return <tr data-slot="table-row" {...props} />;
}

function TableHead({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      scope="col"
      className={cn(
        "border-b border-input py-3 text-left font-sans text-[11px]/none font-semibold whitespace-nowrap uppercase tracking-label text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("border-b border-border py-3 text-left whitespace-nowrap", className)}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
