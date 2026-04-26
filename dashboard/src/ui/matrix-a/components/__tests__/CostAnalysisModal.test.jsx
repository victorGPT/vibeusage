import { act, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CostAnalysisModal } from "../CostAnalysisModal.jsx";

it("invokes onClose when the user dismisses via Escape", async () => {
  const onClose = vi.fn();
  const user = userEvent.setup();
  render(
    <CostAnalysisModal isOpen={true} onClose={onClose} fleetData={[]} />,
  );

  await act(async () => {
    await user.keyboard("{Escape}");
  });

  expect(onClose).toHaveBeenCalledTimes(1);
});
