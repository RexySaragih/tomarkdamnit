import { describe, expect, test } from "bun:test";
import { extractVideoId, formatTimestamp } from "../src/shared/youtube-url.ts";

describe("extractVideoId", () => {
  test("accepts bare video id", () => {
    expect(extractVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  test("parses watch URL", () => {
    expect(
      extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    ).toBe("dQw4w9WgXcQ");
  });

  test("parses youtu.be URL with query", () => {
    expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ?si=abc")).toBe(
      "dQw4w9WgXcQ"
    );
  });

  test("parses shorts, embed, live, and clip URLs", () => {
    expect(
      extractVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")
    ).toBe("dQw4w9WgXcQ");
    expect(
      extractVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")
    ).toBe("dQw4w9WgXcQ");
    expect(
      extractVideoId("https://www.youtube.com/live/dQw4w9WgXcQ")
    ).toBe("dQw4w9WgXcQ");
    expect(
      extractVideoId("https://www.youtube.com/clip/dQw4w9WgXcQ")
    ).toBe("dQw4w9WgXcQ");
  });

  test("parses nocookie and music hosts", () => {
    expect(
      extractVideoId("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")
    ).toBe("dQw4w9WgXcQ");
    expect(
      extractVideoId("https://music.youtube.com/watch?v=dQw4w9WgXcQ")
    ).toBe("dQw4w9WgXcQ");
  });

  test("rejects spoof hosts and invalid input", () => {
    expect(() => extractVideoId("nope")).toThrow(/Cannot extract/);
    expect(() =>
      extractVideoId("https://notyoutube.com/watch?v=dQw4w9WgXcQ")
    ).toThrow(/Cannot extract/);
    expect(() =>
      extractVideoId("https://example.com/watch?v=dQw4w9WgXcQ")
    ).toThrow(/Cannot extract/);
  });
});

describe("formatTimestamp", () => {
  test("formats mm:ss and h:mm:ss", () => {
    expect(formatTimestamp(65_000)).toBe("1:05");
    expect(formatTimestamp(3_661_000)).toBe("1:01:01");
  });
});
