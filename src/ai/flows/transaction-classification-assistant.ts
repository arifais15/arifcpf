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
  suggestedAccount: z.object({
    accountCode: z.string().describe('The suggested Chart of Accounts code.'),
    accountName: z.string().describe('The suggested Chart of Accounts name.'),
    accountType:
      z.enum([
        'Asset',
        'Contra-Asset',
        'Liability',
        'Equity',
        'Income',
        'Expense',
      ])
      .describe('The type of the suggested account.'),
    normalBalance: z
      .enum(['Debit', 'Credit'])
      .describe('The normal balance of the suggested account.'),
  }),
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
101.40.0000  | Investment on Share                   | Asset        | Debit
101.50.0000  | Investment on Mutual Fund             | Asset        | Debit
101.60.0000  | Other investment                      | Asset        | Debit
105.10.0000  | CPF Loan Disburse                     | Asset        | Debit
105.20.0000  | CPF Loan Recover                      | Contra-Asset | Credit
105.30.0000  | 80% Advance CPF                       | Asset        | Debit
106.10.0000  | Accrued Interest on FDR               | Asset        | Debit
106.20.0000  | Accrued Interest on Savings Certificate | Asset        | Debit
106.30.0000  | Accrued Interest on Bond              | Asset        | Debit
106.40.0000  | Accrued Interest on Member Loan       | Asset        | Debit
106.50.0000  | Accrued Interest on Mutual Fund       | Asset        | Debit
106.60.0000  | Accrued Interest on Other             | Asset        | Debit
107.10.0000  | Receivable from PBS                   | Asset        | Debit
107.20.0000  | Other Receivable                      | Asset        | Debit
108.10.0000  | Advance Tax                           | Asset        | Debit
108.10.0000  | TDS on FDR                            | Asset        | Debit
108.20.0000  | TDS on Savings Certificate            | Asset        | Debit
108.30.0000  | TDS on Govt. Treasury Bond            | Asset        | Debit
108.40.0000  | TDS on SND Interest                   | Asset        | Debit
131.10.0001  | STD Bank Account                      | Asset        | Debit
131.10.0002  | CD / Savings Account                  | Asset        | Debit
205.10.0000  | Lapse & Forfeiture Account            | Liability    | Credit
210.10.0000  | Audit & Professional Fee Payable      | Liability    | Credit
210.20.0000  | Payable to PBS                        | Liability    | Credit
220.10.0000  | Provision for Income Tax              | Liability    | Credit
225.10.0000  | Employees' Own Contribution           | Liability    | Credit
225.20.0000  | PBS Contribution                      | Liability    | Credit
225.30.0000  | Cum. Interest on Emp. Contribution    | Liability    | Credit
225.40.0000  | Cum. Interest on PBS Contribution     | Liability    | Credit
225.50.0000  | Final Settlement Payable              | Liability    | Credit
400.10.0000  | Interest on FDR                       | Income       | Credit
400.20.0000  | Interest on Savings Certificate       | Income       | Credit
400.30.0000  | Interest on Bond                      | Income       | Credit
400.60.0000  | Interest on Member Loan               | Income       | Credit
400.70.0000  | Interest on Bank Balance              | Income       | Credit
410.10.0000  | Forfeiture Income                     | Income       | Credit
420.10.0000  | PBS Subsidy (Administrative Support)  | Income       | Credit
430.10.0000  | Retained Earnings (Reserved)          | Income       | Credit
510.00.0000  | Bank Charges & Excise Duty            | Expense      | Debit
520.00.0000  | Audit & Professional Fees             | Expense      | Debit
530.00.0000  | Administrative Expenses               | Expense      | Debit
540.00.0000  | Loss on Investment                    | Expense      | Debit
545.00.0000  | Income Tax Expense                    | Expense      | Debit
----------------------------------------------------------------------------------------------
`;

const prompt = ai.definePrompt({
  name: 'transactionClassificationAssistantPrompt',
  input: {schema: TransactionClassificationAssistantInputSchema},
  output: {schema: TransactionClassificationAssistantOutputSchema},
  prompt: `You are an expert accountant for a CPF (Contributory Provident Fund) management system.
Your task is to analyze a given financial transaction description and suggest the most appropriate Chart of Accounts (COA) entry from the provided list. Additionally, you must identify any potential data entry errors in the transaction description itself or if the description does not clearly fit any existing COA. 

Only use the COA provided below for classification. Do not invent new accounts.

${chartOfAccounts}

Here is the transaction description:
Transaction Description: {{{transactionDescription}}}

Based on the above transaction description and COA, provide the:
1.  Suggested Account Code, Account Name, Account Type, and Normal Balance.
2.  Indicate if there are any potential data entry errors (e.g., ambiguity, missing information, or if the description does not fit any COA).
3.  Provide a clear and concise rationale for your classification and any identified errors.
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
