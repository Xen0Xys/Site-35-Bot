-- CreateEnum
CREATE TYPE "units" AS ENUM ('XI_8', 'ALPHA_1');

-- CreateEnum
CREATE TYPE "ranks" AS ENUM ('CMD', 'MJR', 'CPT', 'LTN', 'S_LTN', 'ADJ_C', 'ADJ', 'SGT_C', 'SGT', 'CPL_C', 'CPL', 'SDT_1C', 'SDT_2C', 'SDT_3C', 'SDT', 'CDT');

-- CreateEnum
CREATE TYPE "trainings" AS ENUM ('FIM', 'CQC', 'FIRST_AID', 'BREACHER', 'GRENADE_LAUNCHER', 'FLAMETHROWER', 'ANTI_TANK', 'ARTIFICIER', 'SNIPER', 'MACHINE_GUNNER', 'MEDIC');

-- CreateTable
CREATE TABLE "users" (
    "id" BIGINT NOT NULL,
    "rank" "ranks" NOT NULL,
    "name" TEXT NOT NULL,
    "unit" "units",

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_trainings" (
    "user_id" BIGINT NOT NULL,
    "training" "trainings" NOT NULL,

    CONSTRAINT "user_trainings_pkey" PRIMARY KEY ("user_id","training")
);

-- AddForeignKey
ALTER TABLE "user_trainings" ADD CONSTRAINT "user_trainings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
