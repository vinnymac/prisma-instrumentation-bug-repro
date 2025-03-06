# Prisma Query Parser Bug Report

## Description
After upgrading from Prisma 6.0.1 to 6.1.0 or higher, certain valid SQL queries containing CASE statements combined with GROUP BY and ORDER BY clauses cause Prisma to hang indefinitely without any error message.

## Environment
- Prisma Version: 6.1.0+
- Database: PostgreSQL
- Node.js Version: 22
- Operating System: Alpine 3.21

## Reproduction Steps
1. docker compose up app (wait for it to finish)
2. Run a sanity check to confirm the service is capable of querying the db successfully: `curl --request GET --url 'http://localhost:8008/repro/test/sanity'`
3. Run the reproduction which will never finish with: `curl --request GET --url 'http://localhost:8008/repro/test/fixed?searchId=avs_yhbgYLBYPj'`

## Expected Behavior
The query should execute successfully. It is valid SQL and runs correctly when executed directly in PostgreSQL, when not using PrismaInstrumentation, or when using a direct connection.

## Actual Behavior
The query hangs indefinitely with no error output, even with DEBUG=prisma* enabled.

## Workaround

- Disabling PrismaInstrumentation
- Using SessionMode instead of TransactionMode & pgbouncer=true

## Additional Context

- The issue affects complex queries with CASE statements whose results are used in GROUP BY and ORDER BY clauses
- The SQL is valid and executes successfully directly in PostgreSQL
- No error messages are produced, making debugging challenging
- The issue appears to be related to Prisma Instrumentation changing the query in some way to make it incompatible with Supabase Supervisor
