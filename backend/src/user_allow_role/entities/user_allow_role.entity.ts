import { Users } from "../../users/entities/user.entity";
import { MasterRole } from "../../master_role/entities/master_role.entity";
import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";

@Entity('users_allow_role')
export class UserAllowRole {
    @PrimaryColumn()
    user_id: number;

    @PrimaryColumn()
    role_id: number;

    @ManyToOne(() => Users, (user) => user.userAllowRoles, {
        onDelete: 'CASCADE'   // 👈 ลบ user แล้วลบ record ในตารางนี้ด้วย
    })
    @JoinColumn({ name: 'user_id'})
    user: Users;

    @ManyToOne(() => MasterRole, (role) => role.userAllowRole, {
        onDelete: 'CASCADE'   // 👈 ลบ role แล้วลบ record ในตารางนี้ด้วย
    })
    @JoinColumn({ name: 'role_id'})
    role: MasterRole;
}
