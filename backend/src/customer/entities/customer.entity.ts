import { PrimaryGeneratedColumn, Column, Entity, OneToMany } from "typeorm";
import { CustomerForProject } from "../../customer_for_project/entities/customer-for-project.entity";

@Entity({ name: 'customer'})
export class Customer {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    name!: string;

    @Column()
    address!: string;

    @Column()
    telephone!: string;

    @Column()
    email!: string;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP'})
    create_date?: Date;

    @Column()
    create_by!: number;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP'})
    update_date?: Date;
    
    @Column()
    update_by!: number;

    @Column({ default: true })
    status: boolean;

    @Column({ default: true })
    isenabled?: boolean;

    @OneToMany(() => CustomerForProject, customerForProject => customerForProject.customer)
    projects: CustomerForProject[];
}
