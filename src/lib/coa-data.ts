export type AccountType = 'Asset' | 'Contra-Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';
export type NormalBalance = 'Debit' | 'Credit';

export interface COAEntry {
  code: string;
  name: string;
  type: AccountType | '';
  balance: NormalBalance | '';
  isHeader?: boolean;
}

export const CHART_OF_ACCOUNTS: COAEntry[] = [
  // 100 ASSETS
  { code: '101.00.0000', name: 'Investments', type: '', balance: '', isHeader: true },
  { code: '101.10.0000', name: 'Fixed Deposit Receipt (FDR)', type: 'Asset', balance: 'Debit' },
  { code: '101.20.0000', name: 'Savings Certificate', type: 'Asset', balance: 'Debit' },
  { code: '101.30.0000', name: 'Govt. Treasury Bond', type: 'Asset', balance: 'Debit' },
  { code: '101.40.0000', name: 'Investment on Share', type: 'Asset', balance: 'Debit' },
  { code: '101.50.0000', name: 'Investment on Mutual Fund', type: 'Asset', balance: 'Debit' },
  { code: '101.60.0000', name: 'Other investment', type: 'Asset', balance: 'Debit' },
  
  { code: '105.00.0000', name: 'Member Loans', type: '', balance: '', isHeader: true },
  { code: '105.10.0000', name: 'CPF Loan Disburse', type: 'Asset', balance: 'Debit' },
  { code: '105.20.0000', name: 'CPF Loan Recover', type: 'Contra-Asset', balance: 'Credit' },
  { code: '105.30.0000', name: '80% Advance CPF', type: 'Asset', balance: 'Debit' },
  
  { code: '106.00.0000', name: 'Accrued Revenue Interest', type: '', balance: '', isHeader: true },
  { code: '106.10.0000', name: 'Accrued Interest on FDR', type: 'Asset', balance: 'Debit' },
  { code: '106.20.0000', name: 'Accrued Interest on Savings Certificate', type: 'Asset', balance: 'Debit' },
  { code: '106.30.0000', name: 'Accrued Interest on Bond', type: 'Asset', balance: 'Debit' },
  { code: '106.40.0000', name: 'Accrued Interest on Member Loan', type: 'Asset', balance: 'Debit' },
  { code: '106.50.0000', name: 'Accrued Interest on Mutual Fund', type: 'Asset', balance: 'Debit' },
  { code: '106.60.0000', name: 'Accrued Interest on Other', type: 'Asset', balance: 'Debit' },
  
  { code: '107.00.0000', name: 'Receivables', type: '', balance: '', isHeader: true },
  { code: '107.10.0000', name: 'Receivable from PBS', type: 'Asset', balance: 'Debit' },
  { code: '107.20.0000', name: 'Other Receivable', type: 'Asset', balance: 'Debit' },
  
  { code: '108.00.0000', name: 'Tax Assets', type: '', balance: '', isHeader: true },
  { code: '108.10.0000', name: 'Advance Tax', type: 'Asset', balance: 'Debit' },
  { code: '108.20.0000', name: 'TDS on FDR', type: 'Asset', balance: 'Debit' },
  { code: '108.30.0000', name: 'TDS on Govt. Treasury Bond', type: 'Asset', balance: 'Debit' },
  { code: '108.40.0000', name: 'TDS on SND Interest', type: 'Asset', balance: 'Debit' },
  
  { code: '131.00.0000', name: 'Cash & Bank', type: '', balance: '', isHeader: true },
  { code: '131.10.0001', name: 'STD Bank Account', type: 'Asset', balance: 'Debit' },
  { code: '131.10.0002', name: 'CD / Savings Account', type: 'Asset', balance: 'Debit' },
  
  // 200 LIABILITIES & EQUITY
  { code: '205.00.0000', name: 'Forfeiture', type: '', balance: '', isHeader: true },
  { code: '205.10.0000', name: 'Lapse & Forfeiture Account', type: 'Liability', balance: 'Credit' },
  
  { code: '210.00.0000', name: 'Payables', type: '', balance: '', isHeader: true },
  { code: '210.10.0000', name: 'Audit & Professional Fee Payable', type: 'Liability', balance: 'Credit' },
  { code: '210.20.0000', name: 'Payable to PBS', type: 'Liability', balance: 'Credit' },
  
  { code: '220.00.0000', name: 'Provisions', type: '', balance: '', isHeader: true },
  { code: '220.10.0000', name: 'Provision for Income Tax', type: 'Liability', balance: 'Credit' },
  
  { code: '225.00.0000', name: 'Member Fund / Equity', type: '', balance: '', isHeader: true },
  { code: '225.10.0000', name: "Employees' Own Contribution", type: 'Liability', balance: 'Credit' },
  { code: '225.20.0000', name: 'PBS Contribution', type: 'Liability', balance: 'Credit' },
  { code: '225.30.0000', name: 'Cum. Interest on Emp. Contribution', type: 'Liability', balance: 'Credit' },
  { code: '225.40.0000', name: 'Cum. Interest on PBS Contribution', type: 'Liability', balance: 'Credit' },
  { code: '225.50.0000', name: 'Final Settlement Payable', type: 'Liability', balance: 'Credit' },
  
  // 400 INCOME
  { code: '400.00.0000', name: 'Interest Income', type: '', balance: '', isHeader: true },
  { code: '400.10.0000', name: 'Interest on FDR', type: 'Income', balance: 'Credit' },
  { code: '400.20.0000', name: 'Interest on Savings Certificate', type: 'Income', balance: 'Credit' },
  { code: '400.30.0000', name: 'Interest on Bond', type: 'Income', balance: 'Credit' },
  { code: '400.60.0000', name: 'Interest on Member Loan', type: 'Income', balance: 'Credit' },
  { code: '400.70.0000', name: 'Interest on Bank Balance', type: 'Income', balance: 'Credit' },
  { code: '410.10.0000', name: 'Forfeiture Income', type: 'Income', balance: 'Credit' },
  { code: '420.10.0000', name: 'PBS Subsidy (Administrative Support)', type: 'Income', balance: 'Credit' },
  { code: '430.10.0000', name: 'Retained Earnings (Reserved)', type: 'Income', balance: 'Credit' },
  
  // 500 EXPENSES
  { code: '500.00.0000', name: 'Operating Expenses', type: '', balance: '', isHeader: true },
  { code: '510.00.0000', name: 'Bank Charges & Excise Duty', type: 'Expense', balance: 'Debit' },
  { code: '520.00.0000', name: 'Audit & Professional Fees', type: 'Expense', balance: 'Debit' },
  { code: '530.00.0000', name: 'Administrative Expenses', type: 'Expense', balance: 'Debit' },
  { code: '540.00.0000', name: 'Loss on Investment', type: 'Expense', balance: 'Debit' },
  { code: '545.00.0000', name: 'Income Tax Expense', type: 'Expense', balance: 'Debit' },
];
