import { 
    Column, 
    Entity, 
    PrimaryColumn, 
    PrimaryGeneratedColumn,
    ManyToOne,
    JoinColumn
 } from "typeorm";
 import { TicketStatus } from "../../ticket_status/entities/ticket_status.entity";

@Entity({ name: 'ticket_status_language'})
export class TicketStatusLanguage {
    @Column({ primary: true})
    status_id: number;

    @Column({ primary: true})
    language_id: string;

    @Column()
    name: string;

    @ManyToOne(() => TicketStatus, status => status.language)
    @JoinColumn({ name: 'ticket_id' })
    status: TicketStatus[];
}
