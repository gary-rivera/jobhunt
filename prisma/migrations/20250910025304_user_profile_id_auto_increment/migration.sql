/*
  Warnings:

  - The primary key for the `user_profiles` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `user_profiles` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "public"."user_profiles" DROP CONSTRAINT "user_profiles_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");
