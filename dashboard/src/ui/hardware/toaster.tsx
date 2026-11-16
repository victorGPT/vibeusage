import { Toast, ToastAction, ToastDescription, ToastRegion, ToastTitle, createToaster } from "@ui-sdk/react/toast"

// One toaster for the whole site, so any part can report something, like a
// copy, through `notify`. `Toasts` renders it once, at the root.
const notify = createToaster()

function Toasts() {
  return (
    <ToastRegion toaster={notify} data-kit="toast-region">
      {() => (
        <Toast data-kit="toast">
          <div data-kit="toast-text">
            <ToastTitle data-kit="toast-title" />
            <ToastDescription data-kit="toast-description" />
          </div>
          <ToastAction data-kit="button" data-tone="secondary" />
        </Toast>
      )}
    </ToastRegion>
  )
}

export { Toasts, notify }
