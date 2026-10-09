import type { ContactViolation } from './contract.ts'

export class ContactMessageValidationError extends Error {
  readonly violations: readonly ContactViolation[]

  constructor(violations: readonly ContactViolation[]) {
    super(
      violations.map((violation) => `${violation.propertyPath}: ${violation.message}`).join('\n'),
    )
    this.name = 'ContactMessageValidationError'
    this.violations = violations
  }
}
