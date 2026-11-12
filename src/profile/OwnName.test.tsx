import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const names = vi.hoisted(() => ({
  fetchMyNameStatus: vi.fn(),
  askForMyName: vi.fn(async () => "Te Ahi"),
  cancelMyNameRequest: vi.fn(),
  fetchNameRequests: vi.fn(),
  answerName: vi.fn(async () => "approved" as const),
}));
vi.mock("../data/ownName", async (original) => ({
  ...(await original<typeof import("../data/ownName")>()),
  ...names,
}));
const classes = vi.hoisted(() => ({
  fetchWarpRequests: vi.fn(async () => []),
}));
vi.mock("../data/classes", async (original) => ({
  ...(await original<typeof import("../data/classes")>()),
  ...classes,
}));

import {
  NeedsYou,
  WaitingCount,
  WaitingToJoinProvider,
} from "../teacher/WaitingToJoin";
import { OwnNamePanel } from "./OwnName";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("earn your own name", () => {
  it("lets a pupil with a scroll send a name, which then waits for the teacher", async () => {
    const free = {
      scrolls: 1,
      waiting: null,
      last: null,
      canPickToday: true,
      typed: false,
    };
    names.fetchMyNameStatus
      .mockResolvedValueOnce(free)
      .mockResolvedValue({
        ...free,
        scrolls: 0,
        waiting: { name: "Te Ahi", askedAt: new Date().toISOString() },
      });
    render(<OwnNamePanel />);

    await userEvent.type(await screen.findByLabelText("My own name"), "te ahi");
    await userEvent.click(
      screen.getByRole("button", { name: "Send to my teacher" }),
    );

    expect(names.askForMyName).toHaveBeenCalledWith("te ahi");
    expect(
      await screen.findByRole("button", { name: "Take it back" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/is waiting for your teacher/)).toBeInTheDocument();
  });

  it("shows a typed name in Needs you and the nav count, and a Yes answers it", async () => {
    const ask = {
      id: "n1",
      class_id: "c1",
      class_name: "Room 12",
      student_id: "s1",
      student_name: "Brave Kiwi 7",
      real_name: "Ana",
      wanted: "Te Ahi",
      asked_at: new Date().toISOString(),
    };
    names.fetchNameRequests.mockResolvedValueOnce([ask]).mockResolvedValue([]);
    render(
      <MemoryRouter>
        <WaitingToJoinProvider teacher>
          <WaitingCount />
          <NeedsYou classId="c1" />
        </WaitingToJoinProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/1 waiting for you/)).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Yes, Brave Kiwi 7 can be Te Ahi" }),
    );

    expect(names.answerName).toHaveBeenCalledWith("n1", true);
    expect(
      await screen.findByText("Brave Kiwi 7 is now Te Ahi."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/waiting for you/)).not.toBeInTheDocument();
  });
});
