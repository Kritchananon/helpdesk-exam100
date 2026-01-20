import { TicketCategory } from '../../ticket_categories/entities/ticket_category.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn
} from 'typeorm';

@Entity('ticket_categories_language')
export class TicketCategoryLanguage {  
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ primary: true })
  category_id: number;
  
  @Column({ primary: true, length: 3 })
  language_id: string;

  @Column({ length: 255 })
  name: string;

  @ManyToOne(() => TicketCategory, category => category.languages)
  @JoinColumn({ name: 'category_id'})
  category: TicketCategory;
}
