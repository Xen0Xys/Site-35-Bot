import {TrainingCommands} from "./commands/training.commands";
import {BotEmbedsService} from "./services/bot-embeds.service";
import {TrainingService} from "./services/training.service";
import {CommandService} from "./services/command.service";
import {DiscordService} from "./services/discord.service";
import {ProfileCommand} from "./commands/profile.command";
import {BotListener} from "./listeners/bot.listener";
import {RankCommand} from "./commands/rank.command";
import {UserService} from "./services/user.service";
import {Module} from "@nestjs/common";
import {RankService} from "./services/rank.service";

@Module({
    providers: [
        // Services
        BotEmbedsService,
        CommandService,
        DiscordService,
        RankService,
        TrainingService,
        UserService,
        // Commands
        ProfileCommand,
        RankCommand,
        TrainingCommands,
        // Listeners
        BotListener,
    ],
})
export class BotModule {}
