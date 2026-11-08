Put numbered, forward-only SQL files here, for example `0001_create_boards.sql`.
No application schema is supplied by the infrastructure work.

Create a file: `npm run db:migration:create -- create_boards`
Apply locally: `npm run db:migrate:local`
List pending locally: `npm run db:migrations:list`

Wrangler tracks applied files in `d1_migrations`. Tests replay these same files
in filename order into a fresh SQLite database; they do not use Remix's separate
migration directory/journal format. Do not edit an already-applied migration.
