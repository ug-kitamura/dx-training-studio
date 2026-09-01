import { describe, expect, it, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { AgentChatInput } from "@/components/workspace/AgentChatInput";

afterEach(cleanup);

function renderInput(
  skills: Parameters<typeof AgentChatInput>[0]["skills"],
  onEnsureSkills: () => void,
) {
  const noop = () => {};
  render(
    <AgentChatInput
      value=""
      onChange={noop}
      attachments={[]}
      onAttachmentsChange={noop}
      onSend={noop}
      skills={skills}
      onEnsureSkills={onEnsureSkills}
      activeSkillId={null}
      activeSkillName={null}
      onActiveSkillChange={noop}
      onLoadContentFiles={async () => []}
    />,
  );
}

describe("AgentChatInput のスキル再取得", () => {
  it("スラッシュ候補を開いたとき一覧が空なら再取得を要求する", () => {
    const ensure = vi.fn();
    renderInput([], ensure);
    const textarea = screen.getByPlaceholderText(
      "メッセージを入力（/ でスキル、@ でファイル参照）",
    );
    fireEvent.change(textarea, { target: { value: "/", selectionStart: 1 } });
    expect(ensure).toHaveBeenCalledTimes(1);
  });

  it("一覧があるときは再取得しない", () => {
    const ensure = vi.fn();
    renderInput(
      [{ id: "dx-training-create", name: "dx-training-create", description: "" }],
      ensure,
    );
    const textarea = screen.getByPlaceholderText(
      "メッセージを入力（/ でスキル、@ でファイル参照）",
    );
    fireEvent.change(textarea, { target: { value: "/", selectionStart: 1 } });
    expect(ensure).not.toHaveBeenCalled();
  });
});
