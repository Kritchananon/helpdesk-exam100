import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePriority1763802003336 implements MigrationInterface {
    name = 'CreatePriority1763802003336'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users_allow_role" DROP CONSTRAINT "FK_2bf802bfb1c8689ac24d181e4ca"`);
        await queryRunner.query(`ALTER TABLE "users_allow_role" DROP CONSTRAINT "FK_668beb57a0e0ab6a979380af563"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2bf802bfb1c8689ac24d181e4c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_668beb57a0e0ab6a979380af56"`);

        await queryRunner.query(`
            CREATE TABLE "ticket_priority" (
                "id" SERIAL NOT NULL,
                "name" character varying(10) NOT NULL,
                CONSTRAINT "PK_33198c2a1727df734589a69790b" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`ALTER TABLE "ticket" ADD "priority_id" smallint`);

        await queryRunner.query(`CREATE INDEX "IDX_668beb57a0e0ab6a979380af56" ON "users_allow_role" ("user_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_2bf802bfb1c8689ac24d181e4c" ON "users_allow_role" ("role_id")`);

        await queryRunner.query(`ALTER TABLE "users_allow_role" ADD CONSTRAINT "FK_668beb57a0e0ab6a979380af563"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        await queryRunner.query(`ALTER TABLE "users_allow_role" ADD CONSTRAINT "FK_2bf802bfb1c8689ac24d181e4ca"
            FOREIGN KEY ("role_id") REFERENCES "master_role"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users_allow_role" DROP CONSTRAINT "FK_2bf802bfb1c8689ac24d181e4ca"`);
        await queryRunner.query(`ALTER TABLE "users_allow_role" DROP CONSTRAINT "FK_668beb57a0e0ab6a979380af563"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2bf802bfb1c8689ac24d181e4c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_668beb57a0e0ab6a979380af56"`);

        await queryRunner.query(`ALTER TABLE "ticket" DROP COLUMN "priority_id"`);
        await queryRunner.query(`DROP TABLE "ticket_priority"`);

        await queryRunner.query(`CREATE INDEX "IDX_668beb57a0e0ab6a979380af56" ON "users_allow_role" ("user_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_2bf802bfb1c8689ac24d181e4c" ON "users_allow_role" ("role_id")`);

        await queryRunner.query(`ALTER TABLE "users_allow_role" ADD CONSTRAINT "FK_668beb57a0e0ab6a979380af563"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        await queryRunner.query(`ALTER TABLE "users_allow_role" ADD CONSTRAINT "FK_2bf802bfb1c8689ac24d181e4ca"
            FOREIGN KEY ("role_id") REFERENCES "master_role"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }
}
