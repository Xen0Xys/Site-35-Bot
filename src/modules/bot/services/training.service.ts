import {Injectable, Logger, NotFoundException} from "@nestjs/common";
import {Trainings} from "../../../../prisma/generated/enums";
import {I18nService} from "../../helper/i18n.service";
import {PrismaService} from "../../helper/prisma.service";
import {DiscordService} from "./discord.service";

@Injectable()
export class TrainingService {
    private readonly logger: Logger = new Logger(TrainingService.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly discordService: DiscordService,
        private readonly i18nService: I18nService,
    ) {}

    sanitizeMessages(messages: string[]) {
        const normalize = (value: string) =>
            value
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, " ")
                .trim()
                .replace(/\s+/g, " ");

        const normalizeNoSpace = (value: string) => normalize(value).replace(/\s+/g, "");

        const sanitizePreview = (value: string, maxLength = 120) => {
            const flattened = value.replace(/\s+/g, " ").trim();
            if (flattened.length <= maxLength) return flattened;
            return `${flattened.slice(0, maxLength)}...`;
        };

        const trainings = Object.values(Trainings) as Trainings[];

        const trainingAliases: Record<string, Trainings> = {
            fim: Trainings.FIM,
            cqc: Trainings.CQC,
            "premiers secours": Trainings.FIRST_AID,
            "first aid": Trainings.FIRST_AID,
            breacher: Trainings.BREACHER,
            "lance grenade": Trainings.GRENADE_LAUNCHER,
            "lance grenades": Trainings.GRENADE_LAUNCHER,
            "grenade launcher": Trainings.GRENADE_LAUNCHER,
            "lance flammes": Trainings.FLAMETHROWER,
            flamethrower: Trainings.FLAMETHROWER,
            "anti tank": Trainings.ANTI_TANK,
            "anti char": Trainings.ANTI_TANK,
            artificier: Trainings.ARTIFICIER,
            sniper: Trainings.SNIPER,
            "tireur de precision": Trainings.SNIPER,
            "fusilier mitrailleur": Trainings.MACHINE_GUNNER,
            "fusil mitrailleur": Trainings.MACHINE_GUNNER,
            "fusille mitrailleur": Trainings.MACHINE_GUNNER,
            medic: Trainings.MEDIC,
            medecin: Trainings.MEDIC,
        };

        const normalizedLabelToTraining = new Map<string, Trainings>();
        const trainingMap = this.i18nService.getTrainingMap();
        trainings.forEach((training) => {
            const label = trainingMap[training];
            normalizedLabelToTraining.set(normalize(label), training);
            normalizedLabelToTraining.set(normalizeNoSpace(label), training);
            normalizedLabelToTraining.set(normalize(training), training);
            normalizedLabelToTraining.set(normalizeNoSpace(training), training);
        });
        Object.entries(trainingAliases).forEach(([alias, training]) => {
            normalizedLabelToTraining.set(normalize(alias), training);
            normalizedLabelToTraining.set(normalizeNoSpace(alias), training);
        });

        const sanitized: {userId: bigint; training: Trainings}[] = [];

        messages.forEach((message) => {
            const cleanedMessage = message.replace(/\r/g, "");
            const preview = sanitizePreview(cleanedMessage);
            const normalizedMessage = normalize(cleanedMessage);
            const trainingMatch = normalizedMessage.match(/formation completee\s+(.+)$/i);
            if (!trainingMatch) {
                return;
            }

            const trainingRaw = trainingMatch[1].split("site 35")[0].trim();
            if (!trainingRaw) return;

            const normalizedTraining = normalize(trainingRaw);
            if (normalizedTraining.includes("instructeur")) return;
            const training =
                normalizedLabelToTraining.get(normalizedTraining) ??
                normalizedLabelToTraining.get(normalizeNoSpace(trainingRaw));
            if (!training) {
                this.logger.warn(
                    `Unknown training "${trainingRaw}" (normalized: "${normalizedTraining}"), skipping. Preview: "${preview}"`,
                );
                return;
            }

            const mentionMatch = cleanedMessage.match(/<@!?(\d{17,})>/);
            const idMatch = mentionMatch ?? cleanedMessage.match(/\b(\d{17,})\b/);
            if (!idMatch) {
                return;
            }

            const userId = BigInt(idMatch[1]);
            sanitized.push({userId, training});
        });
        return sanitized;
    }

    async registerTrainings() {
        const trainingMessages = await this.discordService.getTrainingMessages();
        const sanitizedTrainings = this.sanitizeMessages(trainingMessages);
        await this.registerSanitizedTrainings(sanitizedTrainings);
    }

    async registerTrainingsFromMessage(message: string) {
        const sanitizedTrainings = this.sanitizeMessages([message]);
        await this.registerSanitizedTrainings(sanitizedTrainings);
    }

    toTraining(training: string): Trainings | null {
        const formattedTraining = training.toUpperCase().replace(".", "").replace(" ", "_");
        return Trainings[formattedTraining as keyof typeof Trainings] || null;
    }

    toTrainingFromLabel(label: string): Trainings | null {
        const normalizedLabel = label.toUpperCase().replace(/\s+/g, " ").trim();
        const trainingMap = this.i18nService.getTrainingMap();
        const training = (Object.keys(trainingMap) as Trainings[]).find(
            (t) => trainingMap[t].toUpperCase() === normalizedLabel,
        );
        if (!training) {
            this.logger.warn(`Unknown training label: "${label}" (normalized: "${normalizedLabel}").`);
            return null;
        }
        return training;
    }

    async addTraining(userId: bigint, training: Trainings) {
        const user = await this.prismaService.users.findUnique({where: {id: userId}});
        if (!user)
            throw new NotFoundException(
                `User with id ${userId.toString()} not found, cannot add training ${training}.`,
            );
        await this.prismaService.userTrainings.create({
            data: {
                user_id: userId,
                training,
            },
        });
        this.logger.log(`Added training ${training} for user ${userId.toString()}.`);
    }

    async removeTraining(userId: bigint, training: Trainings) {
        const user = await this.prismaService.users.findUnique({where: {id: userId}});
        if (!user)
            throw new NotFoundException(
                `User with id ${userId.toString()} not found, cannot remove training ${training}.`,
            );
        await this.prismaService.userTrainings.delete({
            where: {
                user_id_training: {
                    user_id: userId,
                    training,
                },
            },
        });
        this.logger.log(`Removed training ${training} for user ${userId.toString()}.`);
    }

    private async registerSanitizedTrainings(sanitizedTrainings: {userId: bigint; training: Trainings}[]) {
        if (sanitizedTrainings.length === 0) {
            this.logger.log("No sanitized trainings to register.");
            return;
        }

        const uniqueEntries = new Map<string, {userId: bigint; training: Trainings}>();
        sanitizedTrainings.forEach((entry) => {
            const key = `${entry.userId.toString()}-${entry.training}`;
            if (!uniqueEntries.has(key)) uniqueEntries.set(key, entry);
        });

        const entries = Array.from(uniqueEntries.values());
        const userIds = Array.from(new Set(entries.map((entry) => entry.userId)));
        const existingUsers = await this.prismaService.users.findMany({
            where: {id: {in: userIds}},
            select: {id: true},
        });
        const existingUserIds = new Set(existingUsers.map((user) => user.id.toString()));

        const createData = entries
            .filter((entry) => existingUserIds.has(entry.userId.toString()))
            .map((entry) => ({user_id: entry.userId, training: entry.training}));

        entries
            .filter((entry) => !existingUserIds.has(entry.userId.toString()))
            .forEach((entry) => {
                this.logger.warn(`Skipping training for missing user ${entry.userId.toString()}: ${entry.training}.`);
            });

        if (createData.length > 0) {
            await this.prismaService.userTrainings.createMany({
                data: createData,
                skipDuplicates: true,
            });
            this.logger.log(`Registered ${createData.length} trainings (batch).`);
        } else {
            this.logger.log("No trainings to register after filtering.");
        }
    }
}
