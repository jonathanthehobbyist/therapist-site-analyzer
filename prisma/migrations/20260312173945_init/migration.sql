-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "siteUrl" TEXT NOT NULL,
    "competitorUrl" TEXT,
    "keyword" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
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

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Site_url_key" ON "Site"("url");
