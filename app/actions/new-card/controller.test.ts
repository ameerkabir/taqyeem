import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { createRouter } from "remix/router";
import { render } from "remix/middleware/render";

import controller from "../controller.tsx";
import newCardController from "./controller.tsx";
import { routes } from "../../routes.ts";
import { board, type Card } from "../../data/fake-board.ts";
import type { BoardModels } from "../../models/boards.ts";
import { createFakeBoardModels } from "../../models/fake-boards.ts";
import {
  boardModelsContext,
  type loadBoardModels,
} from "../../middleware/models.ts";

// Each test gets its own writes; never mutate the shared demo fixtures.
function setup(
  overrides: Partial<BoardModels> = {},
  now: () => number = Date.now,
) {
  let saved: Card[] = [];
  let models: BoardModels = {
    ...createFakeBoardModels({ cards: saved, submissions: new Map() }, now),
    ...overrides,
  };
  let provideModels: ReturnType<typeof loadBoardModels> = (context, next) => {
    context.set(boardModelsContext, models, { property: "models" });
    return next();
  };
  let router = createRouter({ middleware: [render(), provideModels] });
  router.map(routes, controller);
  router.map(routes.newCard, newCardController);

  return {
    router,
    saved,
    submit(data = validForm(), enhanced = true) {
      return router.fetch(
        new Request(new URL(routes.newCard.action.href(), "http://localhost"), {
          method: "POST",
          headers: { Accept: enhanced ? "application/json" : "text/html" },
          body: data,
        }),
      );
    },
  };
}

function validForm() {
  let data = new FormData();
  data.set("text", "ملاحظة للفريق");
  data.set("categoryId", "ideas");
  data.set("submissionId", crypto.randomUUID());
  return data;
}

// Prove early guards skip later model work, rather than just returning a status.
async function mustNotRun(): Promise<never> {
  throw new Error("An earlier guard should have returned before this lookup");
}

describe("new card guards", () => {
  let cases: {
    name: string;
    overrides: Partial<BoardModels>;
    status: number;
    message: string;
  }[] = [
    {
      name: "missing board",
      overrides: { getBoard: async () => null, getViewerMemberId: mustNotRun },
      status: 404,
      message: "اللوحة غير موجودة",
    },
    {
      name: "closed board",
      overrides: {
        getBoard: async () => ({ ...board, status: "closed" }),
        getViewerMemberId: mustNotRun,
      },
      status: 403,
      message: "اللوحة مغلقة",
    },
    {
      name: "missing viewer membership",
      overrides: {
        getViewerMemberId: async () => null,
        listMembers: mustNotRun,
      },
      status: 403,
      message: "يرجى الانضمام إلى اللوحة",
    },
    {
      name: "viewer is not a member of this board",
      overrides: {
        getViewerMemberId: async () => "member-of-another-board",
        listCategories: mustNotRun,
      },
      status: 403,
      message: "العضو غير موجود في هذه اللوحة",
    },
  ];

  for (let testCase of cases) {
    it(`rejects ${testCase.name} without saving`, async () => {
      let app = setup(testCase.overrides);
      let response = await app.submit();
      assert.equal(response.status, testCase.status);
      assert.equal(
        ((await response.json()) as { error: string }).error,
        testCase.message,
      );
      assert.equal(app.saved.length, 0);
    });
  }

  let invalidFields: {
    name: string;
    field: string;
    value: string | Blob | null;
    message: string;
  }[] = [
    {
      name: "missing submission ID",
      field: "submissionId",
      value: null,
      message: "معرّف الإرسال غير صالح، يرجى فتح النموذج مجددًا",
    },
    {
      name: "malformed submission ID",
      field: "submissionId",
      value: "invalid",
      message: "معرّف الإرسال غير صالح، يرجى فتح النموذج مجددًا",
    },
    {
      name: "a file instead of a submission ID",
      field: "submissionId",
      value: new Blob(["id"]),
      message: "معرّف الإرسال غير صالح، يرجى فتح النموذج مجددًا",
    },
    {
      name: "missing text",
      field: "text",
      value: null,
      message: "يرجى كتابة ملاحظة",
    },
    {
      name: "empty text",
      field: "text",
      value: "",
      message: "يرجى كتابة ملاحظة",
    },
    {
      name: "whitespace-only text",
      field: "text",
      value: " \n\t ",
      message: "يرجى كتابة ملاحظة",
    },
    {
      name: "a file instead of text",
      field: "text",
      value: new Blob(["note"]),
      message: "يرجى كتابة ملاحظة",
    },
    {
      name: "text over 500 characters",
      field: "text",
      value: "س".repeat(501),
      message: "الحد الأقصى ٥٠٠ حرف",
    },
    {
      name: "missing category",
      field: "categoryId",
      value: null,
      message: "التصنيف غير صالح",
    },
    {
      name: "a file instead of a category",
      field: "categoryId",
      value: new Blob(["ideas"]),
      message: "التصنيف غير صالح",
    },
  ];

  for (let testCase of invalidFields) {
    it(`rejects ${testCase.name} before looking up categories`, async () => {
      let app = setup({ listCategories: mustNotRun });
      let data = validForm();
      if (testCase.value === null) data.delete(testCase.field);
      else if (typeof testCase.value === "string")
        data.set(testCase.field, testCase.value);
      else data.set(testCase.field, testCase.value);

      let response = await app.submit(data);
      assert.equal(response.status, 400);
      assert.equal(
        ((await response.json()) as { error: string }).error,
        testCase.message,
      );
      assert.equal(app.saved.length, 0);
    });
  }

  it("rejects a category outside the board without saving", async () => {
    let app = setup();
    let data = validForm();
    data.set("categoryId", "category-from-another-board");
    let response = await app.submit(data);
    assert.equal(response.status, 400);
    assert.equal(
      ((await response.json()) as { error: string }).error,
      "التصنيف غير صالح",
    );
    assert.equal(app.saved.length, 0);
  });

  it("accepts exactly 500 characters after trimming and redirects to that category", async () => {
    let app = setup();
    let data = validForm();
    data.set("text", `  ${"س".repeat(500)}  `);
    let response = await app.submit(data);
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("Location"), "/board?section=ideas");
    assert.equal(app.saved.length, 1);
    assert.equal(app.saved[0].body, "س".repeat(500));
    assert.equal(app.saved[0].categoryId, "ideas");
    assert.equal(app.saved[0].boardId, "demo");
  });

  it("renders submitted HTML as escaped card text on the board", async () => {
    let app = setup();
    let data = validForm();
    data.set("text", '<script>alert("note")</script>');
    let response = await app.submit(data);
    assert.equal(response.status, 303);
    let page = await app.router.fetch(
      new URL(response.headers.get("Location")!, "http://localhost"),
    );
    assert.equal(page.status, 200);
    let html = await page.text();
    assert.ok(html.includes("&lt;script&gt;"));
    assert.ok(!html.includes('<script>alert("note")</script>'));
  });
});

describe("new card idempotency", () => {
  it("renders a fresh submission ID on each form visit", async () => {
    let app = setup();
    let ids: string[] = [];
    for (let visit = 0; visit < 2; visit++) {
      let response = await app.router.fetch(
        new URL(routes.newCard.index.href(), "http://localhost"),
      );
      assert.equal(response.status, 200);
      let html = await response.text();
      let match = html.match(/name="submissionId"[^>]*value="([^"]+)"/);
      assert.ok(match);
      assert.match(match[1], /^[0-9a-f-]{36}$/);
      ids.push(match[1]);
    }
    assert.ok(ids[0] !== ids[1]);
    assert.equal(app.saved.length, 0);
  });

  it("saves once for repeated POSTs and keeps the original content and redirect", async () => {
    let app = setup();
    let data = validForm();
    let first = await app.submit(data);
    let originalId = app.saved[0].id;
    data.set("categoryId", "good");
    data.set("text", "محتوى مختلف");
    data.set("isAnonymous", "true");
    let retry = await app.submit(data);

    assert.equal(first.status, 303);
    assert.equal(retry.status, 303);
    assert.equal(retry.headers.get("Location"), "/board?section=ideas");
    assert.equal(app.saved.length, 1);
    assert.equal(app.saved[0].id, originalId);
    assert.equal(app.saved[0].body, "ملاحظة للفريق");
    assert.equal(app.saved[0].isAnonymous, false);
  });

  it("saves once when matching POSTs arrive concurrently", async () => {
    let app = setup();
    let submissionId = crypto.randomUUID();
    let responses = await Promise.all(
      Array.from({ length: 5 }, () => {
        let data = validForm();
        data.set("submissionId", submissionId);
        return app.submit(data);
      }),
    );
    for (let response of responses) {
      assert.equal(response.status, 303);
      assert.equal(response.headers.get("Location"), "/board?section=ideas");
    }
    assert.equal(app.saved.length, 1);
  });

  it("creates separate cards for separate submission IDs, even with identical text", async () => {
    let app = setup();
    assert.equal((await app.submit()).status, 303);
    assert.equal((await app.submit()).status, 303);
    assert.equal(app.saved.length, 2);
    assert.ok(app.saved[0].id !== app.saved[1].id);
  });

  it("does not consume the submission ID when validation fails", async () => {
    let app = setup();
    let data = validForm();
    data.set("text", "");
    assert.equal((await app.submit(data)).status, 400);
    data.set("text", "ملاحظة مصححة");
    assert.equal((await app.submit(data)).status, 303);
    assert.equal(app.saved.length, 1);
    assert.equal(app.saved[0].body, "ملاحظة مصححة");
  });
});

describe("new card rate limit", () => {
  function seedCard(
    createdAt: number,
    memberId = "m1",
    boardId = "demo",
  ): Card {
    return {
      id: crypto.randomUUID(),
      boardId,
      memberId,
      categoryId: "ideas",
      body: "ملاحظة سابقة",
      isAnonymous: false,
      voteCount: 0,
      createdAt: new Date(createdAt).toISOString(),
    };
  }

  it("allows five new cards and rejects the sixth without saving it", async () => {
    let app = setup();
    for (let count = 0; count < 5; count++) {
      assert.equal((await app.submit()).status, 303);
    }
    let response = await app.submit();
    assert.equal(response.status, 429);
    assert.equal(
      ((await response.json()) as { error: string }).error,
      "لقد نشرت ملاحظات كثيرة، يرجى الانتظار قليلًا",
    );
    let retryAfter = Number(response.headers.get("Retry-After"));
    assert.ok(retryAfter >= 1 && retryAfter <= 60);
    assert.equal(response.headers.get("Location"), null);
    assert.equal(app.saved.length, 5);
  });

  it("accepts retries at the limit without consuming another allowance", async () => {
    let app = setup();
    let original = validForm();
    assert.equal((await app.submit(original)).status, 303);
    assert.equal((await app.submit(original)).status, 303);
    for (let count = 0; count < 4; count++) {
      assert.equal((await app.submit()).status, 303);
    }
    assert.equal((await app.submit(original)).status, 303);
    assert.equal(app.saved.length, 5);
    assert.equal((await app.submit()).status, 429);
  });

  it("allows a rejected submission to succeed when the oldest card leaves the window", async () => {
    let time = Date.now();
    let app = setup({}, () => time);
    // Only the oldest card expires after one second.
    app.saved.push(seedCard(time - 59_000));
    app.saved.push(...Array.from({ length: 4 }, () => seedCard(time - 10_000)));
    let data = validForm();
    let rejected = await app.submit(data);
    assert.equal(rejected.status, 429);
    assert.equal(rejected.headers.get("Retry-After"), "1");
    assert.equal(app.saved.length, 5);

    time += 1000;
    assert.equal((await app.submit(data)).status, 303);
    assert.equal(app.saved.length, 6);
    // The four newer cards plus the just-saved card still occupy the allowance.
    assert.equal((await app.submit()).status, 429);
  });

  for (let scope of ["member", "board"] as const) {
    it(`does not count cards belonging to another ${scope}`, async () => {
      let time = Date.now();
      let app = setup({}, () => time);
      app.saved.push(
        ...Array.from({ length: 5 }, () =>
          seedCard(
            time,
            scope === "member" ? "m2" : "m1",
            scope === "board" ? "another-board" : "demo",
          ),
        ),
      );
      assert.equal((await app.submit()).status, 303);
      assert.equal(app.saved.length, 6);
    });
  }

  it("does not count expired cards", async () => {
    let time = Date.now();
    let app = setup({}, () => time);
    app.saved.push(...Array.from({ length: 5 }, () => seedCard(time - 60_000)));
    assert.equal((await app.submit()).status, 303);
    assert.equal(app.saved.length, 6);
  });

  it("does not consume allowance for invalid submissions", async () => {
    let app = setup();
    for (let count = 0; count < 6; count++) {
      let data = validForm();
      data.set("text", "");
      assert.equal((await app.submit(data)).status, 400);
    }
    for (let count = 0; count < 5; count++) {
      assert.equal((await app.submit()).status, 303);
    }
    assert.equal(app.saved.length, 5);
    assert.equal((await app.submit()).status, 429);
  });

  it("enforces the limit when distinct submissions arrive concurrently", async () => {
    let app = setup();
    let responses = await Promise.all(
      Array.from({ length: 8 }, () => app.submit()),
    );
    assert.equal(
      responses.filter((response) => response.status === 303).length,
      5,
    );
    assert.equal(
      responses.filter((response) => response.status === 429).length,
      3,
    );
    assert.equal(app.saved.length, 5);
  });
});

describe("new card error feedback without JavaScript", () => {
  it("renders the rate-limit error and preserves every draft field", async () => {
    let app = setup();
    for (let count = 0; count < 5; count++) {
      assert.equal((await app.submit()).status, 303);
    }
    let data = validForm();
    data.set("text", "مسودة <script>ليست HTML</script>");
    data.set("categoryId", "bad");
    data.set("isAnonymous", "true");
    let response = await app.submit(data, false);
    assert.equal(response.status, 429);
    assert.ok(response.headers.get("Retry-After"));
    assert.match(response.headers.get("Content-Type") ?? "", /text\/html/);
    let html = await response.text();
    assert.match(html, /role="alert"/);
    assert.ok(html.includes("لقد نشرت ملاحظات كثيرة، يرجى الانتظار قليلًا"));
    assert.ok(html.includes("مسودة &lt;script&gt;"));
    assert.ok(!html.includes("<script>ليست HTML</script>"));
    assert.ok(html.includes(String(data.get("submissionId"))));
    assert.match(html, /value="bad"[^>]*checked/);
    assert.match(html, /name="isAnonymous"[^>]*checked/);
    assert.equal(app.saved.length, 5);
  });

  it("renders validation errors with the submitted text and a usable form", async () => {
    let app = setup();
    let data = validForm();
    data.set("text", "س".repeat(501));
    let response = await app.submit(data, false);
    assert.equal(response.status, 400);
    let html = await response.text();
    assert.ok(html.includes("الحد الأقصى ٥٠٠ حرف"));
    assert.ok(html.includes("س".repeat(501)));
    assert.match(html, /<form[^>]*method="post"/);
    assert.match(html, /role="alert"/);
    assert.equal(app.saved.length, 0);
  });

  it("replaces an invalid submission ID so the native form can be retried", async () => {
    let app = setup();
    let data = validForm();
    data.set("submissionId", "bad-id");
    let response = await app.submit(data, false);
    assert.equal(response.status, 400);
    let html = await response.text();
    let match = html.match(/name="submissionId"[^>]*value="([^"]+)"/);
    assert.ok(match);
    assert.match(match[1], /^[0-9a-f-]{36}$/);
    assert.ok(html.includes("معرّف الإرسال غير صالح"));
    data.set("submissionId", match[1]);
    assert.equal((await app.submit(data, false)).status, 303);
    assert.equal(app.saved.length, 1);
  });
});

describe("new card anonymity", () => {
  for (let isAnonymous of [false, true]) {
    it(`saves isAnonymous=${isAnonymous} from the checkbox submission`, async () => {
      let app = setup();
      let data = validForm();
      if (isAnonymous) data.set("isAnonymous", "true");
      let response = await app.submit(data);
      assert.equal(response.status, 303);
      assert.equal(app.saved.length, 1);
      assert.equal(app.saved[0].isAnonymous, isAnonymous);
      assert.equal(app.saved[0].memberId, "m1");
    });
  }
});
