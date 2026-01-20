import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity('ticket_priority')
export class TicketPriority {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 10 })
    name: string;
}
