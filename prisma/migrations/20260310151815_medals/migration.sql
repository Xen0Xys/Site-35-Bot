-- CreateEnum
CREATE TYPE "medals" AS ENUM ('CROSS_OF_TACTICAL_SUPREMACY');

-- CreateTable
CREATE TABLE "user_medals" (
    "user_id" BIGINT NOT NULL,
    "medal" "medals" NOT NULL,

    CONSTRAINT "user_medals_pkey" PRIMARY KEY ("user_id","medal")
);

-- AddForeignKey
ALTER TABLE "user_medals" ADD CONSTRAINT "user_medals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
