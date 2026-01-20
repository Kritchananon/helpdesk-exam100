import { 
  Entity, 
  PrimaryGeneratedColumn,
  Column, 
  ManyToOne, 
  JoinColumn,
  } from 'typeorm';
import { Users } from '../../users/entities/user.entity';
import { Project } from '../../project/entities/project.entity';
import { Customer } from '../../customer/entities/customer.entity';

@Entity('customer_for_project')
export class CustomerForProject {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id'})
  userId!: number;

  @Column({ name: 'customer_id' })
  customerId!: number;

  @Column({ name: 'project_id' })
  projectId!: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  create_date!: Date;

  @Column()
  create_by!: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  update_date!: Date;

  @Column()
  update_by!: number;

  @Column({ default: true })
  isenabled!: boolean;

  // ่join table
 // เพิ่ม Relation ถ้าต้องการ
  @ManyToOne(() => Users)
  @JoinColumn({ name: 'user_id' })
  users: Users;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;
}
