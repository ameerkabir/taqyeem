import { column, table } from "remix/data-table";
import {
  MAX_BOARD_TITLE_LENGTH,
  MAX_CARD_TEXT_LENGTH,
  MAX_CATEGORY_LABEL_LENGTH,
  MAX_MEMBER_NAME_LENGTH,
} from "./limits.ts";

export let boards = table({
  name: "boards",
  columns: {
    id: column.uuid(),
    title: column.varchar(MAX_BOARD_TITLE_LENGTH),
    // `as const` keeps the literal union; without it enum() infers plain string.
    status: column.enum(["collecting", "meeting", "closed"] as const),
    // 0/1, not boolean(): our D1 driver turns boolean columns into true/false on read but
    // the SQLite test driver does not (checked in source), so integer reads the same in both.
    // The read model converts it to the app's boolean.
    voting_open: column.integer(),
    // A category id, or NULL until a meeting picks one.
    current_section_id: column.uuid().nullable(),
  },
});

export let members = table({
  name: "members",
  columns: {
    id: column.uuid(),
    board_id: column.uuid(),
    display_name: column.varchar(MAX_MEMBER_NAME_LENGTH),
    role: column.enum(["organiser", "participant"] as const),
  },
});

export let categories = table({
  name: "categories",
  columns: {
    id: column.uuid(),
    board_id: column.uuid(),
    label: column.varchar(MAX_CATEGORY_LABEL_LENGTH),
    position: column.integer(),
  },
});

export let cards = table({
  name: "cards",
  columns: {
    id: column.uuid(),
    board_id: column.uuid(),
    category_id: column.uuid(),
    member_id: column.uuid(),
    submission_id: column.uuid(),
    body: column.varchar(MAX_CARD_TEXT_LENGTH),
    // 0/1 for the same reason as boards.voting_open.
    is_anonymous: column.integer(),
    // Set by the database default; omit it when inserting.
    created_at: column.text(),
  },
});

export let votes = table({
  name: "votes",
  // No id column: one vote per (card, member).
  primaryKey: ["card_id", "member_id"],
  columns: {
    card_id: column.uuid(),
    member_id: column.uuid(),
    board_id: column.uuid(),
    created_at: column.text(),
  },
});
