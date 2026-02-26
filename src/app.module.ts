import {Module} from "@nestjs/common";
import {ConfigModule, ConfigService} from "@nestjs/config";
import {ThrottlerModule} from "@nestjs/throttler";
import {ScheduleModule} from "@nestjs/schedule";
import {AppController} from "./app.controller";
import {JwtModule} from "@nestjs/jwt";
import {NecordModule, NecordModuleOptions} from "necord";
import {IntentsBitField} from "discord.js";
import HelperModule from "./modules/helper/helper.module";
import {BotModule} from "./modules/bot/bot.module";
import {APP_INTERCEPTOR} from "@nestjs/core";
import {AppClassSerializerInterceptor} from "./common/interceptors/app-class-serializer.interceptor";

@Module({
    imports: [
        ConfigModule.forRoot({isGlobal: true}),
        JwtModule.registerAsync({
            global: true,
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get<string>("APP_SECRET"),
                signOptions: {
                    expiresIn: "30d",
                    algorithm: "HS512",
                    issuer: configService.get<string>("APP_NAME"),
                },
                verifyOptions: {
                    algorithms: ["HS512"],
                    issuer: configService.get<string>("APP_NAME"),
                },
            }),
        }),
        ScheduleModule.forRoot(),
        ThrottlerModule.forRoot([
            {
                ttl: 60000,
                limit: 60,
            },
        ]),
        NecordModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService): NecordModuleOptions => {
                const token = configService.get<string>("DISCORD_TOKEN");
                if (!token) throw new Error("DISCORD_TOKEN is not defined");
                const guildId = configService.get<string>("DISCORD_GUILD_ID");
                if (!guildId) throw new Error("DISCORD_GUILD_ID is not defined");
                return {
                    token,
                    intents: [
                        IntentsBitField.Flags.Guilds,
                        IntentsBitField.Flags.GuildMembers,
                        IntentsBitField.Flags.GuildMessages,
                        IntentsBitField.Flags.MessageContent,
                    ],
                    development: [guildId],
                };
            },
        }),
        HelperModule,
        BotModule,
    ],
    controllers: [AppController],
    providers: [
        {
            provide: APP_INTERCEPTOR,
            useClass: AppClassSerializerInterceptor,
        },
    ],
})
export class AppModule {}
