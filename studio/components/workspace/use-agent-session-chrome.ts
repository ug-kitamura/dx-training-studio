"use client";

import { useEffect, useState } from "react";
import type {
  AgentChatController,
  AgentSessionChrome,
} from "@/lib/agent-chat-controller";

export function useAgentSessionChrome(
  controllerRef: React.RefObject<AgentChatController | null>,
  controllerVersion: number,
) {
  const [chrome, setChrome] = useState<AgentSessionChrome | null>(null);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) {
      setChrome(null);
      return;
    }

    const update = () => {
      setChrome(controller.getSessionChrome());
    };

    update();
    return controller.subscribe(update);
  }, [controllerRef, controllerVersion]);

  return chrome;
}
