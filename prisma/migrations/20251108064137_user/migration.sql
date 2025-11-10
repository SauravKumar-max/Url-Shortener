-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "api_key" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_url_shortener" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "original_url" TEXT NOT NULL,
    "short_code" TEXT NOT NULL,
    "visit_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_accessed_at" DATETIME,
    "deleted_at" DATETIME,
    "user_id" INTEGER,
    CONSTRAINT "url_shortener_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_url_shortener" ("created_at", "id", "last_accessed_at", "original_url", "short_code", "visit_count") SELECT "created_at", "id", "last_accessed_at", "original_url", "short_code", "visit_count" FROM "url_shortener";
DROP TABLE "url_shortener";
ALTER TABLE "new_url_shortener" RENAME TO "url_shortener";
CREATE UNIQUE INDEX "url_shortener_short_code_key" ON "url_shortener"("short_code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_api_key_key" ON "User"("api_key");
