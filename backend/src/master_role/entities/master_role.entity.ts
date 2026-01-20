import { UserAllowRole } from "../../user_allow_role/entities/user_allow_role.entity";
import { Users } from "../../users/entities/user.entity";
import { Column, Entity, PrimaryGeneratedColumn, ManyToMany, OneToMany } from "typeorm";

@Entity('master_role')
export class MasterRole {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ nullable: true})
    role_name: string;

    @OneToMany(() => UserAllowRole, userRole => userRole.role)
    userRole: UserAllowRole[];

    @ManyToMany(() => Users, user => user.role)
    userAllowRole: Users[];
}
