export interface DashboardStatsDTO {
  totalTickets: number;
  newTickets: number;
  inProgressTickets: number;
  completeTickets: number;
}

export interface MonthlyTicketStatsDTO {
  month: string;
  newTickets: number;
  complete: number;
  total: number;
}

export interface CategoryStatsDTO {
  category: string;
  count: number;
  percentage: number;
  monthlyCounts: number[];
  color: string;
}


export interface DashboardResponseDTO {
  stats: DashboardStatsDTO;
  monthlyTrend: MonthlyTicketStatsDTO[];
  categoryBreakdown: CategoryStatsDTO[];
  ticketsByCategory: {
    [key: string]: number;
  };
}

// หรือใช้ class-based DTO (แนะนำสำหรับ NestJS)
export class DashboardStatsResponse {
  totalTickets: number;
  newTickets: number;
  inProgressTickets: number;
  completeTickets: number;

  constructor(data: DashboardStatsDTO) {
    this.totalTickets = data.totalTickets;
    this.newTickets = data.newTickets;
    this.inProgressTickets = data.inProgressTickets;
    this.completeTickets = data.completeTickets;
  }
}

export class MonthlyTicketStatsResponse {
  month: string;
  newTickets: number;
  complete: number;
  total: number;

  constructor(data: MonthlyTicketStatsDTO) {
    this.month = data.month;
    this.newTickets = data.newTickets;
    this.complete = data.complete;
    this.total = data.total;
  }
}

export class CategoryStatsResponse {
  category: string;
  count: number;
  percentage: number;
  monthlyCounts: number[];
  color: string;

  constructor(data: CategoryStatsDTO) {
    this.category = data.category;
    this.count = data.count;
    this.percentage = data.percentage;
    this.monthlyCounts = data.monthlyCounts;
    this.color = data.color;
  }
}

export class DashboardResponse {
  stats: DashboardStatsResponse;
  monthlyTrend: MonthlyTicketStatsResponse[];
  categoryBreakdown: CategoryStatsResponse[];
  ticketsByCategory: {
    [key: string]: number;
  };

  constructor(data: DashboardResponseDTO) {
    this.stats = new DashboardStatsResponse(data.stats);
    this.monthlyTrend = data.monthlyTrend.map(item => new MonthlyTicketStatsResponse(item));
    this.categoryBreakdown = data.categoryBreakdown.map(item => new CategoryStatsResponse(item));
    this.ticketsByCategory = data.ticketsByCategory;
  }
}