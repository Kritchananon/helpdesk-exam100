/**
 * Business Hours Calculator Service
 * ไฟล์: src/app/shared/services/business-hours-calculator.service.ts
 * 
 * คำนวณชั่วโมงทำงานตามกฎธุรกิจ:
 * - เวลาทำงาน: 08:30 - 17:30 (8 ชั่วโมง/วัน หลังหักพักเที่ยง)
 * - วันทำงาน: จันทร์-เสาร์ (เสาร์คู่เท่านั้น)
 * - หัก 1 ชั่วโมงพักเที่ยงทุกวัน
 * - ไม่นับวันหยุดนักขัตฤกษ์
 */

import { Injectable } from '@angular/core';

export interface BusinessHoursConfig {
  workStartTime: { hour: number; minute: number }; // 08:30
  workEndTime: { hour: number; minute: number };   // 17:30
  lunchBreakHours: number;                         // 1 ชั่วโมง
  workingDays: number[];                           // [1,2,3,4,5,6] = จันทร์-เสาร์
  evenSaturdaysOnly: boolean;                      // true = เสาร์คู่เท่านั้น
}

@Injectable({
  providedIn: 'root'
})
export class BusinessHoursCalculator {
  private config: BusinessHoursConfig = {
    workStartTime: { hour: 8, minute: 30 },
    workEndTime: { hour: 17, minute: 30 },
    lunchBreakHours: 1,
    workingDays: [1, 2, 3, 4, 5, 6], // Monday = 1, Saturday = 6
    evenSaturdaysOnly: true
  };

  // รายการวันหยุดนักขัตฤกษ์ (ควรดึงจาก API หรือ config file)
  private holidays: Date[] = [];

  constructor() {
    // ตั้งค่าวันหยุดเริ่มต้น
    this.initializeDefaultHolidays();
  }

  /**
   * ตั้งค่าวันหยุดนักขัตฤกษ์เริ่มต้น (ปี 2025)
   * ในการใช้งานจริง ควรดึงข้อมูลจาก API
   */
  private initializeDefaultHolidays(): void {
    const holidays2025 = [
      new Date('2025-01-01'), // วันขึ้นปีใหม่
      new Date('2025-02-12'), // วันมาฆบูชา
      new Date('2025-04-06'), // วันจักรี
      new Date('2025-04-13'), // วันสงกรานต์
      new Date('2025-04-14'), // วันสงกรานต์
      new Date('2025-04-15'), // วันสงกรานต์
      new Date('2025-05-01'), // วันแรงงาน
      new Date('2025-05-05'), // วันฉัตรมงคล
      new Date('2025-05-12'), // วันวิสาขบูชา
      new Date('2025-06-03'), // วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ
      new Date('2025-07-10'), // วันอาสาฬหบูชา
      new Date('2025-07-28'), // วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว
      new Date('2025-08-12'), // วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าสิริกิติ์ฯ
      new Date('2025-10-13'), // วันคล้ายวันสวรรคตพระบาทสมเด็จพระปรมินทรมหาภูมิพลอดุลยเดช
      new Date('2025-10-23'), // วันปิยมหาราช
      new Date('2025-12-05'), // วันพ่อแห่งชาติ
      new Date('2025-12-10'), // วันรัฐธรรมนูญ
      new Date('2025-12-31'), // วันสิ้นปี
    ];

    this.setHolidays(holidays2025);
  }

  /**
   * คำนวณ Estimate Time
   * จากเวลาที่ ticket เป็น status 2 (Open) ถึง Close Estimate
   * 
   * @param openTicketDate เวลาที่ ticket เป็น status 2 (Open Ticket)
   * @param closeEstimateDate เวลาที่คาดว่าจะแก้ไขเสร็จ
   * @returns จำนวนชั่วโมงทำงาน
   */
  calculateEstimateTime(openTicketDate: Date, closeEstimateDate: Date): number {
    return this.calculateBusinessHours(openTicketDate, closeEstimateDate);
  }

  /**
   * คำนวณ Lead Time
   * จากเวลาที่ ticket เป็น status 2 (Open) ถึง Due Date (วันจบจริง)
   * 
   * @param openTicketDate เวลาที่ ticket เป็น status 2 (Open Ticket)
   * @param dueDate เวลาที่จบงานจริง
   * @returns จำนวนชั่วโมงทำงาน
   */
  calculateLeadTime(openTicketDate: Date, dueDate: Date): number {
    return this.calculateBusinessHours(openTicketDate, dueDate);
  }

  /**
   * คำนวณชั่วโมงทำงานระหว่างสองเวลา
   * 
   * @param startDate วันเวลาเริ่มต้น
   * @param endDate วันเวลาสิ้นสุด
   * @returns จำนวนชั่วโมงทำงาน
   */
  private calculateBusinessHours(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // ถ้าเวลาสิ้นสุดมาก่อนเวลาเริ่มต้น ให้คืนค่า 0
    if (end <= start) {
      console.warn('End date is before or equal to start date:', {
        start: start.toISOString(),
        end: end.toISOString()
      });
      return 0;
    }

    let totalHours = 0;
    const currentDate = new Date(start);

    console.log('=== Starting Business Hours Calculation ===');
    console.log('From:', start.toISOString());
    console.log('To:', end.toISOString());

    // วนลูปทีละวัน
    while (this.isSameOrBefore(currentDate, end, 'day')) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // ตรวจสอบว่าเป็นวันทำงานหรือไม่
      if (this.isWorkingDay(currentDate)) {
        const dayStart = this.isSameDay(currentDate, start) ? start : this.getWorkStartTime(currentDate);
        const dayEnd = this.isSameDay(currentDate, end) ? end : this.getWorkEndTime(currentDate);

        // คำนวณชั่วโมงในวันนั้น
        const hoursInDay = this.calculateHoursInDay(dayStart, dayEnd);
        
        if (hoursInDay > 0) {
          console.log(`${dateStr}: ${hoursInDay.toFixed(2)} hours (Working Day)`);
          totalHours += hoursInDay;
        }
      } else {
        const reason = this.getNotWorkingDayReason(currentDate);
        console.log(`${dateStr}: 0 hours (${reason})`);
      }

      // เลื่อนไปวันถัดไป
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(0, 0, 0, 0);
    }

    const roundedHours = Math.round(totalHours * 100) / 100;
    console.log('=== Total Business Hours:', roundedHours, '===\n');

    return roundedHours;
  }

  /**
   * คำนวณชั่วโมงทำงานในหนึ่งวัน
   * 
   * @param dayStart เวลาเริ่มต้นของวัน
   * @param dayEnd เวลาสิ้นสุดของวัน
   * @returns จำนวนชั่วโมงทำงาน
   */
  private calculateHoursInDay(dayStart: Date, dayEnd: Date): number {
    const workStart = this.getWorkStartTime(dayStart);
    const workEnd = this.getWorkEndTime(dayStart);

    // ปรับเวลาให้อยู่ในช่วงทำงาน
    const effectiveStart = dayStart < workStart ? workStart : dayStart;
    const effectiveEnd = dayEnd > workEnd ? workEnd : dayEnd;

    // ถ้าเวลาสิ้นสุดมาก่อนหรือเท่ากับเวลาเริ่ม ไม่มีชั่วโมงทำงาน
    if (effectiveEnd <= effectiveStart) {
      return 0;
    }

    // คำนวณชั่วโมงทำงาน (หน่วยเป็นมิลลิวินาที)
    const milliseconds = effectiveEnd.getTime() - effectiveStart.getTime();
    let hours = milliseconds / (1000 * 60 * 60);

    // หักเวลาพักเที่ยง 1 ชั่วโมง
    // เงื่อนไข: ทำงานมากกว่า 4 ชั่วโมง ให้หักพักเที่ยง
    if (hours > 4) {
      hours -= this.config.lunchBreakHours;
      console.log(`  - Lunch break deducted: ${this.config.lunchBreakHours} hour`);
    }

    return Math.max(0, hours);
  }

  /**
   * ตรวจสอบว่าเป็นวันทำงานหรือไม่
   * 
   * @param date วันที่ต้องการตรวจสอบ
   * @returns true ถ้าเป็นวันทำงาน
   */
  private isWorkingDay(date: Date): boolean {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

    // ตรวจสอบวันอาทิตย์
    if (dayOfWeek === 0) {
      return false;
    }

    // ตรวจสอบเสาร์
    if (dayOfWeek === 6 && this.config.evenSaturdaysOnly) {
      // ตรวจสอบว่าเป็นเสาร์คู่หรือไม่
      if (!this.isEvenSaturday(date)) {
        return false;
      }
    }

    // ตรวจสอบวันหยุดนักขัตฤกษ์
    if (this.isHoliday(date)) {
      return false;
    }

    return true;
  }

  /**
   * ตรวจสอบว่าเป็นเสาร์คู่หรือไม่ (สัปดาห์ที่ 2, 4 ของเดือน)
   * 
   * @param date วันที่ต้องการตรวจสอบ
   * @returns true ถ้าเป็นเสาร์คู่
   */
  private isEvenSaturday(date: Date): boolean {
    if (date.getDay() !== 6) {
      return false;
    }

    // หาว่าเป็นเสาร์ที่เท่าไหร่ของเดือน
    const dayOfMonth = date.getDate();
    const weekOfMonth = Math.ceil(dayOfMonth / 7);

    // เสาร์คู่ = สัปดาห์ที่ 2, 4
    const isEven = weekOfMonth % 2 === 0;
    
    if (isEven) {
      console.log(`  ${date.toISOString().split('T')[0]} is Even Saturday (Week ${weekOfMonth})`);
    }

    return isEven;
  }

  /**
   * ตรวจสอบว่าเป็นวันหยุดนักขัตฤกษ์หรือไม่
   * 
   * @param date วันที่ต้องการตรวจสอบ
   * @returns true ถ้าเป็นวันหยุดนักขัตฤกษ์
   */
  private isHoliday(date: Date): boolean {
    const normalizedDate = this.normalizeDate(date);
    return this.holidays.some(holiday => 
      this.isSameDay(holiday, normalizedDate)
    );
  }

  /**
   * หาเหตุผลว่าทำไมไม่ใช่วันทำงาน
   */
  private getNotWorkingDayReason(date: Date): string {
    const dayOfWeek = date.getDay();
    
    if (dayOfWeek === 0) {
      return 'Sunday';
    }
    
    if (dayOfWeek === 6 && this.config.evenSaturdaysOnly && !this.isEvenSaturday(date)) {
      return 'Odd Saturday';
    }
    
    if (this.isHoliday(date)) {
      return 'Holiday';
    }
    
    return 'Non-working day';
  }

  /**
   * ตรวจสอบว่าเป็นวันเดียวกันหรือไม่
   */
  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  /**
   * ตรวจสอบว่า date1 อยู่ก่อนหรือเท่ากับ date2 หรือไม่
   */
  private isSameOrBefore(date1: Date, date2: Date, unit: 'day' | 'time'): boolean {
    if (unit === 'day') {
      const d1 = this.normalizeDate(date1);
      const d2 = this.normalizeDate(date2);
      return d1.getTime() <= d2.getTime();
    }
    return date1.getTime() <= date2.getTime();
  }

  /**
   * ทำให้วันที่เป็น midnight (00:00:00)
   */
  private normalizeDate(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  /**
   * ดึงเวลาเริ่มงานของวัน (08:30)
   */
  private getWorkStartTime(date: Date): Date {
    const workStart = new Date(date);
    workStart.setHours(
      this.config.workStartTime.hour,
      this.config.workStartTime.minute,
      0,
      0
    );
    return workStart;
  }

  /**
   * ดึงเวลาเลิกงานของวัน (17:30)
   */
  private getWorkEndTime(date: Date): Date {
    const workEnd = new Date(date);
    workEnd.setHours(
      this.config.workEndTime.hour,
      this.config.workEndTime.minute,
      0,
      0
    );
    return workEnd;
  }

  /**
   * เพิ่มวันหยุดนักขัตฤกษ์
   */
  addHoliday(date: Date): void {
    const normalized = this.normalizeDate(date);
    if (!this.holidays.some(h => this.isSameDay(h, normalized))) {
      this.holidays.push(normalized);
      console.log('Holiday added:', normalized.toISOString().split('T')[0]);
    }
  }

  /**
   * ลบวันหยุดนักขัตฤกษ์
   */
  removeHoliday(date: Date): void {
    const normalized = this.normalizeDate(date);
    const index = this.holidays.findIndex(h => this.isSameDay(h, normalized));
    if (index > -1) {
      this.holidays.splice(index, 1);
      console.log('Holiday removed:', normalized.toISOString().split('T')[0]);
    }
  }

  /**
   * ตั้งค่ารายการวันหยุดนักขัตฤกษ์
   */
  setHolidays(holidays: Date[]): void {
    this.holidays = holidays.map(d => this.normalizeDate(d));
    console.log(`Holidays set: ${this.holidays.length} days`);
  }

  /**
   * ดึงรายการวันหยุดนักขัตฤกษ์ปัจจุบัน
   */
  getHolidays(): Date[] {
    return [...this.holidays];
  }

  /**
   * ดึง Config ปัจจุบัน
   */
  getConfig(): BusinessHoursConfig {
    return { ...this.config };
  }

  /**
   * ตั้งค่า Config
   */
  setConfig(config: Partial<BusinessHoursConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('Business hours config updated:', this.config);
  }

  /**
   * รีเซ็ต Config เป็นค่าเริ่มต้น
   */
  resetConfig(): void {
    this.config = {
      workStartTime: { hour: 8, minute: 30 },
      workEndTime: { hour: 17, minute: 30 },
      lunchBreakHours: 1,
      workingDays: [1, 2, 3, 4, 5, 6],
      evenSaturdaysOnly: true
    };
    console.log('Business hours config reset to default');
  }

  /**
   * ตรวจสอบว่าวันที่ระบุเป็นวันทำงานหรือไม่ (Public method)
   */
  isWorkingDayPublic(date: Date): boolean {
    return this.isWorkingDay(date);
  }

  /**
   * แสดงข้อมูล Debug
   */
  debugInfo(): void {
    console.log('=== Business Hours Calculator Debug Info ===');
    console.log('Config:', this.config);
    console.log('Holidays:', this.holidays.map(d => d.toISOString().split('T')[0]));
    console.log('Total holidays:', this.holidays.length);
  }
}

// ===== ตัวอย่างการใช้งาน =====
/*
import { BusinessHoursCalculator } from './business-hours-calculator.service';

// ในคอนโพเนนต์
constructor(private businessHoursCalculator: BusinessHoursCalculator) {}

ngOnInit() {
  // ตั้งค่าวันหยุดเพิ่มเติม (ถ้าต้องการ)
  this.businessHoursCalculator.addHoliday(new Date('2025-11-15'));

  // คำนวณ Estimate Time
  const openDate = new Date('2025-10-01 10:00');
  const closeEstimate = new Date('2025-10-05 14:30');
  const estimateTime = this.businessHoursCalculator.calculateEstimateTime(
    openDate, 
    closeEstimate
  );
  console.log(`Estimate Time: ${estimateTime} hours`);

  // คำนวณ Lead Time
  const dueDate = new Date('2025-10-06 11:00');
  const leadTime = this.businessHoursCalculator.calculateLeadTime(
    openDate, 
    dueDate
  );
  console.log(`Lead Time: ${leadTime} hours`);

  // ตรวจสอบว่าเป็นวันทำงานหรือไม่
  const testDate = new Date('2025-10-04'); // เสาร์
  const isWorking = this.businessHoursCalculator.isWorkingDayPublic(testDate);
  console.log(`Is ${testDate.toDateString()} a working day? ${isWorking}`);

  // แสดงข้อมูล Debug
  this.businessHoursCalculator.debugInfo();
}
*/