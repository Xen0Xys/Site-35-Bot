import {Injectable, Logger} from "@nestjs/common";
import {ActivityType, Client, Message} from "discord.js";
import {PrismaService} from "../../helper/prisma.service";
import {ServerDataEntity} from "../models/entities/server-data.entity";
import {BotEmbedsService} from "./bot-embeds.service";
import {MessageTypes} from "../../../../prisma/generated/enums";
import {ConfigService} from "@nestjs/config";
import {GameDig, QueryResult} from "gamedig";

@Injectable()
export class StatusService {
    private readonly logger: Logger = new Logger(StatusService.name);
    private readonly serverIp: string;
    private readonly serverQueryPort: number;

    constructor(
        private readonly client: Client,
        private readonly prismaService: PrismaService,
        private readonly botEmbedsService: BotEmbedsService,
        private readonly configService: ConfigService,
    ) {
        this.serverIp = this.configService.get<string>("GAME_SERVER_IP") || "";
        this.serverQueryPort = this.configService.get<number>("GAME_SERVER_QUERY_PORT") || 0;
        if (!this.serverIp || !this.serverQueryPort)
            throw new Error("GAME_SERVER_IP and GAME_SERVER_QUERY_PORT must be configured.");
    }

    async fetchServerData(): Promise<ServerDataEntity | null> {
        try {
            const state: QueryResult = await GameDig.query({
                type: "armareforger",
                host: this.serverIp,
                port: this.serverQueryPort,
                socketTimeout: 2000,
            });
            return new ServerDataEntity({
                name: state.name || "Unknown",
                players: state.players.length,
                maxPlayers: state.maxplayers,
                map: state.map || "Unknown",
                status: "online",
            });
        } catch {
            this.logger.error("Failed to query game server.");
            return new ServerDataEntity({
                name: "Unknown",
                players: 0,
                maxPlayers: 0,
                map: "Unknown",
                status: "offline",
            });
        }
    }

    async updateBotActivity(): Promise<void> {
        const serverData = await this.fetchServerData();
        if (!serverData) {
            this.logger.warn("Failed to fetch server data. Setting default activity.");
            return;
        }
        this.client.user?.setPresence({
            activities: [
                {
                    name: `Surveillance ${serverData.players}/${serverData.maxPlayers} opérateurs`,
                    state: "Flux operationnel ███ - Dev: Xen0Xys",
                    type: ActivityType.Playing,
                },
            ],
            status: "dnd",
        });
    }

    async trackStatusMessage(channelId: bigint, messageId: bigint): Promise<void> {
        await this.prismaService.trackedMessages.create({
            data: {
                channel_id: channelId,
                message_id: messageId,
                type: MessageTypes.STATUS,
            },
        });
    }

    async getStatusMessages(): Promise<Message[]> {
        const statusMessages = await this.prismaService.trackedMessages.findMany({
            where: {
                type: MessageTypes.STATUS,
            },
        });
        const messages: Message[] = [];
        for (const trackedMessage of statusMessages) {
            try {
                const channel = await this.client.channels.fetch(trackedMessage.channel_id.toString());
                if (!channel || !channel.isTextBased()) continue;
                const message = await channel.messages.fetch(trackedMessage.message_id.toString());
                messages.push(message);
            } catch (error) {
                this.logger.warn(
                    `Failed to fetch message ${trackedMessage.message_id} in channel ${trackedMessage.channel_id}. Removing from database. Error: ${error}`,
                );
                await this.prismaService.trackedMessages.delete({
                    where: {
                        message_id_channel_id: {
                            message_id: trackedMessage.message_id,
                            channel_id: trackedMessage.channel_id,
                        },
                    },
                });
            }
        }
        return messages;
    }

    async updateStatusMessages(): Promise<void> {
        const serverData = await this.fetchServerData();
        if (!serverData) {
            this.logger.warn("Failed to fetch server data. Skipping status message update.");
            return;
        }
        const messages: Message[] = await this.getStatusMessages();
        for (const message of messages) {
            try {
                const embed = this.botEmbedsService.getStatusEmbed(serverData);
                await message.edit({
                    embeds: [embed.embed],
                    files: embed.attachments,
                });
            } catch (error) {
                this.logger.warn(
                    `Failed to update status message ${message.id} in channel ${message.channelId}. Error: ${error}`,
                );
            }
        }
    }
}
