import { Ticket } from '../../ticket/entities/ticket.entity';
import { TicketCategoryLanguage } from '../../ticket_categories_language/entities/ticket_categories_language.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany
} from 'typeorm';

@Entity('ticket_categories')
export class TicketCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  create_by: number;

  @CreateDateColumn()
  create_date: Date;

  @Column({ default: true })
  isenabled: boolean;

  @OneToMany(() => TicketCategoryLanguage, lang => lang.category)
  languages: TicketCategoryLanguage[];

  @OneToMany(() => Ticket, ticket => ticket.categories)
  ticket: Ticket;
}
