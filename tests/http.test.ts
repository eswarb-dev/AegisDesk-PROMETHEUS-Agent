import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/index.js";

describe("HTTP endpoints", () => {
  it("health endpoint returns ok", async () => {
    const response = await request(createApp()).get("/health").expect(200);

    expect(response.body).toEqual({ status: "ok", service: "prometheus-telegram-chatbot" });
  });
});
