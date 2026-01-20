import { Ticket } from "../../ticket/entities/ticket.entity";
import { TicketStatus } from "../../ticket_status/entities/ticket_status.entity";
import { Users } from "../../users/entities/user.entity";
import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from "typeorm";

export enum NotificationType {
    NEW_TICKET = 'new_ticket',
    STATUS_CHANGE = 'status_change',
    ASSIGNMENT = 'assignment',
}

@Entity('ticket_notification')
export class Notification {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    ticket_no: string;

    @Column()
    user_id: number;

    @Column({ default: 1 })
    status_id: number;

    @Column({
        type: 'enum',
        enum: NotificationType
    })
    notification_type: NotificationType;

    @Column()
    title: string;

    @Column({ type: 'text', nullable: true })
    message: string;

    @Column({ default: false })
    is_read: boolean;

    @Column({ type: 'timestamp', nullable: true })
    read_at: Date;

    @Column({ default: false })
    email_sent: boolean;

    @Column({ type: 'timestamp', nullable: true })
    email_sent_at: Date;

    @CreateDateColumn()
    create_date: Date;

    @UpdateDateColumn()
    update_date: Date;

    @ManyToOne(() => Users, { eager: true })
    @JoinColumn({ name: 'user_id' })
    user: Users;

    @ManyToOne(() => Ticket, { eager: true })
    @JoinColumn({ name: 'ticket_no', referencedColumnName: 'ticket_no' })
    ticket: Ticket;

    @ManyToOne(() => TicketStatus, { eager: false, nullable: true })
    @JoinColumn({ name: 'status_id' })
    status: TicketStatus;
}
