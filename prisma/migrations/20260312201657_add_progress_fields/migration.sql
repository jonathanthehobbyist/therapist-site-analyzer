-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Analysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "siteUrl" TEXT NOT NULL,
    "competitorUrl" TEXT,
    "keyword" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "progressLabel" TEXT,
    "seoComparisonScore" INTEGER,
    "seoHygieneScore" INTEGER,
    "hipaaRiskLevel" TEXT,
    "seoComparisonData" TEXT,
    "seoHygieneData" TEXT,
    "hipaaData" TEXT,
    "pagesScraped" TEXT,
    "error" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "siteId" TEXT,
    CONSTRAINT "Analysis_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Analysis" ("competitorUrl", "createdAt", "error", "hipaaData", "hipaaRiskLevel", "id", "isPublic", "keyword", "pagesScraped", "seoComparisonData", "seoComparisonScore", "seoHygieneData", "seoHygieneScore", "siteId", "siteUrl", "status") SELECT "competitorUrl", "createdAt", "error", "hipaaData", "hipaaRiskLevel", "id", "isPublic", "keyword", "pagesScraped", "seoComparisonData", "seoComparisonScore", "seoHygieneData", "seoHygieneScore", "siteId", "siteUrl", "status" FROM "Analysis";
DROP TABLE "Analysis";
ALTER TABLE "new_Analysis" RENAME TO "Analysis";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
