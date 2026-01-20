import { Ticket } from "../../ticket/entities/ticket.entity";
import { TicketStatus } from "../../ticket_status/entities/ticket_status.entity";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: 'ticket_status_history'})
export class TicketStatusHistory {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    ticket_id: number;

    @Column()
    status_id: number;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP'})
    create_date: Date;

    @Column()
    create_by: number;

    @ManyToOne(() => Ticket, ticket => ticket.history)
    @JoinColumn({ name : 'ticket_id' })
    ticket: Ticket;

    @ManyToOne(() => TicketStatus, status => status.history)
    @JoinColumn({ name: 'status_id'})
    status: TicketStatus;
}

