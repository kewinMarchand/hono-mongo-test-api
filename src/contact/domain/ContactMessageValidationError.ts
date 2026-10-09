import type { ContactMessage } from './ContactMessage.ts'

export class ContactMessageValidationError extends Error {
  readonly violations: readonly ContactMessage.Violation[]

  constructor(violations: readonly ContactMessage.Violation[]) {
    super(
      violations.map((violation) => `${violation.propertyPath}: ${violation.message}`).join('\n'),
    )
    this.name = 'ContactMessageValidationError'
    this.violations = violations
  }
}
