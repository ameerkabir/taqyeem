// Browser-safe validation limits shared by schemas and hydrated components.
export const MAX_CARD_TEXT_LENGTH = 500;
// Mirrored by the CHECK in database/migrations/0001_create_boards.sql; keep in sync.
export const MAX_BOARD_TITLE_LENGTH = 120;
// Mirrored by the CHECK in database/migrations/0002_create_members.sql; keep in sync.
export const MAX_MEMBER_NAME_LENGTH = 60;
// Mirrored by the CHECK in database/migrations/0003_create_categories.sql; keep in sync.
export const MAX_CATEGORY_LABEL_LENGTH = 120;
// Card submission rate limit: at most MAX_CARDS per member per board within WINDOW_MS.
export const MAX_CARDS = 5;
export const WINDOW_MS = 60_000;
