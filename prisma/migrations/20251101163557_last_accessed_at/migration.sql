/*
  Warnings:

  - Added the required column `last_accessed_at` to the `url_shortener` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_url_shortener" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "original_url" TEXT NOT NULL,
    "short_code" TEXT NOT NULL,
    "visit_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_accessed_at" DATETIME
);
INSERT INTO "new_url_shortener" ("created_at", "id", "original_url", "short_code", "visit_count") SELECT "created_at", "id", "original_url", "short_code", "visit_count" FROM "url_shortener";
DROP TABLE "url_shortener";
ALTER TABLE "new_url_shortener" RENAME TO "url_shortener";
CREATE UNIQUE INDEX "url_shortener_short_code_key" ON "url_shortener"("short_code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
