import type { Logger } from "pino";
import type { DashboardService } from "@/application/services/dashboard.service.js";
import type { DashboardStatistics } from "@/application/services/dashboard.service.js";

export class DashboardController {
  private dashboardService: DashboardService;
  private logger: Logger;

  constructor({
    dashboardService,
    logger,
  }: {
    dashboardService: DashboardService;
    logger: Logger;
  }) {
    this.dashboardService = dashboardService;
    this.logger = logger;
  }

  async getStatistics(): Promise<DashboardStatistics> {
    this.logger.debug("Fetching dashboard statistics");
    return await this.dashboardService.getDashboardStatistics();
  }
}
