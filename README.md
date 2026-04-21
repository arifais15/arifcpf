# PBS CPF Management Software (Portable Version)

Management Accounting Software for Contributory Provident Fund (CPF). Specially optimized for Gazipur Palli Bidyut Samity-2 with **Local-First Architecture**.

## 🚀 Quick Start (Local PC Setup)

1. **Prerequisite**: Install [Node.js](https://nodejs.org/) (LTS version).
2. **Installation**:
   - Extract the project ZIP.
   - Open terminal/cmd in the project folder.
   - Run: `npm install`
3. **Running the App**:
   - Run: `npm run dev`
   - Open browser to: `http://localhost:9002`
4. **Login**: 
   - **User ID**: `arif`
   - **Password**: `123123`

## 🛡️ Data Resilience & Persistence
This application uses a **Local Persistence Engine**. All transactions, member ledgers, and settings are saved directly to your browser's persistent storage on your PC. 
- **Sudden Shutdown**: Data is saved instantly upon every "Commit" or "Save". Even if the PC restarts, your data remains intact.
- **Backups**: Go to **Settings > Data Portability** to download a `.json` backup of your entire database.

## Key Features
- **Member Registry**: Manage personnel profiles and account statuses.
- **Journal Entries**: Dual-accounting system with automatic subsidiary ledger synchronization.
- **Interest Accrual**: Automated monthly and special (Day-Product) interest calculations.
- **Institutional Reports**: Balance Sheet, Income Statement, Netfund Statements, and more.

Developed by: **Ariful Islam, AGMF, Gazipur PBS-2**
