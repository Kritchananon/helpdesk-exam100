import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToMany, JoinTable, ManyToOne } from "typeorm";
import { CustomerForProject } from "../../customer_for_project/entities/customer-for-project.entity";
import { MasterRole } from "../../master_role/entities/master_role.entity";
import { UserAllowRole } from "../../user_allow_role/entities/user_allow_role.entity";

@Entity({name: 'users'})
export class Users {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  email!: string;

  @Column({ unique: true})
  username!: string;

  @Column()
  password!: string;

  @Column()
  firstname!: string;

  @Column()
  lastname!: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  start_date?: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  end_date?: Date;

  @Column()
  phone!: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  create_date!: Date;

  @Column()
  create_by!: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  update_date!: Date;

  @Column()
  update_by!: number;

  @Column({ default: true})
  isenabled!: boolean;

  // users/entities/user.entity.ts (เพิ่ม relation)
  @OneToMany(() => CustomerForProject, customerProject => customerProject.users)
  customerProjects: CustomerForProject[];

  @ManyToMany(() => MasterRole, (role) => role.userAllowRole)
  @JoinTable({
    name: 'users_allow_role', // ชื่อ table กลาง
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' }
  })
  role: MasterRole[];

  @OneToMany(() => UserAllowRole, (uar) => uar.user)
  userAllowRoles: UserAllowRole[];

  
}
