'use server';
/**
 * @fileOverview An AI assistant for suggesting Chart of Accounts entries and identifying potential data entry errors.
 *
 * - classifyTransaction - A function that handles the transaction classification process.
 * - TransactionClassificationAssistantInput - The input type for the classifyTransaction function.
 * - TransactionClassificationAssistantOutput - The return type for the classifyTransaction function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TransactionClassificationAssistantInputSchema = z.object({
  transactionDescription: z
    .string()
    .describe('A detailed description of the financial transaction.'),
});
export type TransactionClassificationAssistantInput = z.infer<
  typeof TransactionClassificationAssistantInputSchema
>;

const TransactionClassificationAssistantOutputSchema = z.object({
  suggestedEntries: z.array(z.object({
    accountCode: z.string().describe('The suggested Chart of Accounts code.'),
    accountName: z.string().describe('The suggested Chart of Accounts name.'),
    type: z.enum(['Debit', 'Credit']).describe('Whether this line is a Debit or Credit.'),
    percentage: z.number().optional().describe('Relative weight of this line if known (e.g. 100).'),
  })).describe('A balanced set of debit and credit entries.'),
  potentialErrors: z
    .boolean()
    .describe('True if potential data entry errors are identified, false otherwise.'),
  errorDescription: z
    .string()
    .optional()
    .describe('A description of any identified potential data entry errors.'),
  rationale: z
    .string()
    .describe('An explanation for the suggested classification and any error flags.'),
});
export type TransactionClassificationAssistantOutput = z.infer<
  typeof TransactionClassificationAssistantOutputSchema
>;

export async function classifyTransaction(
  input: TransactionClassificationAssistantInput
): Promise<TransactionClassificationAssistantOutput> {
  return transactionClassificationAssistantFlow(input);
}

const chartOfAccounts = `
Chart of Accounts (COA):
----------------------------------------------------------------------------------------------
Account Code | Account Name                          | Account Type | Normal Balance
----------------------------------------------------------------------------------------------
101.10.0000  | Fixed Deposit Receipt (FDR)           | Asset        | Debit
101.20.0000  | Savings Certificate                   | Asset        | Debit
101.30.0000  | Govt. Treasury Bond                   | Asset        | Debit
105.10.0000  | CPF Loan Disburse                     | Asset        | Debit
105.20.0000  | CPF Loan Recover                      | Contra-Asset | Credit
106.10.0000  | Accrued Interest on FDR               | Asset        | Debit
106.40.0000  | Accrued Interest on Member Loan       | Asset        | Debit
107.10.0000  | Receivable from PBS                   | Asset        | Debit
131.10.0001  | STD Bank Account                      | Asset        | Debit
131.10.0002  | CD / Savings Account                  | Asset        | Debit
205.10.0000  | Lapse & Forfeiture Account            | Liability    | Credit
225.10.0000  | Employees' Own Contribution           | Liability    | Credit
225.20.0000  | PBS Contribution                      | Liability    | Credit
225.30.0000  | Cum. Interest on Emp. Contribution    | Liability    | Credit
225.40.0000  | Cum. Interest on PBS Contribution     | Liability    | Credit
400.10.0000  | Interest on FDR                       | Income       | Credit
400.60.0000  | Interest on Member Loan               | Income       | Credit
400.70.0000  | Interest on Bank Balance              | Income       | Credit
510.00.0000  | Bank Charges & Excise Duty            | Expense      | Debit
530.00.0000  | Administrative Expenses               | Expense      | Debit
----------------------------------------------------------------------------------------------
`;

const prompt = ai.definePrompt({
  name: 'transactionClassificationAssistantPrompt',
  input: {schema: TransactionClassificationAssistantInputSchema},
  output: {schema: TransactionClassificationAssistantOutputSchema},
  prompt: `You are an expert accountant for a CPF (Contributory Provident Fund) management system.
Analyze the description and suggest a complete Double-Entry Transaction (Debit and Credit).

${chartOfAccounts}

Transaction Description: {{{transactionDescription}}}

Return a balanced set of entries. For example, if a member contributes, Debit Cash/Bank and Credit Employees' Own Contribution.
`,
});

const transactionClassificationAssistantFlow = ai.defineFlow(
  {
    name: 'transactionClassificationAssistantFlow',
    inputSchema: TransactionClassificationAssistantInputSchema,
    outputSchema: TransactionClassificationAssistantOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
