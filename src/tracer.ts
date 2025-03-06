import {
  PrismaInstrumentation,
  registerInstrumentations,
} from "@prisma/instrumentation";

// Disabling this line of code fixes the bug
const prismaInstrumentation = new PrismaInstrumentation();
registerInstrumentations({
  instrumentations: [prismaInstrumentation],
});
