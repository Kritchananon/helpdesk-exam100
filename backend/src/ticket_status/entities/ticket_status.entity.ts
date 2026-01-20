import { Ticket } from "../../ticket/entities/ticket.entity";
import { TicketStatusHistory } from "../../ticket_status_history/entities/ticket_status_history.entity";
import { TicketStatusLanguage } from "../../ticket_status_language/entities/ticket_status_language.entity";
import { Column, Entity, JoinColumn, OneToMany, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: 'ticket_status'})
export class TicketStatus {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    create_by: number;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP'})
    create_date: Date;

    @Column({ default: true })
    isenabled: boolean;

    @OneToMany(() => TicketStatusLanguage, language => language.status)
    language: TicketStatusLanguage[];

    @OneToMany(() => Ticket, ticket => ticket.status)
    ticket: Ticket[];

    @OneToMany(() => TicketStatusHistory, history => history.status)
    history: TicketStatusHistory[];
}
