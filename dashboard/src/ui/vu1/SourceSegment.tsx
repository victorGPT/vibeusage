import { Field, FieldLabel } from "@ui-sdk/react/field";
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@ui-sdk/react/segmented-control";

import { copy } from "#src/lib/copy.ts";
import { haptic } from "#src/ui/hardware/lib/haptics.ts";

import { sourceLabel, type Option } from "./labels";
import "./blocks.css";

// print="key" sets each name on its slot (DESIGN.md "Segmented"); without it the kit prints names under the slots.
type SegmentProps<T extends string> = { label: string; options: Option<T>[]; value: T; onChange: (value: T) => void; print?: "key" };

// The kit's segmented control, controlled: the page owns the value, so arrow keys and focus
// survive a change. Same parts and data-kit names as src/ui/hardware/segmented-control.tsx.
export function Segment<T extends string>({ label, options, value, onChange, print }: SegmentProps<T>) {
  return (
    <Field data-kit="field" data-vu1="segment" data-print={print}>
      <FieldLabel data-kit="label" className="sr-only">
        {label}
      </FieldLabel>
      <SegmentedControl
        data-kit="segmented"
        value={value}
        onValueChange={(next) => {
          if (!next || next === value) return;
          haptic("selection");
          onChange(next as T);
        }}
      >
        <SegmentedControlIndicator data-kit="segmented-indicator" />
        {options.map((option) => (
          <SegmentedControlItem key={option.value} value={option.value} data-kit="segment" data-value={option.value}>
            <span data-kit="led" aria-hidden />
            {option.label}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
    </Field>
  );
}

export function SourceSegment({ sources, value, onChange }: { sources: string[]; value: string; onChange: (source: string) => void }) {
  return (
    <Segment
      label={copy("vu1.source.label")}
      options={sources.map((id) => ({ value: id, label: sourceLabel(id) }))}
      value={value}
      onChange={onChange}
    />
  );
}
