export const CONTACT_LIMITS = {
  nameMinLength: 2,
  nameMaxLength: 255,
  emailMaxLength: 255,
  messageMinLength: 10,
  messageMaxLength: 5000,
} as const

const EMAIL_FORMAT =
  /^[a-zA-Z0-9.!#$%&'*+\\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

export declare namespace ContactMessage {
  type Field = 'name' | 'email' | 'message'
  type ViolationKind = 'missing' | 'tooShort' | 'tooLong' | 'invalidFormat'

  interface Violation {
    readonly field: Field
    readonly kind: ViolationKind
  }

  /** Saisie à vérifier, valeurs déjà nettoyées par l'adaptateur (espaces de bord retirés). */
  interface Candidate {
    readonly name: string | null
    readonly email: string | null
    readonly message: string | null
  }

  interface Draft {
    readonly name: string
    readonly email: string
    readonly message: string
    readonly receivedAt: Date
  }

  interface Entity extends Draft {
    readonly id: number
  }

  interface Repository {
    save(draft: Draft): Promise<Entity>
  }
}

/** Longueur en caractères (points de code), pas en unités UTF-16. */
const characterCount = (value: string): number => Array.from(value).length

const lengthViolation = (
  field: ContactMessage.Field,
  value: string,
  minLength: number,
  maxLength: number,
): ContactMessage.Violation | null => {
  const length = characterCount(value)
  if (length > maxLength) {
    return { field, kind: 'tooLong' }
  }

  return length < minLength ? { field, kind: 'tooShort' } : null
}

/**
 * Règles du message de contact, dans l'ordre des champs : nom obligatoire de 2 à 255
 * caractères, e-mail obligatoire (vide = absent), au format HTML5 avec domaine de premier
 * niveau et de 255 caractères au plus, message obligatoire de 10 à 5000 caractères.
 */
export const contactMessageViolations = (
  candidate: ContactMessage.Candidate,
): ContactMessage.Violation[] => {
  const { name, email, message } = candidate
  const violations: (ContactMessage.Violation | null)[] = []

  violations.push(
    name === null
      ? { field: 'name', kind: 'missing' }
      : lengthViolation('name', name, CONTACT_LIMITS.nameMinLength, CONTACT_LIMITS.nameMaxLength),
  )

  if (email === null || email === '') {
    violations.push({ field: 'email', kind: 'missing' })
  } else {
    violations.push(EMAIL_FORMAT.test(email) ? null : { field: 'email', kind: 'invalidFormat' })
    violations.push(
      characterCount(email) > CONTACT_LIMITS.emailMaxLength
        ? { field: 'email', kind: 'tooLong' }
        : null,
    )
  }

  violations.push(
    message === null
      ? { field: 'message', kind: 'missing' }
      : lengthViolation(
          'message',
          message,
          CONTACT_LIMITS.messageMinLength,
          CONTACT_LIMITS.messageMaxLength,
        ),
  )

  return violations.filter((violation) => violation !== null)
}
