import {PrismaService} from "./prisma.service";
import {Global, Module} from "@nestjs/common";
import {I18nService} from "./i18n.service";

@Global()
@Module({
    providers: [PrismaService, I18nService],
    exports: [PrismaService, I18nService],
    imports: [],
    controllers: [],
})
export default class HelperModule {}
