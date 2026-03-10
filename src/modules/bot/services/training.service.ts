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
        // Normalize text for resilient matching across accents, punctuation, and casing.
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

        // Common aliases and typos used in real messages.
        const trainingAliases: Record<string, Trainings> = {
            fim: Trainings.FIM,
            "fim instructeur": Trainings.FIM_INSTRUCTOR,
            "instructeur fim": Trainings.FIM_INSTRUCTOR,
            "formateur fim": Trainings.FIM_INSTRUCTOR,
            cqc: Trainings.CQC,
            "cqc instructeur": Trainings.CQC_INSTRUCTOR,
            "instructeur cqc": Trainings.CQC_INSTRUCTOR,
            "formateur cqc": Trainings.CQC_INSTRUCTOR,
            "premiers secours": Trainings.FIRST_AID,
            "premiers secours instructeur": Trainings.FIRST_AID_INSTRUCTOR,
            "formateur premiers secours": Trainings.FIRST_AID_INSTRUCTOR,
            "instructeur premiers secours": Trainings.FIRST_AID_INSTRUCTOR,
            "premiers soins": Trainings.FIRST_AID,
            "premiers soins instructeur": Trainings.FIRST_AID_INSTRUCTOR,
            "instructeur premiers soins": Trainings.FIRST_AID_INSTRUCTOR,
            "first aid": Trainings.FIRST_AID,
            "first aid instructor": Trainings.FIRST_AID_INSTRUCTOR,
            "instructor first aid": Trainings.FIRST_AID_INSTRUCTOR,
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
            drone: Trainings.DRONE,
        };

        const resolveInstructorTraining = (normalizedTraining: string, normalizedNoSpaceTraining: string) => {
            const hasInstructorKeyword =
                normalizedTraining.includes("instructeur") || normalizedTraining.includes("instructor");
            if (!hasInstructorKeyword) return null;

            if (normalizedNoSpaceTraining.includes("fim")) return Trainings.FIM_INSTRUCTOR;
            if (normalizedNoSpaceTraining.includes("cqc")) return Trainings.CQC_INSTRUCTOR;
            if (
                normalizedNoSpaceTraining.includes("premierssecours") ||
                normalizedNoSpaceTraining.includes("premierssoins") ||
                normalizedNoSpaceTraining.includes("firstaid")
            )
                return Trainings.FIRST_AID_INSTRUCTOR;

            return null;
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
            // Support optional header lines and parse each logical block separately.
            const headerRegex = /site\s*35\s*[|\-–—]*\s*registre\s*d['’]?attribution\s*des\s*formations/i;
            const blocks = cleanedMessage
                .split(headerRegex)
                .map((block) => block.trim())
                .filter((block) => block.length > 0);
            const targetBlocks = blocks.length > 0 ? blocks : [cleanedMessage];

            targetBlocks.forEach((block) => {
                const preview = sanitizePreview(block);
                // Prefer explicit "Formation completee" lines when present.
                const trainingLineMatches = Array.from(
                    block.matchAll(/formation compl[eé]t[eé]e\s*[:-]?\s*(.+)/gi),
                ).map((match) => match[1].trim());

                const normalizedBlock = normalize(block);
                const fallbackMatches = Array.from(normalizedBlock.matchAll(/formation completee\s+(.+)/gi)).map(
                    (match) => match[1].trim(),
                );

                const trainingCandidates = trainingLineMatches.length > 0 ? trainingLineMatches : fallbackMatches;

                if (trainingCandidates.length === 0) return;

                // Extract member id from mention or raw numeric id.
                const mentionMatch = block.match(/<@!?(\d{17,})>/);
                const idMatch = mentionMatch ?? block.match(/\b(\d{17,})\b/);
                if (!idMatch) return;

                const userId = BigInt(idMatch[1]);

                trainingCandidates.forEach((trainingCandidate) => {
                    const trainingRaw = trainingCandidate.split("site 35")[0].trim();
                    if (!trainingRaw) return;

                    const normalizedTraining = normalize(trainingRaw);
                    const normalizedNoSpaceTraining = normalizeNoSpace(trainingRaw);
                    const training =
                        normalizedLabelToTraining.get(normalizedTraining) ??
                        normalizedLabelToTraining.get(normalizedNoSpaceTraining) ??
                        resolveInstructorTraining(normalizedTraining, normalizedNoSpaceTraining);
                    if (!training) {
                        this.logger.warn(
                            `Unknown training "${trainingRaw}" (normalized: "${normalizedTraining}"), skipping. Preview: "${preview}"`,
                        );
                        return;
                    }

                    sanitized.push({userId, training});
                });
            });
        });
        return sanitized;
    }

    async registerTrainings() {
        const trainingMessages = await this.discordService.getTrainingMessages();
        const sanitizedTrainings = this.sanitizeMessages(trainingMessages);
        await this.addTrainings(sanitizedTrainings);
    }

    async registerTrainingsFromMessage(message: string) {
        const sanitizedTrainings = this.sanitizeMessages([message]);
        await this.addTrainings(sanitizedTrainings);
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
        await this.addTrainings([{userId, training}], true);
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
        const roleId = this.discordService.getTrainingRoleId(training);
        if (roleId) await this.discordService.removeRoleFromMember(userId, roleId);
        else this.logger.warn(`No role ID configured for training ${training}, skipping role removal.`);
        this.logger.log(`Removed training ${training} for user ${userId.toString()}.`);
    }

    private async addTrainings(
        sanitizedTrainings: {userId: bigint; training: Trainings}[],
        // Throw error when true, otherwise skip entries with missing users.
        requireExistingUser: boolean = false,
    ) {
        if (sanitizedTrainings.length === 0) {
            this.logger.log("No sanitized trainings to register.");
            return;
        }

        // Deduplicate to prevent redundant DB writes and role changes.
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

        const missingEntries = entries.filter((entry) => !existingUserIds.has(entry.userId.toString()));
        if (missingEntries.length > 0) {
            if (requireExistingUser) {
                const entry = missingEntries[0];
                throw new NotFoundException(
                    `User with id ${entry.userId.toString()} not found, cannot add training ${entry.training}.`,
                );
            }
            missingEntries.forEach((entry) => {
                this.logger.warn(`Skipping training for missing user ${entry.userId.toString()}: ${entry.training}.`);
            });
        }

        if (createData.length > 0) {
            // Batch insert to minimize DB calls; skipDuplicates avoids errors for existing entries.
            await this.prismaService.userTrainings.createMany({
                data: createData,
                skipDuplicates: true,
            });
            // Assign roles for all trainings in parallel (retroactive).
            const rolePromises = createData.map((entry) => {
                const roleId = this.discordService.getTrainingRoleId(entry.training);
                if (!roleId) {
                    this.logger.warn(`No role ID configured for training ${entry.training}, skipping role assignment.`);
                    return Promise.resolve();
                }
                return this.discordService.addRoleToMember(entry.user_id, roleId);
            });
            await Promise.all(rolePromises);
            this.logger.log(`Registered ${createData.length} trainings (batch).`);
        } else {
            this.logger.log("No trainings to register after filtering.");
        }
    }
}
