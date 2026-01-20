// src/app/pages/dashboard/dashboard.component.ts

import { Component, OnInit, inject, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../shared/services/api.service';
import { AuthService } from '../../shared/services/auth.service';
import { DashboardService } from '../../shared/services/dashboard.service';
import { LanguageService } from '../../shared/services/language.service'; // ✅ เพิ่ม
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';
import {
  DashboardStatsResponse,
  CategoryStatsDTO,
  createInitialDashboardData,
  DashboardData,
} from '../../shared/models/common.model';

// Register Chart.js components
Chart.register(...registerables);

interface TicketSummary {
  id: number;
  createdAt: string;
  completedAt: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private dashboardService = inject(DashboardService);
  private languageService = inject(LanguageService); // ✅ เพิ่ม
  private router = inject(Router);
  private subscriptions = new Subscription();

  // ✅ เพิ่ม current language state
  currentLanguage: 'th' | 'en' = 'th';

  // Chart References
  @ViewChild('monthlyChart', { static: false }) monthlyChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('monthlybarChart', { static: false }) monthlybarChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('categoryChart', { static: false }) categoryChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pieChart', { static: false }) pieChartRef!: ElementRef<HTMLCanvasElement>;

  // Dashboard data state
  dashboardData = {
    loading: false,
    stats: null as any,
    categoryStats: null as CategoryStatsDTO[] | null,
    error: null as string | null,
    lastUpdated: null as Date | null
  };

  currentUser: any;

  // Chart instances
  private monthlyChart: Chart | null = null;
  private monthlybarChart: Chart | null = null;
  private categoryChart: Chart | null = null;
  private pieChart: Chart | null = null;

  // Filter states
  selectedMonth = 'June';
  selectedYear = '2025';
  selectedBarMonth = 'June';
  selectedBarYear = '2025';
  selectedCategoryYear = '2025';

  // Legacy data for projects
  customerForProjects: any[] = [];
  loadingCustomers = false;

  // Tickets data for bar chart
  newTickets: any[] = [];
  completedTickets: any[] = [];

  // Getters for convenience
  get dashboardStats(): any {
    return this.dashboardData.stats;
  }

  get categoryStats(): CategoryStatsDTO[] {
    return this.dashboardData.categoryStats || [];
  }

  get isLoading(): boolean {
    return this.dashboardData.loading;
  }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    console.log('Dashboard initialized, current user:', this.currentUser);

    // ✅ รอให้ language service โหลด translations เสร็จก่อน
    this.setupLanguageService();

    // ✅ รอสักครู่ให้ translations โหลดเสร็จ
    setTimeout(() => {
      this.loadDashboardData();
    }, 100);
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initializeAllCharts();
      if (this.dashboardData.stats) {
        this.loadMonthlyTicketsForBar();
      }
    }, 10);
  }

  // ===== LANGUAGE SERVICE SETUP ===== ✅

  private setupLanguageService(): void {
    // Subscribe to language changes
    const langSub = this.languageService.currentLanguage$.subscribe(lang => {
      this.currentLanguage = lang;
      console.log('🌐 Language changed in dashboard:', lang);

      // อัพเดท charts เมื่อเปลี่ยนภาษา
      this.updateAllChartsLanguage();
    });

    this.subscriptions.add(langSub);
  }

  /**
   * ✅ อัพเดทภาษาของ charts ทั้งหมด
   */
  private updateAllChartsLanguage(): void {
    console.log('Updating all charts language to:', this.currentLanguage);

    // อัพเดทแต่ละ chart ตามภาษาใหม่
    if (this.monthlyChart) {
      this.updateChartLabelsLanguage(this.monthlyChart);
    }
    if (this.monthlybarChart) {
      this.updateChartLabelsLanguage(this.monthlybarChart);
    }
    if (this.categoryChart) {
      this.updateChartLabelsLanguage(this.categoryChart);
    }
    if (this.pieChart) {
      this.updateChartLabelsLanguage(this.pieChart);
    }
  }

  /**
   * ✅ อัพเดทภาษาของ chart labels
   */
  private updateChartLabelsLanguage(chart: Chart): void {
    // อัพเดท axis titles และ labels ตามภาษา
    if (chart.options?.scales) {
      // ✅ ใช้ bracket notation แทน dot notation
      const xScale = chart.options.scales['x'];
      const yScale = chart.options.scales['y'];

      if (xScale && (xScale as any).title) {
        (xScale as any).title.text = this.translate('dashboard.dayLabel');
      }
      if (yScale && (yScale as any).title) {
        (yScale as any).title.text = this.translate('dashboard.ticketCountLabel');
      }
    }

    // อัพเดท dataset labels
    if (chart.data.datasets) {
      chart.data.datasets.forEach((dataset) => {
        if (dataset.label === 'New Tickets' || dataset.label?.includes('ใหม่')) {
          dataset.label = this.translate('dashboard.newTickets');
        } else if (dataset.label === 'Completed' || dataset.label?.includes('เสร็จ')) {
          dataset.label = this.translate('dashboard.completed');
        }
      });
    }

    chart.update('none'); // อัพเดทโดยไม่มี animation
  }

  // ===== TRANSLATION METHODS ===== ✅

  /**
   * ✅ แปลภาษาจาก translation key
   */
  translate(key: string, params?: { [key: string]: any }): string {
    return this.languageService.translate(key, params);
  }

  /**
   * ✅ ดึงข้อความตามภาษาปัจจุบัน
   */
  getText(thText: string, enText: string): string {
    return this.languageService.getText(thText, enText);
  }

  /**
   * ✅ ดึงชื่อเดือนตามภาษา
   */
  getMonthName(monthIndex: number): string {
    const monthNames = {
      th: ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'],
      en: ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December']
    };

    const lang = this.currentLanguage;
    return monthNames[lang][monthIndex - 1] || '';
  }

  /**
   * ✅ ดึงชื่อเดือนแบบสั้นตามภาษา (สำหรับ chart labels)
   */
  getMonthShortName(monthIndex: number): string {
    const monthShortNames = {
      th: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
      en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    };

    const lang = this.currentLanguage;
    return monthShortNames[lang][monthIndex - 1] || '';
  }

  /**
   * ✅ ดึงชื่อสถานะตามภาษา
   */
  getStatusName(statusId: number): string {
    const statusMap: { [key: number]: string } = {
      1: this.translate('tickets.pending'),
      2: this.translate('tickets.inProgress'),
      3: this.translate('tickets.hold'),
      4: this.translate('tickets.resolved'),
      5: this.translate('tickets.complete'),
      6: this.translate('tickets.cancel')
    };
    return statusMap[statusId] || this.translate('common.unknown');
  }

  // =============================================================================
  // DATA LOADING METHODS
  // =============================================================================

  loadDashboardData(): void {
    console.log('Loading dashboard data...');

    this.dashboardData.loading = true;
    this.dashboardData.error = null;

    this.loadDashboardStats();
    this.loadCategoryBreakdown();
    // this.loadCustomerForProjects(); // ❌ FIXED: ปิดการเรียก API ที่ทำให้เกิด 404
  }

  loadDashboardStats(): void {
    console.log('Loading dashboard stats from API...');

    const sub = this.dashboardService.getDashboardStats().subscribe({
      next: (response) => {
        console.log('Dashboard stats response:', response);

        if (response.status === 1 && response.code === '1') {
          this.dashboardData.stats = response.data;
          this.dashboardData.error = null;
          this.dashboardData.lastUpdated = new Date();
          console.log('Dashboard stats updated successfully:', this.dashboardData.stats);

          this.updateAllChartsWithNewData();
          this.loadMonthlyTicketsForBar();
        } else {
          console.warn('Invalid API response:', response);
          this.dashboardData.error = this.translate('errors.cannotLoadData');
        }

        this.dashboardData.loading = false;
      },
      error: (error) => {
        console.error('Error loading dashboard stats:', error);
        this.dashboardData.loading = false;
        this.dashboardData.error = this.translate('errors.connectionError');

        this.dashboardData.stats = {
          total: 0,
          new: { count: 0, tickets: [] },
          inProgress: { count: 0, tickets: [] },
          complete: { count: 0, tickets: [] }
        } as any;
      }
    });

    this.subscriptions.add(sub);
  }

  loadCategoryBreakdown(): void {
    console.log('Loading category breakdown from API...');

    const currentYear = parseInt(this.selectedCategoryYear);
    const currentMonth = this.getMonthNumber(this.selectedMonth);
    const userId = this.currentUser?.id;

    const sub = this.dashboardService.getCategoryBreakdown(currentYear, currentMonth, userId).subscribe({
      next: (response) => {
        console.log('Category breakdown loaded:', response);

        const data = Array.isArray(response) ? response : response.data;

        if (!data || data.length === 0) {
          console.warn('ไม่มีข้อมูลหมวดหมู่จาก API');
          return;
        }

        // Pie chart
        const labels = data.map(item => item.category);
        const counts = data.map(item => item.count);
        const colors = data.map(item => item.color);

        if (this.pieChart) this.pieChart.destroy();
        const piectx = document.getElementById('pieChart') as HTMLCanvasElement;
        this.pieChart = new Chart(piectx, {
          type: 'doughnut',
          data: { labels, datasets: [{ data: counts, backgroundColor: colors }] },
          options: {
            responsive: true,
            plugins: {
              legend: { position: 'bottom' },
              tooltip: {
                callbacks: {
                  label: (tooltipItem) => {
                    const item = data[tooltipItem.dataIndex];
                    return `${item.category}: ${item.count} (${item.percentage}%)`;
                  }
                }
              }
            }
          }
        });

        // Line chart
        if (this.categoryChart) this.categoryChart.destroy();
        const categoryCtx = document.getElementById('categoryChart') as HTMLCanvasElement;

        const datasets = data.map((item) => ({
          label: item.category,
          data: item.monthlyCounts,
          borderColor: item.color,
          backgroundColor: item.color + '33',
          fill: true,
          tension: 0.4
        }));

        // ✅ ใช้ชื่อเดือนแบบสั้นตามภาษา
        const monthLabels = Array.from({ length: 12 }, (_, i) => this.getMonthShortName(i + 1));

        this.categoryChart = new Chart(categoryCtx, {
          type: 'line',
          data: {
            labels: monthLabels,
            datasets
          },
          options: {
            responsive: true,
            plugins: {
              legend: { position: 'bottom' },
              tooltip: { mode: 'index', intersect: false }
            },
            interaction: { mode: 'nearest', intersect: false },
            scales: {
              y: { beginAtZero: true },
              x: { ticks: { autoSkip: false } }
            }
          }
        });

      },
      error: (err) => {
        console.error('Error loading category breakdown:', err);
      }
    });

    this.subscriptions.add(sub);
  }

  loadCustomerForProjects(): void {
    this.loadingCustomers = true;
    // console.log('Loading customer for projects...');

    const sub = this.apiService.getCustomerForProject().subscribe({
      next: (response) => {
        console.log('Customer for projects response:', response);
        if (response.code === '2' || response.status === 1) {
          this.customerForProjects = response.data || [];
        }
        this.loadingCustomers = false;
      },
      error: (error) => {
        // ✅ FIXED: เปลี่ยน Error เป็น Warn เพื่อจัดการ 404 อย่างนุ่มนวล
        console.warn('⚠️ Legacy API (customer-for-project) not found. Skipping.');
        this.loadingCustomers = false;
        this.customerForProjects = [];
      }
    });

    this.subscriptions.add(sub);
  }

  // =============================================================================
  // CHART INITIALIZATION METHODS
  // =============================================================================

  initializeAllCharts(): void {
    this.initializeMonthlylineChart();
    this.initializeMonthlybarChart();
    this.initializeCategoryChart();
    this.initializePieChart();
  }

  private initializeMonthlylineChart(): void {
    if (!this.monthlyChartRef?.nativeElement) return;

    const ctx = this.monthlyChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.monthlyChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: this.translate('dashboard.newTickets'),
            data: [],
            borderColor: '#FFC107',
            backgroundColor: 'rgba(255, 193, 7, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointBackgroundColor: '#FFC107',
            pointBorderColor: '#FFC107',
            pointHoverBackgroundColor: '#FFC107',
            pointHoverBorderColor: '#FFC107'
          },
          {
            label: this.translate('dashboard.completed'),
            data: [],
            borderColor: '#28A745',
            backgroundColor: 'rgba(40, 167, 69, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointBackgroundColor: '#28A745',
            pointBorderColor: '#28A745',
            pointHoverBackgroundColor: '#28A745',
            pointHoverBorderColor: '#28A745'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              boxWidth: 12,
              usePointStyle: true,
              padding: 20,
              font: { size: 12 }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: '#ddd',
            borderWidth: 1,
            callbacks: {
              title: (tooltipItems) => {
                const day = tooltipItems[0].label;
                const monthName = this.getMonthName(this.getMonthNumber(this.selectedMonth));
                return `${this.translate('dashboard.day')} ${day} ${monthName} ${this.selectedYear}`;
              },
              label: (context) => {
                const label = context.dataset.label || '';
                const value = context.parsed.y || 0;
                return `${label}: ${this.formatNumber(value)} ${this.translate('dashboard.tickets')}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              maxTicksLimit: 15,
              font: { size: 11 }
            },
            title: {
              display: true,
              text: this.translate('dashboard.dayLabel'),
              font: { size: 12, weight: 'bold' }
            }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: {
              stepSize: 1,
              font: { size: 11 }
            },
            title: {
              display: true,
              text: this.translate('dashboard.ticketCountLabel'),
              font: { size: 12, weight: 'bold' }
            }
          }
        },
        elements: {
          point: {
            radius: 3,
            hoverRadius: 6
          }
        }
      }
    });

    console.log('Monthly chart initialized');
  }

  private loadMonthlyTicketsForBar(): void {
    const year = parseInt(this.selectedBarYear);
    const month = this.getMonthNumber(this.selectedBarMonth);

    console.log('กำลังโหลดข้อมูลทิคเก็ตรายเดือนสำหรับ bar chart:', this.selectedBarMonth, year);

    if (this.dashboardData.stats) {
      console.log('ใช้ข้อมูล dashboard stats ที่มีอยู่แล้วสำหรับ bar chart');

      this.newTickets = [];
      this.completedTickets = [];

      if (this.dashboardData.stats.new?.tickets) {
        this.newTickets.push(...this.dashboardData.stats.new.tickets);
      }
      if (this.dashboardData.stats.inProgress?.tickets) {
        this.newTickets.push(...this.dashboardData.stats.inProgress.tickets);
      }
      if (this.dashboardData.stats.complete?.tickets) {
        this.newTickets.push(...this.dashboardData.stats.complete.tickets);
      }

      if (this.dashboardData.stats.complete?.tickets) {
        this.completedTickets = this.dashboardData.stats.complete.tickets;
      }

      console.log('Bar chart - จำนวนทิคเก็ตใหม่:', this.newTickets.length);
      console.log('Bar chart - จำนวนทิคเก็ตที่เสร็จแล้ว:', this.completedTickets.length);

      this.updateMonthlybarChart();
    } else {
      this.dashboardService.getMonthlyTicketStats(year, month).subscribe({
        next: (res) => {
          console.log('ผลตอบกลับจาก API สำหรับ bar chart:', res);

          this.newTickets = [];
          this.completedTickets = [];

          if (res.data?.new?.tickets) {
            this.newTickets.push(...res.data.new.tickets);
          }
          if (res.data?.inProgress?.tickets) {
            this.newTickets.push(...res.data.inProgress.tickets);
          }
          if (res.data?.complete?.tickets) {
            this.newTickets.push(...res.data.complete.tickets);
          }

          if (res.data?.complete?.tickets) {
            this.completedTickets = res.data.complete.tickets;
          }

          console.log('API - จำนวนทิคเก็ตใหม่:', this.newTickets.length);
          console.log('API - จำนวนทิคเก็ตที่เสร็จแล้ว:', this.completedTickets.length);

          this.updateMonthlybarChart();
        },
        error: (err) => {
          console.error('เกิดข้อผิดพลาดในการโหลดข้อมูล bar chart:', err);
        }
      });
    }
  }

  private initializeMonthlybarChart(): void {
    if (!this.monthlybarChartRef?.nativeElement) return;

    const ctx = this.monthlybarChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.monthlybarChart) {
      this.monthlybarChart.destroy();
    }

    this.monthlybarChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            label: this.translate('dashboard.newTickets'),
            data: [],
            backgroundColor: 'rgba(255, 193, 7, 0.6)',
            borderColor: '#FFC107',
            borderWidth: 1
          },
          {
            label: this.translate('dashboard.completed'),
            data: [],
            backgroundColor: 'rgba(40, 167, 69, 0.6)',
            borderColor: '#28A745',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top', align: 'end' },
          tooltip: {
            callbacks: {
              title: (tooltipItems) => {
                const day = tooltipItems[0].label;
                const monthName = this.getMonthName(this.getMonthNumber(this.selectedBarMonth));
                return `${this.translate('dashboard.day')} ${day} ${monthName} ${this.selectedBarYear}`;
              },
              label: (context) => {
                const value = context.parsed.y || 0;
                const label = context.dataset.label || '';
                return `${label}: ${this.formatNumber(value)} ${this.translate('dashboard.tickets')}`;
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: this.translate('dashboard.dayLabel')
            }
          },
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 },
            title: {
              display: true,
              text: this.translate('dashboard.ticketCountLabel')
            }
          }
        }
      }
    });

    console.log('Bar chart initialized successfully');
  }

  private initializeCategoryChart(): void {
    if (!this.categoryChartRef?.nativeElement) return;

    const ctx = this.categoryChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // ✅ ใช้ชื่อเดือนแบบสั้นตามภาษา
    const months = Array.from({ length: 12 }, (_, i) => this.getMonthShortName(i + 1));

    this.categoryChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: months,
        datasets: []
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              boxWidth: 12,
              usePointStyle: true,
              padding: 15,
              font: { size: 11 }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: '#ddd',
            borderWidth: 1
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 } }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: {
              stepSize: 1,
              font: { size: 11 }
            }
          }
        },
        elements: {
          point: {
            radius: 2,
            hoverRadius: 4
          }
        }
      }
    });

    console.log('Category chart initialized');
  }

  private initializePieChart(): void {
    if (!this.pieChartRef?.nativeElement) return;

    const ctx = this.pieChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.pieChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: [],
          borderWidth: 0,
          hoverBorderWidth: 2,
          hoverBorderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = context.parsed || 0;
                return `${label}: ${value.toFixed(1)}%`;
              }
            }
          }
        }
      }
    });

    console.log('Pie chart initialized');
  }

  // =============================================================================
  // CHART UPDATE METHODS
  // =============================================================================

  private updateAllChartsWithNewData(): void {
    if (!this.dashboardData.stats) {
      console.log('Waiting for dashboard stats...');
      return;
    }

    console.log('Updating all charts with new data...');
    this.updateMonthlyChart();
  }

  private updateMonthlyChart(): void {
    if (!this.monthlyChart || !this.dashboardData.stats) return;

    console.log('Updating monthly chart with API data...');

    const currentYear = parseInt(this.selectedYear);
    const currentMonth = this.getMonthNumber(this.selectedMonth);

    const dailyData = this.generateDailyDataFromTickets(currentYear, currentMonth);

    this.monthlyChart.data.labels = dailyData.labels;
    this.monthlyChart.data.datasets[0].data = dailyData.newTickets;
    this.monthlyChart.data.datasets[1].data = dailyData.completeTickets;

    this.monthlyChart.update('active');
    console.log('Monthly chart updated successfully');
  }

  private updateMonthlybarChart(): void {
    if (!this.monthlybarChart) return;

    const currentYear = parseInt(this.selectedBarYear);
    const currentMonth = this.getMonthNumber(this.selectedBarMonth);
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());

    const newTicketsPerDay: number[] = Array(daysInMonth).fill(0);
    const completedPerDay: number[] = Array(daysInMonth).fill(0);

    this.newTickets.forEach((ticket) => {
      if (ticket.createdAt) {
        const date = new Date(ticket.createdAt);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();

        if (year === currentYear && month === currentMonth) {
          if (day >= 1 && day <= daysInMonth) {
            newTicketsPerDay[day - 1] += 1;
          }
        }
      }
    });

    this.completedTickets.forEach((ticket) => {
      if (ticket.completedAt) {
        const date = new Date(ticket.completedAt);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();

        if (year === currentYear && month === currentMonth) {
          if (day >= 1 && day <= daysInMonth) {
            completedPerDay[day - 1] += 1;
          }
        }
      }
    });

    this.monthlybarChart.data.labels = labels;
    this.monthlybarChart.data.datasets[0].data = newTicketsPerDay;
    this.monthlybarChart.data.datasets[1].data = completedPerDay;
    this.monthlybarChart.update('active');

    console.log('อัพเดต Bar chart สำเร็จแล้ว');
  }

  // =============================================================================
  // DATA PROCESSING METHODS
  // =============================================================================

  private generateDailyDataFromTickets(year: number, month: number): {
    labels: string[],
    newTickets: number[],
    completeTickets: number[]
  } {
    const daysInMonth = new Date(year, month, 0).getDate();
    const labels: string[] = [];
    const newTicketsCount: number[] = [];
    const completeTicketsCount: number[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      labels.push(day.toString());
      newTicketsCount[day - 1] = 0;
      completeTicketsCount[day - 1] = 0;
    }

    const allTickets: any[] = [];

    if (this.dashboardData.stats?.new) {
      const newTickets = this.extractTicketsArray(this.dashboardData.stats.new);
      allTickets.push(...newTickets);
    }

    if (this.dashboardData.stats?.inProgress) {
      const inProgressTickets = this.extractTicketsArray(this.dashboardData.stats.inProgress);
      allTickets.push(...inProgressTickets);
    }

    if (this.dashboardData.stats?.complete) {
      const completeTickets = this.extractTicketsArray(this.dashboardData.stats.complete);
      allTickets.push(...completeTickets);
    }

    allTickets.forEach((ticket) => {
      if (!ticket.createdAt) return;

      const createdDate = new Date(ticket.createdAt);
      if (createdDate.getFullYear() === year && createdDate.getMonth() + 1 === month) {
        const day = createdDate.getDate();
        if (day >= 1 && day <= daysInMonth) {
          newTicketsCount[day - 1]++;
        }
      }
    });

    if (this.dashboardData.stats?.complete) {
      const completeTickets = this.extractTicketsArray(this.dashboardData.stats.complete);

      completeTickets.forEach((ticket) => {
        if (!ticket.createdAt) return;

        const createdDate = new Date(ticket.createdAt);
        if (createdDate.getFullYear() === year && createdDate.getMonth() + 1 === month) {
          const day = createdDate.getDate();
          if (day >= 1 && day <= daysInMonth) {
            completeTicketsCount[day - 1]++;
          }
        }
      });
    }

    return {
      labels,
      newTickets: newTicketsCount,
      completeTickets: completeTicketsCount
    };
  }

  private extractTicketsArray(data: any): TicketSummary[] {
    if (data && typeof data === 'object' && 'tickets' in data && Array.isArray(data.tickets)) {
      return data.tickets;
    }
    if (Array.isArray(data)) {
      return data;
    }
    return [];
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  getNewCount(): number {
    if (!this.dashboardData.stats) return 0;

    const newData = this.dashboardData.stats.new as any;

    if (newData && typeof newData === 'object' && 'count' in newData) {
      return Number(newData.count) || 0;
    }

    if (Array.isArray(newData)) {
      return newData.length;
    }

    if (typeof newData === 'number') {
      return newData;
    }

    return 0;
  }

  getInProgressCount(): number {
    if (!this.dashboardData.stats) return 0;

    const inProgressData = this.dashboardData.stats.inProgress as any;

    if (inProgressData && typeof inProgressData === 'object' && 'count' in inProgressData) {
      return Number(inProgressData.count) || 0;
    }

    if (Array.isArray(inProgressData)) {
      return inProgressData.length;
    }

    if (typeof inProgressData === 'number') {
      return inProgressData;
    }

    return 0;
  }

  getCompleteCount(): number {
    if (!this.dashboardData.stats) return 0;

    const completeData = this.dashboardData.stats.complete as any;

    if (completeData && typeof completeData === 'object' && 'count' in completeData) {
      return Number(completeData.count) || 0;
    }

    if (Array.isArray(completeData)) {
      return completeData.length;
    }

    if (typeof completeData === 'number') {
      return completeData;
    }

    return 0;
  }

  /**
 * ✅ แปลงชื่อเดือนภาษาอังกฤษเป็นชื่อตามภาษาปัจจุบัน
 */
  getDisplayMonthName(englishMonthName: string): string {
    const monthMap: { [key: string]: number } = {
      'January': 1, 'February': 2, 'March': 3, 'April': 4,
      'May': 5, 'June': 6, 'July': 7, 'August': 8,
      'September': 9, 'October': 10, 'November': 11, 'December': 12
    };

    const monthIndex = monthMap[englishMonthName];
    if (!monthIndex) return englishMonthName;

    return this.getMonthName(monthIndex);
  }

  private getMonthNumber(monthName: string): number {
    const months: { [key: string]: number } = {
      'January': 1, 'February': 2, 'March': 3, 'April': 4,
      'May': 5, 'June': 6, 'July': 7, 'August': 8,
      'September': 9, 'October': 10, 'November': 11, 'December': 12
    };

    const result = months[monthName] || 5;
    return result;
  }

  // =============================================================================
  // FILTER METHODS
  // =============================================================================

  selectYear(year: string): void {
    this.selectedYear = year;
    console.log(`Line chart year changed to: ${year}`);
    this.updateMonthlyChart();
  }

  selectMonth(month: string): void {
    this.selectedMonth = month;
    console.log(`Line chart month changed to: ${month}`);
    this.updateMonthlyChart();
  }

  selectBarYear(year: string): void {
    this.selectedBarYear = year;
    console.log(`Bar chart year changed to: ${year}`);
    this.loadMonthlyTicketsForBar();
  }

  selectBarMonth(month: string): void {
    this.selectedBarMonth = month;
    console.log(`Bar chart month changed to: ${month}`);
    this.loadMonthlyTicketsForBar();
  }

  selectCategoryYear(year: string): void {
    this.selectedCategoryYear = year;
    console.log(`Category year changed to: ${year}`);
    this.loadCategoryBreakdown();
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  getCategoryColumns(): CategoryStatsDTO[][] {
    if (this.categoryStats.length === 0) return [];

    const itemsPerColumn = Math.ceil(this.categoryStats.length / 2);
    const column1 = this.categoryStats.slice(0, itemsPerColumn);
    const column2 = this.categoryStats.slice(itemsPerColumn);

    return [column1, column2];
  }

  refreshDashboard(): void {
    console.log('Refreshing dashboard data...');
    this.loadDashboardData();
  }

  isDataReady(): boolean {
    return this.dashboardStats !== null;
  }

  /**
   * ✅ Format number ตามภาษาปัจจุบัน
   */
  formatNumber(num: number): string {
    if (!num) return '0';
    return this.languageService.formatNumber(num);
  }

  /**
   * ✅ Format date ตามภาษาปัจจุบัน
   */
  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return this.languageService.formatDate(date, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  }

  calculatePercentageChange(current: number, previous: number): number {
    if (!previous) return 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  shouldShowLoading(): boolean {
    return this.isLoading && !this.dashboardStats;
  }

  shouldShowError(): boolean {
    return !!this.dashboardData.error && !this.isLoading;
  }

  clearError(): void {
    this.dashboardData.error = null;
  }

  updateUserAssignment(id: number, newUserId: number): void {
    const sub = this.apiService.updateCustomerForProject(id, { user_id: newUserId }).subscribe({
      next: (response) => {
        if (response.status === 1 || response.code === '2') {
          console.log('อัพเดทสำเร็จ');
          this.loadCustomerForProjects();
        }
      },
      error: (error) => {
        console.error('Error updating:', error);
      }
    });

    this.subscriptions.add(sub);
  }

  getStatusBadgeClass(statusId: number): string {
    switch (statusId) {
      case 1: return 'bg-warning';
      case 2: return 'bg-info';
      case 3: return 'bg-secondary';
      case 4: return 'bg-primary';
      case 5: return 'bg-success';
      case 6: return 'bg-danger';
      default: return 'bg-secondary';
    }
  }

  getStatusText(statusId: number): string {
    return this.getStatusName(statusId);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();

    if (this.monthlyChart) {
      this.monthlyChart.destroy();
      this.monthlyChart = null;
    }
    if (this.monthlybarChart) {
      this.monthlybarChart.destroy();
      this.monthlybarChart = null;
    }
    if (this.categoryChart) {
      this.categoryChart.destroy();
      this.categoryChart = null;
    }
    if (this.pieChart) {
      this.pieChart.destroy();
      this.pieChart = null;
    }
  }
}