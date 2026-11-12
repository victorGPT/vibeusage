import { ToggleGroup, ToggleGroupItem } from "#src/ui/shadcn/toggle-group.tsx";

type TabsProps<T extends string> = {
  label: string;
  value: T;
  items: { value: T; label: string }[];
  onChange?: (value: T) => void;
};

// SSOT: design/2049/source/ToggleGroup.dc.html. The single-select strip every block header uses.
export function Tabs<T extends string>({ label, value, items, onChange }: TabsProps<T>) {
  return (
    <ToggleGroup aria-label={label} value={[value]} onValueChange={(next) => onChange?.(next[0] as T)}>
      {items.map((item) => (
        <ToggleGroupItem key={item.value} value={item.value}>
          {item.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
