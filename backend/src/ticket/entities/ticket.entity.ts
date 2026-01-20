import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToOne } from 'typeorm';
import { TicketAttachment } from '../../ticket_attachment/entities/ticket_attachment.entity';
import { TicketStatusHistory } from '../../ticket_status_history/entities/ticket_status_history.entity';
import { TicketCategory } from '../../ticket_categories/entities/ticket_category.entity';
import { Project } from '../../project/entities/project.entity';
import { TicketStatus } from '../../ticket_status/entities/ticket_status.entity';
import { Satisfaction } from '../../satisfaction/entities/satisfaction.entity';
import { Users } from '../../users/entities/user.entity';

@Entity('ticket')
export class Ticket {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  ticket_no: string;

  @Column({ type: 'int' })
  categories_id: number;

  @Column({ type: 'int' })
  project_id: number;

  @Column({ type: 'text' })
  issue_description: string;

  @Column({ type: 'text', nullable: true })
  fix_issue_description: string;

  @Column({ type: 'int', default: 1 })
  status_id: number;

  @Column({ type: 'timestamp', nullable: true })
  close_estimate: Date;

  @Column({ type: 'varchar', nullable: true })
  estimate_time: number;

  @Column({ type: 'timestamp', nullable: true })
  due_date: Date;

  @Column({ type: 'varchar', nullable: true })
  lead_time: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  related_ticket_id: string;

  @Column({ type: 'varchar', nullable: true })
  change_request: number;

  @CreateDateColumn({ type: 'timestamp' })
  create_date: Date;

  @Column({ type: 'int' })
  create_by: number;

  @UpdateDateColumn({ type: 'timestamp' })
  update_date: Date;

  @Column({ type: 'int' })
  update_by: number;

  @Column({ type: 'timestamp', nullable: true })
  deleted_at?: Date;

  @Column({ type: 'smallint', nullable:true})
  priority_id: number | null;

  @Column({ type: 'boolean', default: true })
  isenabled: boolean;

  @OneToMany(() => TicketAttachment, attachment => attachment.ticket, { cascade: true })
  attachments: TicketAttachment[];

  @OneToMany(() => TicketStatusHistory, history=> history.ticket)
  history: TicketStatusHistory[];

  @OneToOne(() => Satisfaction, satisfaction => satisfaction.ticket)
  satisfaction: Satisfaction;

  @ManyToOne(() => Project, project => project.ticket)
  @JoinColumn({ name: 'project_id' }) // ถ้ามี field นี้
  project: Project;

  @ManyToOne(() => TicketCategory, category => category.ticket)
  @JoinColumn({ name: 'categories_id'})
  categories: TicketCategory

  @ManyToOne(() => TicketStatus, status => status.ticket)
  @JoinColumn({ name: 'status_id'})
  status: TicketStatus;

  @ManyToOne(() => Users)
  @JoinColumn({ name: 'create_by'})
  user: Users;
}
