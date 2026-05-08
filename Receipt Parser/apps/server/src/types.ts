import { z } from "zod";

export const lineItemSchema = z.object({
  name: z.string().default(""),
  amount: z.number().finite().default(0)
});

export const receiptSchema = z.object({
  merchant: z.string().default(""),
  date: z.string().default(""),
  lineItems: z.array(lineItemSchema).default([]),
  total: z.number().finite().default(0)
});

export type Receipt = z.infer<typeof receiptSchema>;

export type ParseMeta = {
  warnings: string[];
  rawOutput?: string;
  confidenceHints: string[];
  model: string;
  attempts: number;
};
