'use server';
/**
 * @fileOverview An AI agent that provides a concise summary of financial reports.
 *
 * - summarizeFinancialReport - A function that generates a summary of a financial report.
 * - FinancialReportSummarizerInput - The input type for the summarizeFinancialReport function.
 * - FinancialReportSummarizerOutput - The return type for the summarizeFinancialReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FinancialReportSummarizerInputSchema = z.object({
  reportContent: z
    .string()
    .describe(
      'The full content of the financial report to be summarized. This can include text, tables, and figures.'
    ),
});
export type FinancialReportSummarizerInput = z.infer<
  typeof FinancialReportSummarizerInputSchema
>;

const FinancialReportSummarizerOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the financial report, highlighting key performance and health indicators.'),
});
export type FinancialReportSummarizerOutput = z.infer<
  typeof FinancialReportSummarizerOutputSchema
>;

export async function summarizeFinancialReport(
  input: FinancialReportSummarizerInput
): Promise<FinancialReportSummarizerOutput> {
  return financialReportSummarizerFlow(input);
}

const financialReportSummarizerPrompt = ai.definePrompt({
  name: 'financialReportSummarizerPrompt',
  input: {schema: FinancialReportSummarizerInputSchema},
  output: {schema: FinancialReportSummarizerOutputSchema},
  prompt: `You are an expert financial analyst. Your task is to provide a concise summary of the key financial performance and health indicators from the provided financial report. Focus on identifying and explaining critical metrics, trends, and any significant financial strengths or weaknesses.

Financial Report Content:
{{{reportContent}}}`,
});

const financialReportSummarizerFlow = ai.defineFlow(
  {
    name: 'financialReportSummarizerFlow',
    inputSchema: FinancialReportSummarizerInputSchema,
    outputSchema: FinancialReportSummarizerOutputSchema,
  },
  async input => {
    const {output} = await financialReportSummarizerPrompt(input);
    return output!;
  }
);
