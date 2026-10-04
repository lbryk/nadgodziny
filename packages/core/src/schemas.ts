import { z } from 'zod';
import { isValidISO } from './dates';
import type { CustomDay, Settings, TeacherPlan } from './types';

export const isoDateSchema = z.string().refine(isValidISO, 'Niepoprawna data (RRRR-MM-DD)');

const kindSchema = z.enum(['school', 'holiday', 'break', 'ferie', 'den', 'director', 'exam', 'other']);

export const customDaySchema = z.object({
  date: isoDateSchema,
  kind: kindSchema,
  label: z.string().trim().max(160).optional(),
}) satisfies z.ZodType<CustomDay>;

export const customDaysSchema = z.array(customDaySchema).max(1500);

const weight = z.number().min(0).max(2);

export const settingsSchema = z.object({
  schoolName: z.string().trim().min(1).max(160),
  schoolYearStart: z.number().int().min(2024).max(2060),
  voivodeship: z.enum([
    'dolnoslaskie',
    'kujawsko-pomorskie',
    'lubelskie',
    'lubuskie',
    'lodzkie',
    'malopolskie',
    'mazowieckie',
    'opolskie',
    'podkarpackie',
    'podlaskie',
    'pomorskie',
    'slaskie',
    'swietokrzyskie',
    'warminsko-mazurskie',
    'wielkopolskie',
    'zachodniopomorskie',
  ]),
  denIsDayOff: z.boolean(),
  weights: z.object({ k12: weight, k34: weight, k5: weight, individual: weight }),
  weeksPerMonth: z.number().min(3).max(5),
  rounding: z.enum(['nearest', 'up', 'down']),
  workdaysBasis: z.enum(['working-days', 'school-days']),
  absenceCounting: z.enum(['lesson-days', 'all-days']),
  examDays: z.enum(['neutral', 'normal']),
  class5EndDate: isoDateSchema,
  pensumPresets: z.array(z.number().min(1).max(60)).min(1).max(12),
  defaultPensum: z.number().min(1).max(60),
  submissionDeadline: z.string().max(32),
  announcement: z.string().max(400),
}) satisfies z.ZodType<Settings>;

const hours = z.number().min(0).max(24);
const week = z.array(hours).length(5);

const eventSchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum([
    'trip',
    'training',
    'absence',
    'practice',
    'exam-oral',
    'exam-assist',
    'substitution',
    'individual',
    'other',
  ]),
  title: z.string().max(160),
  from: isoDateSchema,
  to: isoDateSchema,
  lessons: z.enum(['none', 'whole-day', 'partial', 'groups']),
  hoursPerDay: hours,
  groups: z.array(z.enum(['k12', 'k34', 'k5'])),
  settlement: z.enum(['none', 'separate', 'free']),
  paidHours: z.number().min(0).max(400),
  note: z.string().max(600),
});

/** Validates a plan imported from a JSON backup file. */
export const teacherPlanSchema = z.object({
  teacherName: z.string().max(160),
  variant: z.union([z.literal(1), z.literal(2)]),
  pensumFull: z.number().min(1).max(60),
  contractHours: z.number().min(0).max(60),
  individualInPensum: z.boolean(),
  timetable: z.object({ k12: week, k34: week, k5: week, ind: week }),
  cellOverrides: z.record(isoDateSchema, z.string().max(12)),
  events: z.array(eventSchema).max(500),
  monthly: z.record(
    z.string().regex(/^\d{4}-\d{2}$/),
    z.object({
      substitutions: z.number().min(0).max(400).optional(),
      individual: z.number().min(0).max(400).optional(),
      absenceDays: z.number().min(0).max(31).optional(),
    }),
  ),
  avgPensumOverride: z.number().min(1).max(60).nullable(),
  hourlyRate: z.number().min(0).max(10000).nullable(),
}) satisfies z.ZodType<TeacherPlan>;
