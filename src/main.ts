import "./tracer";

import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import {
  Global,
  Module,
  Injectable,
  Controller,
  Logger,
  Get,
  Query,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

@Injectable()
export class DbService
  extends PrismaClient<
    Prisma.PrismaClientOptions,
    "info" | "warn" | "error" | "query"
  >
  implements OnModuleInit, OnModuleDestroy
{
  private logger = new Logger(DbService.name);
  constructor() {
    super({
      log: [
        { emit: `event`, level: `query` },
        { emit: `stdout`, level: `info` },
        { emit: `stdout`, level: `warn` },
        { emit: `stdout`, level: `error` },
      ],
      errorFormat: `pretty`,
    });
  }

  async onModuleInit() {
    this.$on("error", (event) => {
      this.logger.error(event);
    });
    this.$on("warn", (event) => {
      this.logger.warn(event);
    });
    this.$on("info", (event) => {
      this.logger.verbose(event);
    });
    this.$on("query", (e: Prisma.QueryEvent) => {
      this.logger.log("Query event: " + e.query);
      this.logger.log("Query params: " + e.params);
      this.logger.log("Duration: " + e.duration + "ms");
    });
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

@Global()
@Module({
  providers: [DbService, ConfigService],
  exports: [DbService],
})
export class DbModule {}

@Controller(`repro`)
export class ReproController {
  private logger = new Logger(ReproController.name);

  constructor(private readonly db: DbService) {}
  @Get(`test/sanity`)
  async testSanity() {
    this.logger.log(`Running sanity test`);

    return await this.db.metaDestination.findMany();
  }

  @Get(`test/fixed`)
  async testFixed(@Query("searchId") searchId: string) {
    this.logger.log(`Running test query with searchId: ${searchId}`);

    return this.db.$queryRawUnsafe(`
    WITH base_data AS (
      SELECT
        md."identifier",
        md."displayOrder",
        c."isoCode" as country_code,
        r."isoCode" as region_code,
        r."exploreName" as region_explore_name,
        r."name" as region_name,
        c."exploreName" as country_explore_name,
        c."name" as country_name
      FROM "SearchResult" AS sr
            LEFT JOIN "Trip" AS t ON sr."tripId" = t."id"
            LEFT JOIN "Airport" AS ap ON t."destinationCode" = ap."iataCode"
            LEFT JOIN "Country" AS c ON ap."isoCountryCode" = c."isoCode"
            LEFT JOIN "Region" AS r ON ap."isoRegionCode" = r."isoCode"
            LEFT JOIN "_AirportToMetaDestination" AS atm ON atm."A" = ap."id"
            LEFT JOIN "MetaDestination" AS md ON atm."B" = md."id"
      WHERE sr."searchId" = '${searchId}'
    )
    SELECT
      identifier AS "metaDestination",
      (CASE WHEN
          country_code = 'US'
      THEN
          COALESCE(region_explore_name, region_name)::text
      ELSE
          COALESCE(country_explore_name, country_name)::text
      END) AS "subfilterName",
      (CASE WHEN
          country_code = 'US'
      THEN
          region_code::text
      ELSE
          country_code::text
      END) AS "subfilterCode",
      (CASE WHEN
          country_code = 'US'
      THEN
          'region'::text
      ELSE
          'country'::text
      END) AS "subfilterType",
      COUNT(*)::INT AS "totalResults"
    FROM base_data
    GROUP BY
      "metaDestination",
      "subfilterName",
      "subfilterCode",
      "subfilterType",
      "displayOrder"
    ORDER BY
      "displayOrder" ASC,
      "subfilterName" ASC`);
  }
}

@Module({
  imports: [DbModule],
  controllers: [ReproController],
})
class ApiModule {}

async function bootstrap() {
  const api = await NestFactory.create<NestExpressApplication>(ApiModule);
  api.enableCors();
  await api.enableShutdownHooks().listen(8008);
}

// Start the reproduction server
bootstrap();
