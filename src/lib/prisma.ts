import { PrismaClient } from '@prisma/client';

interface RuntimeField {
  name: string;
  isOptional: boolean;
  hasDefaultValue: boolean;
  kind: string;
  isGenerated?: boolean;
  isId: boolean;
  isRequired: boolean;
}

interface RuntimeModel {
  fields: RuntimeField[];
}

interface RuntimeDataModel {
  models: Record<string, RuntimeModel>;
}
const basePrisma = new PrismaClient();

function getRequiredFieldsForModel(modelName: string): string[] {
  const runtimeDataModel = (basePrisma as unknown as { _runtimeDataModel: RuntimeDataModel })._runtimeDataModel;

  const model = runtimeDataModel?.models?.[modelName];
  if (!model) {
    throw new Error(`Model ${modelName} not found`);
  }

  return model.fields
    .filter(
      (field) =>
        !field.isId && field.isRequired && !field.isGenerated && !field.hasDefaultValue && field.kind === 'scalar',
    )
    .map((field) => field.name);
}

const prisma = basePrisma.$extends({
  client: {
    getRequiredFields: getRequiredFieldsForModel,
  },
});

export default prisma;
