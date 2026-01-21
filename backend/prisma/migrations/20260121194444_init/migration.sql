-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('OPEN', 'CLOSED', 'FINISHED');

-- CreateEnum
CREATE TYPE "Round" AS ENUM ('OCTAVOS', 'CUARTOS', 'SEMI', 'FINAL');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "lastname" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "TournamentStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tournamentId" INTEGER NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" SERIAL NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    "round" "Round" NOT NULL,
    "player1Id" INTEGER NOT NULL,
    "player2Id" INTEGER NOT NULL,
    "winnerId" INTEGER,
    "score" TEXT,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_userId_tournamentId_key" ON "Registration"("userId", "tournamentId");

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
