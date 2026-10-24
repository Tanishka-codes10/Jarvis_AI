import { describe, expect, it } from "vitest";
import { processCommand } from "@/lib/commands";

describe("processCommand", () => {
  it("opens YouTube", () => {
    expect(processCommand("Open YouTube.").action).toEqual({ type: "open", url: "https://www.youtube.com", label: "YouTube" });
  });
  it("searches google", () => {
    const r = processCommand("Search for Python tutorials");
    expect(r.action && r.action.type === "open" && r.action.url).toBe("https://www.google.com/search?q=python%20tutorials");
  });
  it("unknown commands get the polite reply", () => {
    expect(processCommand("flibber jabber").reply).toBe("I'm not sure I understood that command. Could you please repeat it?");
  });
  it("clear chat", () => {
    expect(processCommand("clear chat").action).toEqual({ type: "clear" });
  });
});
