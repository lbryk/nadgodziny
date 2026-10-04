import { teacherPlanSchema, type TeacherPlan } from '@nadgodziny/core';
import { saveAs } from 'file-saver';
import { z } from 'zod';

const envelope = z.object({
  app: z.literal('nadgodziny'),
  version: z.literal(1),
  plan: teacherPlanSchema,
});

export function downloadPlanBackup(plan: TeacherPlan, fileBaseName: string): void {
  const blob = new Blob([JSON.stringify({ app: 'nadgodziny', version: 1, plan }, null, 2)], {
    type: 'application/json',
  });
  saveAs(blob, `${fileBaseName}.json`);
}

export async function readPlanBackup(file: File): Promise<TeacherPlan> {
  if (file.size > 1_000_000) throw new Error('Plik jest za duży na kopię kalkulatora.');
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    throw new Error('To nie jest poprawny plik JSON.');
  }
  const parsed = envelope.safeParse(json);
  if (!parsed.success) throw new Error('Plik nie wygląda na kopię z tego kalkulatora.');
  return parsed.data.plan;
}
