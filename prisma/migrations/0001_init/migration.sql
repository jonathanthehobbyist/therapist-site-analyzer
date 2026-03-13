-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    "loomUrl" TEXT,
    "overviewTitle" TEXT,
    "overviewSubtitle" TEXT,
    "seoSummary" TEXT,
    "keywordData" TEXT,
    "pageSpeedData" TEXT,
    "siteId" TEXT,

    CONSTRAINT "Analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Site_url_key" ON "Site"("url");

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
