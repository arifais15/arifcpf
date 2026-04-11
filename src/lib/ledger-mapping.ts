/**
 * @fileOverview Configuration for mapping General Ledger account codes 
 * to Member Subsidiary Ledger columns.
 */

// 1. Define the internal names of the 7 Member Ledger columns
export type LedgerColumnKey = 
  | 'employeeContribution' 
  | 'loanWithdrawal' 
  | 'loanRepayment' 
  | 'profitEmployee' 
  | 'profitLoan' 
  | 'pbsContribution' 
  | 'profitPbs';

/**
 * 2. ACCOUNT CODE MAPPING
 * Edit this object if you change your Chart of Accounts codes.
 * Format: 'ACCOUNT_CODE': 'LEDGER_COLUMN_NAME'
 */
export const LEDGER_COLUMN_MAPPING: Record<string, LedgerColumnKey> = {
  '225.10.0000': 'employeeContribution', // Employees' Own Contribution (Col 1)
  '105.10.0000': 'loanWithdrawal',        // CPF Loan Disburse (Col 2)
  '105.20.0000': 'loanRepayment',         // CPF Loan Recover (Col 3)
  '225.30.0000': 'profitEmployee',        // Cum. Interest on Emp. Contribution (Col 5)
  '400.60.0000': 'profitLoan',            // Interest on Member Loan (Col 6)
  '225.20.0000': 'pbsContribution',       // PBS Contribution (Col 8)
  '225.40.0000': 'profitPbs',             // Cum. Interest on PBS Contribution (Col 9)
};

/**
 * 3. NORMAL BALANCE CONFIGURATION
 * List account codes here that have a NORMAL DEBIT balance (e.g. Assets).
 * For these accounts, [Debit - Credit] will be posted to the ledger.
 * For all others (Liabilities/Income), [Credit - Debit] will be posted.
 */
export const NORMAL_DEBIT_ACCOUNTS = [
  '105.10.0000', // Loan Disburse (Asset)
  '101.10.0000', // FDR (Asset)
  '131.10.0001', // Bank (Asset)
];

/**
 * Helper to calculate the column values for a specific transaction line
 */
export function getSubsidiaryValues(code: string, debit: number, credit: number) {
  const columnKey = LEDGER_COLUMN_MAPPING[code];
  
  // If this code isn't mapped to a member ledger column, return all zeros
  if (!columnKey) return null;

  // Calculate the net increase based on normal balance rules
  const isNormalDebit = NORMAL_DEBIT_ACCOUNTS.includes(code);
  const amount = isNormalDebit ? (debit - credit) : (credit - debit);

  // Return the specific column object
  return {
    employeeContribution: columnKey === 'employeeContribution' ? amount : 0,
    loanWithdrawal: columnKey === 'loanWithdrawal' ? amount : 0,
    loanRepayment: columnKey === 'loanRepayment' ? amount : 0,
    profitEmployee: columnKey === 'profitEmployee' ? amount : 0,
    profitLoan: columnKey === 'profitLoan' ? amount : 0,
    pbsContribution: columnKey === 'pbsContribution' ? amount : 0,
    profitPbs: columnKey === 'profitPbs' ? amount : 0,
  };
}
