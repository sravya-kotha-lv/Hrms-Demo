# 06. Payroll HR Guide (Fresher-Friendly)

This guide is written for new HR users who are running payroll in Upanaya for the first time.

## 1. What You Need Before Running Payroll

Complete these checks first:

1. Employees are active (terminated/resigned employees are excluded from payroll and dashboard totals).
2. Pay Group is created and mapped to employee payroll profiles.
3. Salary structure is saved for each employee (CTC and components).
4. Bank details are saved for salary disbursement.
5. Attendance data for the month is available in timesheets/attendance.
6. Leave approvals are completed for the pay period.

## 2. Simple Payroll Terms

- `CTC`: Total yearly company cost for an employee.
- `Gross`: Sum of earning components.
- `Deductions`: PF, ESI, PT, TDS, loan recovery, etc.
- `Net Pay`: Gross minus total deductions.
- `Payable Days`: Days eligible for salary in the period.
- `LOP`: Loss of Pay for unpaid absences.

## 3. Recommended Payroll Process (Monthly Cycle)

1. Open `Payroll Setup Wizard`.
2. Review default Telangana components/formulas.
3. Edit if company-specific policy differs.
4. Save Pay Group.
5. For each employee, set salary details:
   - Enter annual CTC.
   - Confirm pay group.
   - Review auto-calculated components.
   - Override component percent/amount if required.
6. Add/verify employee bank and statutory details.
7. Generate attendance snapshot for the month.
8. Create payroll run.
9. Preview and validate errors/warnings.
10. Recompute after fixes (if any).
11. Submit for approval (maker-checker flow).
12. Approve and lock run.
13. Generate payslips and bank transfer export.

## 4. Telangana Defaults (Implemented Guidance)

- Basic pay often set as `40% to 50%` of gross/CTC based on company policy.
- HRA (non-metro) commonly set as `40% of Basic`.
- PT slab (Telangana) is configured as monthly deduction logic.
- PF/ESI applicability depends on statutory thresholds and policy.

Important:
- Statutory rates and thresholds can change by notification.
- Always verify latest compliance values before final lock.

## 5. Common Validation Errors and How to Fix

### A) Missing bank details for payroll disbursement
- Go to employee salary section > bank details tab.
- Fill account holder name, account number, IFSC, bank/branch.
- Save and recompute payroll run.

### B) Missing PAN/UAN/ESI details
- Update statutory details in employee payroll profile.
- Save and recompute.

### C) Negative net pay
- Check deductions, loans, arrears, manual adjustments.
- Move excess deduction to next month or add recovery rules.

### D) Attendance snapshot missing
- Trigger attendance snapshot generation for selected month.
- Recompute payroll run.

### E) Component mismatch with CTC
- Verify component calculation types (`Fixed`, `Percentage`, `Formula`, `Slab`).
- Ensure balancing component (fixed allowance) is configured if needed.

## 6. When to Use Override

Use overrides only when:
- Employee has negotiated salary split different from pay group defaults.
- Special one-time allowance/deduction is approved.
- Transition month has partial policy/proration requirements.

Always keep notes in adjustment reason fields for audit clarity.

## 7. Maker-Checker States (What They Mean)

- `Draft`: Run created, editable.
- `Computed/Preview`: Amounts calculated.
- `Submitted`: Sent for approver review.
- `Approved`: Accepted by authorized checker.
- `Locked`: Finalized; no edits allowed unless reopened with permission.

## 8. End-of-Month HR Checklist

1. All leave approvals complete.
2. Attendance exceptions resolved.
3. Employee bank/statutory details complete.
4. Payroll validation errors resolved.
5. Approval completed by authorized checker.
6. Run locked.
7. Payslips generated and export prepared.
8. Payroll reports archived (register, deduction summary, employer contribution).

## 9. Troubleshooting Quick Tips

- If values look wrong, recompute after every major change.
- If only some employees should be processed, run payroll for selected employees.
- If duplicate run error appears for same pay month and group, reopen existing run instead of creating a new duplicate.
- If access denied, check payroll permissions and active role (HR/Org Admin).

## 10. Escalation Matrix (Suggested)

- `HR Executive`: Data entry, profile checks, first-level fixes.
- `HR Manager`: Policy decisions, overrides, final review.
- `Finance/Payroll Approver`: Approval, lock, payout controls.
- `System Admin`: Permission setup, integrations, migration/infra issues.
