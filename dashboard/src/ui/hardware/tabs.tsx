import * as React from "react"
import { Tabs as SdkTabs, TabsIndicator, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs"

function Tabs({
  items,
  label = "Sections",
  value,
  onValueChange,
}: {
  items: { value: string; label: string; body: React.ReactNode }[]
  /** Names the row of tabs for assistive technology. */
  label?: string
  /** Set with onValueChange to control which tab is open. */
  value?: string
  onValueChange?: (value: string) => void
}) {
  const controlled = value === undefined ? { defaultValue: items[0].value } : { value }
  return (
    <SdkTabs
      data-kit="tabs"
      {...controlled}
      onValueChange={onValueChange ? (next: unknown) => onValueChange(String(next)) : undefined}
    >
      <TabsList data-kit="tabs-list" aria-label={label}>
        <TabsIndicator data-kit="tabs-indicator" />
        {items.map((item) => (
          <TabsTab key={item.value} value={item.value} data-kit="tab">
            {item.label}
          </TabsTab>
        ))}
      </TabsList>
      {items.map((item) => (
        <TabsPanel key={item.value} value={item.value} data-kit="tab-panel">
          {item.body}
        </TabsPanel>
      ))}
    </SdkTabs>
  )
}

export { Tabs }
