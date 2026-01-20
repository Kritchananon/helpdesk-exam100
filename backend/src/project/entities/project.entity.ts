import { CustomerForProject } from "../../customer_for_project/entities/customer-for-project.entity";
import { Ticket } from "../../ticket/entities/ticket.entity";
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";

@Entity({ name: 'project'})
export class Project {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    name!: string;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    create_date!: Date;

    @Column()
    create_by!: number;

    @Column({ default: true })
    status: boolean;

    @Column({ default: true })
    isenabled!: boolean

    @OneToMany(() => CustomerForProject, customerProject => customerProject.project)
    customerProjects: CustomerForProject[];

    @OneToMany(() => Ticket, ticket => ticket.project)
    ticket: Ticket[];
}
