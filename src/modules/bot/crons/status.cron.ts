import {Injectable} from "@nestjs/common";
import {Cron} from "@nestjs/schedule";
import {StatusService} from "../services/status.service";

@Injectable()
export class StatusCron {
    constructor(private readonly statusService: StatusService) {}

    @Cron("* * * * *")
    async updateStatus(): Promise<void> {
        await Promise.all([this.statusService.updateBotActivity(), this.statusService.updateStatusMessages()]);
    }
}
