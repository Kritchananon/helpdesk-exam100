import { Ticket } from "../../ticket/entities/ticket.entity";
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity('ticket_satisfaction')
export class Satisfaction {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    ticket_id: number;

    @Column()
    rating: number;

    @Column()
    create_by: number;

    @CreateDateColumn({ type: 'timestamp'})
    create_date: Date;

    @ManyToOne(() => Ticket, ticket => ticket.satisfaction)
    @JoinColumn({ name: 'ticket_id', referencedColumnName: 'id'})
    ticket: Ticket;
}
