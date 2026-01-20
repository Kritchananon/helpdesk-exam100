import { Ticket } from "../../ticket/entities/ticket.entity";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: 'ticket_attachment'})
export class TicketAttachment {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    ticket_id: number;

    @Column({ length: 10})
    type: string;

    @Column({ length: 10})
    extension: string;

    @Column({ length: 10})
    filename: string;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP'})
    create_date: Date;

    @Column()
    create_by: number;

    @Column({ type: 'timestamp', nullable: true })
    deleted_at?: Date;

    @Column({ type: 'boolean', default: true})
    isenabled: boolean;

    @ManyToOne(() => Ticket, ticket => ticket.attachments, { onDelete: 'CASCADE'})
    @JoinColumn({ name: 'ticket_id' })
    ticket: Ticket;
}
