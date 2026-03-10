import {TrainingCommands} from "./commands/training.commands";
import {BotEmbedsService} from "./services/bot-embeds.service";
import {TrainingService} from "./services/training.service";
import {MedalService} from "./services/medal.service";
import {CommandService} from "./services/command.service";
import {DiscordService} from "./services/discord.service";
import {ProfileCommand} from "./commands/profile.command";
import {BotListener} from "./listeners/bot.listener";
import {RankCommand} from "./commands/rank.command";
import {UserService} from "./services/user.service";
import {Module} from "@nestjs/common";
import {RankService} from "./services/rank.service";
import {StatusService} from "./services/status.service";
import {StatusCron} from "./crons/status.cron";
import {StatusCommands} from "./commands/status.commands";
import {MedalCommands} from "./commands/medal.commands";

@Module({
    providers: [
        // Services
        BotEmbedsService,
        CommandService,
        DiscordService,
        RankService,
        StatusService,
        MedalService,
        TrainingService,
        UserService,
        // Commands
        ProfileCommand,
        MedalCommands,
        RankCommand,
        StatusCommands,
        TrainingCommands,
        // Listeners
        BotListener,
        // Cron
        StatusCron,
    ],
})
export class BotModule {}
