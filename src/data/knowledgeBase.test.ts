import { describe, expect, it } from "vitest";
import {
  getKnowledgeArticle,
  KNOWLEDGE_ARTICLES,
  KNOWLEDGE_BASE_PATH,
} from "./knowledgeBase";

describe("knowledge base", () => {
  it("keeps the admin-only path and resolves known slugs", () => {
    expect(KNOWLEDGE_BASE_PATH).toBe("/knowledge");
    expect(getKnowledgeArticle("overview")?.title).toBe("What InkLex is");
    expect(getKnowledgeArticle("missing")).toBeNull();
    expect(KNOWLEDGE_ARTICLES.length).toBeGreaterThan(3);
  });
});
